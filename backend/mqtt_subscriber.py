"""
EdgePilot AI — MQTT Subscriber
Listens for sensor data, saves to DB, triggers anomaly + alerts.
"""
import json, threading, time, os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import paho.mqtt.client as mqtt
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from backend.database import (
    get_db, save_reading, update_anomaly_flags, save_alert,
    get_recent_readings, get_readings_for_trend, update_shift_baseline,
    update_copilot_context, get_recent_alerts, save_failure_story,
    save_maintenance_log, get_maintenance_history
)
from backend.anomaly import detect_anomaly, get_detector
from backend.alerts  import generate_trend_alerts, generate_failure_story
from backend.notifier import send_critical_alert

MQTT_BROKER    = os.getenv("MQTT_BROKER",       "test.mosquitto.org")
MQTT_PORT      = int(os.getenv("MQTT_PORT",      "1883"))
MQTT_TOPIC     = os.getenv("MQTT_TOPIC_SENSORS", "edgepilot/sensors/machine_001")
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID",     "edgepilot_backend")

_thread: Optional[threading.Thread] = None
_stop   = threading.Event()
_client: Optional[mqtt.Client]      = None
_count  = 0
_alert_tick   = 0
_context_tick = 0
ALERT_EVERY   = 5
CONTEXT_EVERY = 10

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        client.subscribe(MQTT_TOPIC, qos=1)
        print(f"[OK] Backend connected to MQTT -> {MQTT_BROKER} | Topic: {MQTT_TOPIC}")
    else:
        print(f"[FAIL] MQTT connect failed rc={rc}")

def on_disconnect(client, userdata, rc):
    print(f"[WARN]  MQTT disconnected rc={rc}")
    if not _stop.is_set():
        time.sleep(5)
        try: client.reconnect()
        except Exception: pass

def on_message(client, userdata, msg):
    global _count, _alert_tick, _context_tick
    try:
        data = json.loads(msg.payload.decode())
        _count += 1
        with get_db() as db:
            reading = save_reading(db, data)
            rid = reading.id
        result = detect_anomaly(data)
        with get_db() as db:
            update_anomaly_flags(db, rid, result["is_anomaly"], result["anomaly_score"])
        with get_db() as db:
            for p in ["temperature","vibration","rpm","motor_current","health_score"]:
                update_shift_baseline(db, data["machine_id"], data.get("shift","morning"), p, data[p])
        _context_tick += 1
        if _context_tick >= CONTEXT_EVERY:
            _context_tick = 0
            with get_db() as db:
                rows = get_recent_readings(db, data["machine_id"], limit=48)
                update_copilot_context(db, data["machine_id"], rows)
        _alert_tick += 1
        if _alert_tick >= ALERT_EVERY:
            _alert_tick = 0
            threading.Thread(target=_check_alerts, args=(data["machine_id"],), daemon=True).start()
        flag = "[ANOMALY]" if result["is_anomaly"] else "[OK]"
        print(f"[{_count:04d}] Health={data['health_score']:.0f} Temp={data['temperature']:.1f}C Vib={data['vibration']:.2f} {flag}")
    except Exception as e:
        print(f"[FAIL] MQTT message error: {e}")

def _check_alerts(machine_id: str):
    try:
        with get_db() as db:
            rows = get_readings_for_trend(db, machine_id, window=20)
            if len(rows) < 6: return
            rdicts = [{"timestamp": r.timestamp.isoformat(), "shift": r.shift,
                       "temperature": r.temperature, "vibration": r.vibration,
                       "rpm": r.rpm, "motor_current": r.motor_current,
                       "health_score": r.health_score} for r in rows]
            existing = [{"parameter": a.parameter, "alert_type": a.alert_type}
                        for a in get_recent_alerts(db, machine_id, limit=20)]
            new_alerts = generate_trend_alerts(machine_id, rdicts, existing, db)
            for a in new_alerts:
                save_alert(db, a)
                print(f"[ALERT] {a['message'][:80]}")
                if a["severity"] == "critical":
                    send_critical_alert(a["message"])
            critical = [a for a in new_alerts if a["severity"] == "critical"]
            if critical:
                all_rows = get_recent_readings(db, machine_id, limit=100)
                all_d = [{"timestamp": r.timestamp.isoformat(), "shift": r.shift,
                           "temperature": r.temperature, "vibration": r.vibration,
                           "rpm": r.rpm, "motor_current": r.motor_current,
                           "health_score": r.health_score, "is_anomaly": r.is_anomaly}
                          for r in all_rows]
                anom  = [x for x in all_d if x["is_anomaly"]]
                story = generate_failure_story(machine_id, all_d, critical[0], anom)
                story["machine_id"] = machine_id
                story["timestamp"]  = datetime.now(timezone.utc).isoformat()
                save_failure_story(db, story)
                print(f"[STORY] Failure story saved: {story['root_cause']}")

            # --- Feature 2: Automated Maintenance ---
            det = get_detector()
            rul = det.get_rul_days(rdicts)
            if rul != -1 and rul < 7:
                # Check if we already logged auto-maintenance recently
                recent_logs = get_maintenance_history(db, machine_id, limit=5)
                already_logged = any(l.maintenance_type == "auto_scheduled" for l in recent_logs)
                if not already_logged:
                    auto_log = {
                        "machine_id": machine_id,
                        "maintenance_type": "auto_scheduled",
                        "description": f"Auto-scheduled maintenance due to low RUL ({rul} days). Please inspect immediately.",
                    }
                    save_maintenance_log(db, auto_log)
                    print(f"[MAINTENANCE] Auto-scheduled task created (RUL={rul}d)")
                    send_critical_alert(f"Automated Maintenance Task created: RUL dropped to {rul} days.")
    except Exception as e:
        print(f"[FAIL] Alert check error: {e}")

def start_subscriber() -> threading.Thread:
    global _thread, _client, _stop
    _stop.clear()
    def run():
        global _client
        _client = mqtt.Client(client_id=MQTT_CLIENT_ID)
        _client.on_connect    = on_connect
        _client.on_disconnect = on_disconnect
        _client.on_message    = on_message
        try:
            _client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            _client.loop_forever()
        except Exception as e:
            print(f"[FAIL] MQTT subscriber error: {e}")
    _thread = threading.Thread(target=run, daemon=True, name="MQTTSubscriber")
    _thread.start()
    print("[INFO] MQTT subscriber started")
    return _thread

def stop_subscriber():
    global _client, _stop
    _stop.set()
    if _client:
        _client.loop_stop()
        _client.disconnect()

def get_subscriber_status() -> dict:
    return {
        "running": _thread is not None and _thread.is_alive(),
        "mqtt_connected": _client.is_connected() if _client else False,
        "readings_processed": _count,
        "broker": f"{MQTT_BROKER}:{MQTT_PORT}",
        "topic": MQTT_TOPIC,
    }
