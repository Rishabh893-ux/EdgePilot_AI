"""
EdgePilot AI — FastAPI Backend
All REST endpoints. Run: py -3.11 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
"""

import os, time
from datetime import datetime, timezone
from typing import List, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import json
from paho.mqtt.publish import single as mqtt_publish

load_dotenv(Path(__file__).parent.parent / ".env")

from backend.database import (
    init_db, get_db,
    get_latest_reading, get_recent_readings, get_readings_for_trend,
    get_health_stats, get_recent_alerts, get_unacknowledged_alerts,
    acknowledge_alert, save_maintenance_log, get_maintenance_history,
    get_recurring_patterns, get_latest_failure_story, save_failure_story,
    get_copilot_context, get_machine_ids, get_safety_summary,
    get_threshold_configs, save_threshold_config
)
from backend.auth import authenticate_user, create_session_token, get_user_from_token, revoke_session_token, create_user, ensure_default_users
from backend.anomaly  import get_detector, train_detector
from backend.recommendations import generate_recommendations
from backend.notifications import build_notifications
from backend.alerts   import generate_trend_alerts, generate_failure_story
from backend.mqtt_subscriber import start_subscriber, stop_subscriber, get_subscriber_status
from backend.models   import (
    MaintenanceCreate, CopilotRequest, CopilotResponse,
    DashboardResponse, SystemStatus, ThresholdConfigUpdate
)
from copilot.copilot  import ask_copilot, generate_work_order

MACHINE_ID = "machine_001"
_start_time = time.time()

app = FastAPI(
    title       = "EdgePilot AI",
    description = "Autonomous Heavy Machine Intelligence Platform — by Rishabh Kasaudhan",
    version     = "1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()
    ensure_default_users()
    start_subscriber()
    
    import threading
    from simulator.simulate_sensors import start_simulator_loop
    print("Starting built-in simulator thread...")
    threading.Thread(target=start_simulator_loop, daemon=True).start()
    
    print("=" * 50)
    print("  [OK] EdgePilot AI Backend ready")
    print("  API  -> http://localhost:8000")
    print("  Docs -> http://localhost:8000/docs")
    print("=" * 50)


@app.on_event("shutdown")
def shutdown():
    stop_subscriber()


# ── Health ────────────────────────────────────────────────────────
@app.get("/", tags=["system"])
def root():
    return {"status": "EdgePilot AI running", "version": "1.0.0"}


@app.post("/api/auth/login", tags=["auth"])
def login(username: str, password: str):
    user = authenticate_user(username, password)
    if not user:
        raise HTTPException(401, "Invalid credentials")
    token = create_session_token(user)
    return {"token": token, "user": {"username": user.username, "role": user.role}}


@app.post("/api/auth/logout", tags=["auth"])
def logout(token: str):
    if revoke_session_token(token):
        return {"status": "logged_out"}
    raise HTTPException(404, "Session not found")


@app.get("/api/auth/me", tags=["auth"])
def me(token: str):
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(401, "Invalid or expired token")
    return {"username": user.username, "role": user.role}


@app.post("/api/auth/register", tags=["auth"])
def register(username: str, password: str, role: str = "viewer"):
    try:
        user = create_user(username, password, role)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"status": "created", "user": {"username": user.username, "role": user.role}}


@app.get("/api/status", response_model=SystemStatus, tags=["system"])
def system_status():
    sub   = get_subscriber_status()
    det   = get_detector()
    with get_db() as db:
        alerts = get_unacknowledged_alerts(db, MACHINE_ID)
    return SystemStatus(
        status            = "running",
        mqtt_connected    = sub["mqtt_connected"],
        readings_processed= sub["readings_processed"],
        model_trained     = det.is_trained,
        active_alerts     = len(alerts),
        db_path           = "edgepilot.db",
    )


