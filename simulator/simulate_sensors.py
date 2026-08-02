"""
EdgePilot AI — Sensor Simulator
Publishes realistic degrading industrial sensor data over MQTT.

Run: py -3.11 simulator/simulate_sensors.py
"""

import paho.mqtt.client as mqtt
import json, time, random, math, datetime, os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

BROKER   = os.getenv("MQTT_BROKER",        "test.mosquitto.org")
PORT     = int(os.getenv("MQTT_PORT",       "1883"))
TOPIC    = os.getenv("MQTT_TOPIC_SENSORS",  "edgepilot/sensors/machine_001")
INTERVAL = float(os.getenv("SIMULATOR_INTERVAL_SECONDS", "3"))
MACHINE_ID = "machine_001"


def get_shift():
    # Return a random shift so the dashboard's Shift Comparison chart
    # populates with data across all shifts during a short demo session.
    return random.choice(["morning", "afternoon", "night"])


def get_reading(step: int) -> dict:
    """
    Realistic sensor reading with slow degradation over time.
    Health starts at 95 and slowly drops. Temperature rises.
    At step ~300 machine becomes critical (good for demo).
    """
    deg   = min(step * 0.018, 22)
    n     = lambda s: random.uniform(-s, s)

    temp  = round(63 + math.sin(step * 0.08) * 4 + deg * 0.95 + n(0.8), 1)
    vib   = round(1.8 + deg * 0.13  + n(0.15), 2)
    rpm   = round(1480 - deg * 1.9  + n(8))
    curr  = round(12.2 + deg * 0.06 + n(0.2), 2)
    health= max(20.0, round(97 - deg * 3.3 + n(1.5), 1))

    # Energy & Carbon Tracking (Phase 1)
    # Assumes 480V 3-phase motor, 0.85 power factor
    power_draw = round((curr * 480 * 1.732 * 0.85) / 1000, 2)
    carbon_rate = round(power_draw * 0.4, 2) # ~0.4 kg CO2 per kWh

    # Acoustic Anomaly Detection
    acoustic_freq = round(1200 + deg * 45 + n(20), 1)

    # True Edge ML (Local Anomaly Detection)
    # Using lightweight threshold/z-score proxy
    local_anomaly = bool(vib > 4.0 or temp > 75.0 or acoustic_freq > 2000)

    return {
        "machine_id":    MACHINE_ID,
        "timestamp":     datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", ""),
        "shift":         get_shift(),
        "temperature":   temp,
        "vibration":     vib,
        "rpm":           rpm,
        "motor_current": curr,
        "health_score":  health,
        "power_draw_kw": power_draw,
        "carbon_emission": carbon_rate,
        "acoustic_freq": acoustic_freq,
        "local_anomaly": local_anomaly,
        "reading_id":    step,
    }


CONTROL_TOPIC = os.getenv("MQTT_TOPIC_CONTROL", "edgepilot/control/machine_001")

state = {"step": 0}

def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        if data.get("command") == "estop":
            print("\n[!!!] EMERGENCY STOP RECEIVED! Resetting degradation and cooling down...\n")
            state["step"] = 0
    except Exception as e:
        pass

def start_simulator_loop():
    client = mqtt.Client()
    client.on_message = on_message

    client.on_connect = lambda c, u, f, rc: print(
        f"[OK] Simulator connected to {BROKER} (rc={rc})" if rc == 0
        else f"[FAIL] Simulator connect failed rc={rc}",
        flush=True
    )

    try:
        client.connect(BROKER, PORT, 60)
        client.subscribe(CONTROL_TOPIC)
        client.loop_start()
    except Exception as e:
        print(f"[FAIL] Cannot connect to {BROKER}:{PORT} — {e}")
        return

    run_simulator(client)

if __name__ == "__main__":
    start_simulator_loop()

def run_simulator(client):
    print("=" * 55)
    print("  EdgePilot AI — Sensor Simulator")
    print(f"  Machine : {MACHINE_ID}")
    print(f"  Broker  : {BROKER}:{PORT}")
    print(f"  Topic   : {TOPIC}")
    print(f"  Control : {CONTROL_TOPIC}")
    print(f"  Interval: {INTERVAL}s per reading")
    print("  Machine degrades over time — health drops slowly.")
    print("  Watch the dashboard for alerts firing in real time!")
    print("  Ctrl+C to stop")
    print("=" * 55)

    while True:
        r = get_reading(state["step"])
        client.publish(TOPIC, json.dumps(r), qos=1)

        health_bar = "#" * int(r["health_score"] // 10)
        flag = "! WARN" if r["health_score"] < 70 else ("!! CRIT" if r["health_score"] < 50 else "OK    ")
        print(
            f"[{state['step']:04d}] {r['timestamp'][11:19]} | "
            f"Health={r['health_score']:5.1f} [{health_bar:<10}] | "
            f"Temp={r['temperature']:5.1f}C | "
            f"Vib={r['vibration']:.2f} | "
            f"RPM={r['rpm']} | {flag}",
            flush=True
        )
        
        # Periodically generate mock safety violations for the demo
        if state["step"] > 0 and state["step"] % 25 == 0:
            try:
                from backend.database import SessionLocal, PPEViolation
                db = SessionLocal()
                v = random.choice(["Worker spotted without helmet near Conveyor", "No Hi-Vis vest detected in Zone B", "Technician not wearing safety goggles", "Unauthorized access to high-voltage area"])
                db.add(PPEViolation(machine_id=MACHINE_ID, violation=v, shift=get_shift(), created_at=r["timestamp"]))
                db.commit()
                db.close()
                print(f" [SAFETY] Logged mock violation: {v}")
            except Exception:
                pass
                
        state["step"] += 1
        time.sleep(INTERVAL)
