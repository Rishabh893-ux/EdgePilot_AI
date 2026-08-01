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
    h = datetime.datetime.now().hour
    if 6 <= h < 14:    return "morning"
    elif 14 <= h < 22: return "afternoon"
    else:              return "night"


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

    return {
        "machine_id":    MACHINE_ID,
        "timestamp":     datetime.datetime.now(datetime.UTC).isoformat().replace("+00:00", ""),
        "shift":         get_shift(),
        "temperature":   temp,
        "vibration":     vib,
        "rpm":           rpm,
        "motor_current": curr,
        "health_score":  health,
        "reading_id":    step,
    }


client = mqtt.Client()
client.on_connect = lambda c, u, f, rc: print(
    f"[OK] Simulator connected to {BROKER} (rc={rc})" if rc == 0
    else f"[FAIL] Simulator connect failed rc={rc}"
)

try:
    client.connect(BROKER, PORT, 60)
    client.loop_start()
except Exception as e:
    print(f"[FAIL] Cannot connect to {BROKER}:{PORT} — {e}")
    exit(1)

print("=" * 55)
print("  EdgePilot AI — Sensor Simulator")
print(f"  Machine : {MACHINE_ID}")
print(f"  Broker  : {BROKER}:{PORT}")
print(f"  Topic   : {TOPIC}")
print(f"  Interval: {INTERVAL}s per reading")
print("  Machine degrades over time — health drops slowly.")
print("  Watch the dashboard for alerts firing in real time!")
print("  Ctrl+C to stop")
print("=" * 55)

step = 0
while True:
    r = get_reading(step)
    client.publish(TOPIC, json.dumps(r), qos=1)

    health_bar = "#" * int(r["health_score"] // 10)
    flag = "! WARN" if r["health_score"] < 70 else ("!! CRIT" if r["health_score"] < 50 else "OK    ")
    print(
        f"[{step:04d}] {r['timestamp'][11:19]} | "
        f"Health={r['health_score']:5.1f} [{health_bar:<10}] | "
        f"Temp={r['temperature']:5.1f}C | "
        f"Vib={r['vibration']:.2f} | "
        f"RPM={r['rpm']} | {flag}"
    )
    step += 1
    time.sleep(INTERVAL)