@app.post("/api/mock/webhook", tags=["system"])
def mock_webhook(alert: dict):
    print(f"\n[WEBHOOK SERVER] Received ticket for: {alert.get('message')}\n")
    return {"status": "ok", "ticket_id": f"TKT-{int(time.time())}"}


# ── Dashboard (single call for Mission Control) ────────────────────
@app.get("/api/dashboard", tags=["dashboard"])
def dashboard():
    with get_db() as db:
        latest   = get_latest_reading(db, MACHINE_ID)
        readings = get_recent_readings(db, MACHINE_ID, limit=30)
        alerts   = get_recent_alerts(db, MACHINE_ID, limit=10)
        unack    = get_unacknowledged_alerts(db, MACHINE_ID)
        stats    = get_health_stats(db, MACHINE_ID, hours=24)

    if not latest:
        return {"status": "waiting_for_data",
                "message": "Start the simulator: py -3.11 simulator/simulate_sensors.py"}

    det = get_detector()
    rdicts = [{"timestamp": r.timestamp.isoformat(), "shift": r.shift,
               "health_score": r.health_score, "temperature": r.temperature,
               "vibration": r.vibration, "rpm": r.rpm,
               "motor_current": r.motor_current,
               "power_kw": r.power_kw, "carbon_emission": r.carbon_emission,
               "acoustic_freq": r.acoustic_freq, "local_anomaly": r.local_anomaly} for r in readings]
    rul = det.get_rul_days(rdicts)

    return {
        "machine_id":      MACHINE_ID,
        "machineiq_score": latest.health_score,
        "temperature":     latest.temperature,
        "vibration":       latest.vibration,
        "rpm":             latest.rpm,
        "motor_current":   latest.motor_current,
        "shift":           latest.shift,
        "is_anomaly":      latest.is_anomaly,
        "rul_days":        rul,
        "active_alerts":   len(unack),
        "total_readings":  get_subscriber_status()["readings_processed"],
        "last_updated":    latest.timestamp.isoformat(),
        "power_kw":        latest.power_kw,
        "carbon_emission": latest.carbon_emission,
        "health_stats":    stats,
        "recent_readings": [
            {"t": r.timestamp.strftime("%H:%M:%S"), "temp": r.temperature,
             "vib": r.vibration, "health": r.health_score, "rpm": r.rpm,
             "power_kw": r.power_kw, "carbon_emission": r.carbon_emission,
             "acoustic": r.acoustic_freq}
            for r in readings
        ],
        "recent_alerts": [
            {"id": a.id, "severity": a.severity, "message": a.message,
             "parameter": a.parameter, "alert_type": a.alert_type,
             "acknowledged": a.acknowledged,
             "created_at": a.timestamp.strftime("%H:%M:%S")}
            for a in alerts
        ],
    }


@app.get("/api/fleet", tags=["dashboard"])
def fleet_overview():
    with get_db() as db:
        machine_ids = get_machine_ids(db)
        machines = []
        for machine_id in machine_ids:
            latest = get_latest_reading(db, machine_id)
            if not latest:
                continue
            alerts = get_recent_alerts(db, machine_id, limit=5)
            unack = get_unacknowledged_alerts(db, machine_id)
            machines.append({
                "machine_id": machine_id,
                "health_score": round(latest.health_score, 1) if latest.health_score is not None else None,
                "temperature": round(latest.temperature, 1) if latest.temperature is not None else None,
                "vibration": round(latest.vibration, 2) if latest.vibration is not None else None,
                "rpm": round(latest.rpm, 0) if latest.rpm is not None else None,
                "is_anomaly": latest.is_anomaly or False,
                "active_alerts": len(unack),
                "last_alert": alerts[0].message if alerts else None,
            })
    return {"machines": machines}


@app.get("/api/machine/{machine_id}/export", tags=["dashboard"])
def export_historical_data(machine_id: str, days: int = 30):
    import csv, io
    from datetime import timedelta
    with get_db() as db:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        from backend.database import SensorReading
        rows = db.query(SensorReading).filter(
            SensorReading.machine_id == machine_id,
            SensorReading.timestamp >= since
        ).order_by(SensorReading.timestamp).all()
        
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Shift", "Temperature", "Vibration", "RPM", "MotorCurrent", "HealthScore", "IsAnomaly"])
    for r in rows:
        writer.writerow([r.timestamp.isoformat(), r.shift, r.temperature, r.vibration, r.rpm, r.motor_current, r.health_score, r.is_anomaly])
    
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=export_{machine_id}.csv"
    return response


# ── Control ────────────────────────────────────────────────────────
@app.post("/api/machine/{machine_id}/control", tags=["control"])
def control_machine(machine_id: str, command: dict):
    from backend.mqtt_subscriber import MQTT_BROKER, MQTT_PORT
    topic = f"edgepilot/control/{machine_id}"
    try:
        mqtt_publish(topic, payload=json.dumps(command), hostname=MQTT_BROKER, port=MQTT_PORT)
        return {"status": "sent", "command": command}
    except Exception as e:
        raise HTTPException(500, f"Failed to send control command: {e}")


# ── Threshold Settings ─────────────────────────────────────────────
@app.get("/api/machine/{machine_id}/thresholds", tags=["settings"])
def get_thresholds(machine_id: str):
    with get_db() as db:
        configs = get_threshold_configs(db, machine_id)
    return {"machine_id": machine_id, "thresholds": [
        {"parameter": c.parameter, "warning": c.warning, "critical": c.critical,
         "warning_low": c.warning_low, "warning_high": c.warning_high}
        for c in configs
    ]}

@app.post("/api/machine/{machine_id}/thresholds", tags=["settings"])
def update_thresholds(machine_id: str, updates: List[ThresholdConfigUpdate]):
    with get_db() as db:
        for u in updates:
            save_threshold_config(db, u.model_dump())
    return {"status": "updated", "machine_id": machine_id}


# ── Sensor Data ────────────────────────────────────────────────────
@app.get("/api/machine/{machine_id}/readings", tags=["sensors"])
def get_readings(machine_id: str, limit: int = 50):
    with get_db() as db:
        rows = get_recent_readings(db, machine_id, limit)
    return {"machine_id": machine_id, "count": len(rows),
            "readings": [{"id": r.id, "timestamp": r.timestamp.isoformat(),
                          "shift": r.shift, "temperature": r.temperature,
                          "vibration": r.vibration, "rpm": r.rpm,
                          "motor_current": r.motor_current,
                          "health_score": r.health_score,
                          "is_anomaly": r.is_anomaly,
                          "power_kw": r.power_kw,
                          "carbon_emission": r.carbon_emission,
                          "acoustic_freq": r.acoustic_freq,
                          "local_anomaly": r.local_anomaly} for r in rows]}


@app.get("/api/machine/{machine_id}/trend", tags=["sensors"])
def get_trend(machine_id: str, n: int = 25):
    with get_db() as db:
        rows = get_readings_for_trend(db, machine_id, window=n)
    return {"readings": [
        {"t": r.timestamp.strftime("%H:%M:%S"), "temp": r.temperature,
         "vib": r.vibration, "health": r.health_score, "rpm": r.rpm,
         "current": r.motor_current, "power_kw": r.power_kw, "carbon_emission": r.carbon_emission,
         "acoustic": r.acoustic_freq}
        for r in rows
    ]}


@app.get("/api/machine/{machine_id}/stats", tags=["sensors"])
def get_stats(machine_id: str, hours: int = 24):
    with get_db() as db:
        return get_health_stats(db, machine_id, hours)


@app.get("/api/machine/{machine_id}/recommendations", tags=["analysis"])
def get_recommendations(machine_id: str):
    with get_db() as db:
        latest = get_latest_reading(db, machine_id)
        alerts = get_recent_alerts(db, machine_id, limit=5)
    if not latest:
        return {"machine_id": machine_id, "recommendations": []}
    metrics = {
        "temperature": latest.temperature,
        "vibration": latest.vibration,
        "health_score": latest.health_score,
    }
    return {
        "machine_id": machine_id,
        "recommendations": generate_recommendations(machine_id, metrics, [
            {"severity": a.severity, "message": a.message} for a in alerts
        ]),
    }


@app.get("/api/machine/{machine_id}/notifications", tags=["analysis"])
def get_notifications(machine_id: str):
    with get_db() as db:
        latest = get_latest_reading(db, machine_id)
        alerts = get_recent_alerts(db, machine_id, limit=5)
    if not latest:
        return {"machine_id": machine_id, "notifications": []}
    metrics = {
        "temperature": latest.temperature,
        "vibration": latest.vibration,
        "health_score": latest.health_score,
        "is_anomaly": latest.is_anomaly,
    }
    return {
        "machine_id": machine_id,
        "notifications": build_notifications(machine_id, metrics, [
            {"severity": a.severity, "message": a.message, "acknowledged": a.acknowledged} for a in alerts
        ]),
    }


# ── Alerts ─────────────────────────────────────────────────────────
@app.get("/api/machine/{machine_id}/alerts", tags=["alerts"])
def get_alerts(machine_id: str, limit: int = 20):
    with get_db() as db:
        alerts = get_recent_alerts(db, machine_id, limit)
    return {"machine_id": machine_id, "alerts": [
        {"id": a.id, "severity": a.severity, "alert_type": a.alert_type,
         "parameter": a.parameter, "message": a.message,
         "current_value": a.current_value, "threshold_value": a.threshold_value,
         "hours_until_breach": a.hours_until_breach,
         "acknowledged": a.acknowledged,
         "timestamp": a.timestamp.isoformat()}
        for a in alerts
    ]}


@app.post("/api/alerts/{alert_id}/acknowledge", tags=["alerts"])
def ack_alert(alert_id: int):
    with get_db() as db:
        ok = acknowledge_alert(db, alert_id)
    if not ok:
        raise HTTPException(404, "Alert not found")
    return {"status": "acknowledged", "alert_id": alert_id}


# ── Failure Story ──────────────────────────────────────────────────
@app.get("/api/machine/{machine_id}/failure-story", tags=["analysis"])
def get_failure_story(machine_id: str):
    with get_db() as db:
        story = get_latest_failure_story(db, machine_id)
        if story:
            return {"machine_id": machine_id, "story": story.story,
                    "root_cause": story.root_cause,
                    "timestamp": story.timestamp.isoformat(),
                    "health_at_failure": story.health_at_failure}
        # Generate on demand if none saved
        rows = get_recent_readings(db, machine_id, limit=100)
        if not rows:
            return {"machine_id": machine_id, "story": "No data yet.", "root_cause": None}
        rdicts = [{"timestamp": r.timestamp.isoformat(), "shift": r.shift,
                   "temperature": r.temperature, "vibration": r.vibration,
                   "rpm": r.rpm, "motor_current": r.motor_current,
                   "health_score": r.health_score, "is_anomaly": r.is_anomaly}
                  for r in rows]
        anom   = [x for x in rdicts if x["is_anomaly"]]
        result = generate_failure_story(machine_id, rdicts, anomaly_readings=anom)
        result["machine_id"] = machine_id
        result["timestamp"]  = datetime.now(timezone.utc).isoformat()
        save_failure_story(db, result)
        return result


# ── Anomaly Model ──────────────────────────────────────────────────
@app.post("/api/machine/{machine_id}/train", tags=["ml"])
def train_model(machine_id: str):
    with get_db() as db:
        rows = get_recent_readings(db, machine_id, limit=500)
    if len(rows) < 50:
        raise HTTPException(400, f"Need ≥50 readings, have {len(rows)}")
    rdicts = [{"timestamp": r.timestamp.isoformat(), "shift": r.shift,
               "temperature": r.temperature, "vibration": r.vibration,
               "rpm": r.rpm, "motor_current": r.motor_current,
               "health_score": r.health_score} for r in rows]
    result = train_detector(rdicts)
    return result


@app.get("/api/ml/status", tags=["ml"])
def ml_status():
    return get_detector().info()


# ── Maintenance ────────────────────────────────────────────────────
@app.get("/api/machine/{machine_id}/maintenance", tags=["maintenance"])
def get_maintenance(machine_id: str):
    with get_db() as db:
        logs     = get_maintenance_history(db, machine_id)
        patterns = get_recurring_patterns(db, machine_id)
    return {
        "machine_id": machine_id,
        "logs": [{"id": l.id, "timestamp": l.timestamp.isoformat(),
                  "type": l.maintenance_type, "description": l.description,
                  "performed_by": l.performed_by, "health_before": l.health_before,
                  "health_after": l.health_after} for l in logs],
        "recurring_patterns": patterns,
    }


@app.post("/api/machine/{machine_id}/maintenance", tags=["maintenance"])
def add_maintenance(machine_id: str, entry: MaintenanceCreate):
    with get_db() as db:
        latest = get_latest_reading(db, machine_id)
        data = entry.model_dump()
        data["machine_id"]    = machine_id
        data["timestamp"]     = datetime.now(timezone.utc).isoformat()
        data["health_before"] = latest.health_score if latest else None
        save_maintenance_log(db, data)
    return {"status": "logged", "machine_id": machine_id}


# ── Copilot ────────────────────────────────────────────────────────
@app.post("/api/copilot", response_model=CopilotResponse, tags=["copilot"])
def copilot(req: CopilotRequest):
    try:
        answer = ask_copilot(req.question, req.machine_id)
    except Exception as e:
        raise HTTPException(500, f"Copilot error: {e}")
    return CopilotResponse(answer=answer, question=req.question,
                           machine_id=req.machine_id, grounded=True)


@app.get("/api/copilot/questions", tags=["copilot"])
def copilot_questions():
    return {"questions": [
        "Why is this machine overheating?",
        "What caused the latest anomaly?",
        "What maintenance should I perform?",
        "What is the current health status?",
        "Generate a quick maintenance report",
    ]}


@app.get("/api/machine/{machine_id}/work-order", tags=["copilot"])
def get_work_order(machine_id: str):
    try:
        ticket = generate_work_order(machine_id)
        return {"machine_id": machine_id, "work_order": ticket}
    except Exception as e:
        raise HTTPException(500, f"Error: {e}")


# ── PPE Violations ─────────────────────────────────────────────────
@app.post("/api/violations", tags=["vision"])
def log_violation(violation: str, shift: str = ""):
    with get_db() as db:
        from backend.database import Base
        from sqlalchemy import text
        db.execute(text(
            "INSERT INTO ppe_violations (machine_id, violation, shift, created_at) "
            "VALUES (:m, :v, :s, :t)"
        ), {"m": MACHINE_ID, "v": violation, "s": shift,
            "t": datetime.now(timezone.utc).isoformat()})
    return {"status": "logged", "violation": violation}


@app.get("/api/violations", tags=["vision"])
def get_violations(limit: int = 20):
    with get_db() as db:
        from sqlalchemy import text
        rows = db.execute(text(
            "SELECT * FROM ppe_violations ORDER BY id DESC LIMIT :n"
        ), {"n": limit}).fetchall()
    return {"violations": [dict(r._mapping) for r in rows]}


@app.get("/api/machine/{machine_id}/safety", tags=["vision"])
def get_machine_safety(machine_id: str, limit: int = 10):
    with get_db() as db:
        return get_safety_summary(db, machine_id, limit=limit)
