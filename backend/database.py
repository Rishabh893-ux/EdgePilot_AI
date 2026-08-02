"""
EdgePilot AI — Database Layer (patched to add ppe_violations table)
"""
import os, json
from datetime import datetime, timezone, timedelta
from contextlib import contextmanager
from typing import Optional, List
from pathlib import Path

from sqlalchemy import (
    create_engine, Column, Integer, Float, String,
    DateTime, Text, Boolean, Index, func, desc
)
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.pool import StaticPool
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./edgepilot.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    bind=engine
)
Base = declarative_base()

class SensorReading(Base):
    __tablename__ = "sensor_readings"
    id            = Column(Integer, primary_key=True, index=True)
    machine_id    = Column(String(50), index=True)
    timestamp     = Column(DateTime(timezone=True), index=True)
    shift         = Column(String(20))
    temperature   = Column(Float)
    vibration     = Column(Float)
    rpm           = Column(Float)
    motor_current = Column(Float)
    health_score  = Column(Float)
    reading_id    = Column(Integer, default=0)
    is_anomaly    = Column(Boolean, default=False, index=True)
    anomaly_score = Column(Float, nullable=True)
    local_anomaly = Column(Boolean, default=False)
    power_kw      = Column(Float, nullable=True)
    carbon_emission = Column(Float, nullable=True)
    acoustic_freq = Column(Float, nullable=True)

class Alert(Base):
    __tablename__ = "alerts"
    id                    = Column(Integer, primary_key=True, index=True)
    machine_id            = Column(String(50), index=True)
    timestamp             = Column(DateTime(timezone=True), index=True)
    alert_type            = Column(String(50))
    severity              = Column(String(20))
    parameter             = Column(String(50))
    message               = Column(Text)
    current_value         = Column(Float)
    threshold_value       = Column(Float)
    hours_until_breach    = Column(Float, nullable=True)
    predicted_breach_time = Column(DateTime(timezone=True), nullable=True)
    acknowledged          = Column(Boolean, default=False)
    acknowledged_at       = Column(DateTime(timezone=True), nullable=True)

class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"
    id               = Column(Integer, primary_key=True, index=True)
    machine_id       = Column(String(50), index=True)
    timestamp        = Column(DateTime(timezone=True), index=True)
    maintenance_type = Column(String(50))
    description      = Column(Text)
    performed_by     = Column(String(100), nullable=True)
    health_before    = Column(Float, nullable=True)
    health_after     = Column(Float, nullable=True)
    cost_estimate    = Column(Float, nullable=True)
    duration_hours   = Column(Float, nullable=True)
    notes            = Column(Text, nullable=True)

class FailureStory(Base):
    __tablename__ = "failure_stories"
    id                   = Column(Integer, primary_key=True, index=True)
    machine_id           = Column(String(50), index=True)
    timestamp            = Column(DateTime(timezone=True), index=True)
    story                = Column(Text)
    root_cause           = Column(String(200), nullable=True)
    contributing_factors = Column(Text, nullable=True)
    health_at_failure    = Column(Float, nullable=True)
    trigger_alert_id     = Column(Integer, nullable=True)

class ShiftBaseline(Base):
    __tablename__ = "shift_baselines"
    id         = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String(50), index=True)
    shift      = Column(String(20))
    parameter  = Column(String(50))
    mean       = Column(Float)
    std        = Column(Float)
    updated_at = Column(DateTime(timezone=True))

class CopilotContext(Base):
    __tablename__ = "copilot_context"
    id         = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String(50), index=True)
    context    = Column(Text)
    updated_at = Column(DateTime(timezone=True))

class PPEViolation(Base):
    __tablename__ = "ppe_violations"
    id         = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String(50))
    violation  = Column(Text)
    shift      = Column(String(20), nullable=True)
    created_at = Column(String(50))

class ThresholdConfig(Base):
    __tablename__ = "threshold_configs"
    id           = Column(Integer, primary_key=True, index=True)
    machine_id   = Column(String(50), index=True)
    parameter    = Column(String(50))
    warning      = Column(Float, nullable=True)
    critical     = Column(Float, nullable=True)
    warning_low  = Column(Float, nullable=True)
    warning_high = Column(Float, nullable=True)
    updated_at   = Column(DateTime(timezone=True))

def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Seed mock safety data if empty
    db = SessionLocal()
    try:
        if db.query(PPEViolation).count() == 0:
            ts = datetime.now(timezone.utc).isoformat()
            db.add(PPEViolation(machine_id="machine_001", violation="Worker spotted without helmet near Conveyor Belt", shift="morning", created_at=ts))
            db.add(PPEViolation(machine_id="machine_001", violation="No Hi-Vis vest detected in Zone B", shift="afternoon", created_at=ts))
            db.add(PPEViolation(machine_id="machine_001", violation="Technician not wearing safety goggles", shift="night", created_at=ts))
            
        if db.query(MaintenanceLog).count() == 0:
            ts = datetime.now(timezone.utc)
            db.add(MaintenanceLog(machine_id="machine_001", timestamp=ts, maintenance_type="inspection", description="Weekly routine inspection", performed_by="operator", health_before=95, health_after=97, duration_hours=1))
            db.add(MaintenanceLog(machine_id="machine_001", timestamp=ts, maintenance_type="preventive", description="Replaced primary filter and lubricated joints", performed_by="admin", health_before=82, health_after=95, duration_hours=2))
        
        db.commit()
    except Exception as e:
        db.rollback()
    finally:
        db.close()
        
    print("[OK] Database initialised -> edgepilot.db")

@contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def save_reading(db: Session, data: dict):
    ts = data.get("timestamp")
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    r = SensorReading(
        machine_id=data["machine_id"], timestamp=ts,
        shift=data.get("shift","morning"), temperature=data["temperature"],
        vibration=data["vibration"], rpm=data["rpm"],
        motor_current=data["motor_current"], health_score=data["health_score"],
        reading_id=data.get("reading_id",0), is_anomaly=False,
        local_anomaly=data.get("local_anomaly", False),
        power_kw=data.get("power_kw", data.get("power_draw_kw")),
        carbon_emission=data.get("carbon_emission"),
        acoustic_freq=data.get("acoustic_freq"),
    )
    db.add(r); db.flush(); return r

def update_anomaly_flags(db: Session, reading_id: int, is_anomaly: bool, score: float):
    db.query(SensorReading).filter(SensorReading.id==reading_id).update(
        {"is_anomaly": is_anomaly, "anomaly_score": score})

def get_latest_reading(db: Session, machine_id: str):
    return (db.query(SensorReading).filter(SensorReading.machine_id==machine_id)
              .order_by(desc(SensorReading.timestamp)).first())

def get_machine_ids(db: Session):
    return [row[0] for row in db.query(SensorReading.machine_id).distinct().order_by(SensorReading.machine_id).all()]

def get_recent_readings(db: Session, machine_id: str, limit: int=50):
    rows = (db.query(SensorReading).filter(SensorReading.machine_id==machine_id)
              .order_by(desc(SensorReading.timestamp)).limit(limit).all())
    return list(reversed(rows))

def get_readings_for_trend(db: Session, machine_id: str, window: int=20):
    rows = (db.query(SensorReading).filter(SensorReading.machine_id==machine_id)
              .order_by(desc(SensorReading.timestamp)).limit(window).all())
    return list(reversed(rows))

def get_health_stats(db: Session, machine_id: str, hours: int=24):
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    r = (db.query(func.min(SensorReading.health_score),
                  func.max(SensorReading.health_score),
                  func.avg(SensorReading.health_score),
                  func.count(SensorReading.id))
           .filter(SensorReading.machine_id==machine_id, SensorReading.timestamp>=since)
           .first())
    return {"min": r[0], "max": r[1], "avg": r[2], "count": r[3]}

def save_alert(db: Session, data: dict):
    ts = data.get("timestamp")
    if isinstance(ts, str): ts = datetime.fromisoformat(ts.replace("Z","+00:00"))
    elif ts is None: ts = datetime.now(timezone.utc)
    pbt = data.get("predicted_breach_time")
    if isinstance(pbt, str): pbt = datetime.fromisoformat(pbt.replace("Z","+00:00"))
    a = Alert(machine_id=data["machine_id"], timestamp=ts,
              alert_type=data["alert_type"], severity=data["severity"],
              parameter=data["parameter"], message=data["message"],
              current_value=data.get("current_value",0),
              threshold_value=data.get("threshold_value",0),
              hours_until_breach=data.get("hours_until_breach"),
              predicted_breach_time=pbt, acknowledged=False)
    db.add(a); db.flush(); return a

def get_recent_alerts(db: Session, machine_id: str, limit: int=20):
    return (db.query(Alert).filter(Alert.machine_id==machine_id)
              .order_by(desc(Alert.timestamp)).limit(limit).all())

def get_unacknowledged_alerts(db: Session, machine_id: str):
    return (db.query(Alert).filter(Alert.machine_id==machine_id,
                                   Alert.acknowledged==False)
              .order_by(desc(Alert.timestamp)).all())

def acknowledge_alert(db: Session, alert_id: int):
    a = db.query(Alert).filter(Alert.id==alert_id).first()
    if a:
        a.acknowledged=True; a.acknowledged_at=datetime.now(timezone.utc); return True
    return False

def save_maintenance_log(db: Session, data: dict):
    ts = data.get("timestamp")
    if isinstance(ts, str): ts = datetime.fromisoformat(ts.replace("Z","+00:00"))
    elif ts is None: ts = datetime.now(timezone.utc)
    m = MaintenanceLog(machine_id=data["machine_id"], timestamp=ts,
        maintenance_type=data.get("maintenance_type","inspection"),
        description=data["description"], performed_by=data.get("performed_by"),
        health_before=data.get("health_before"), health_after=data.get("health_after"),
        cost_estimate=data.get("cost_estimate"), duration_hours=data.get("duration_hours"),
        notes=data.get("notes"))
    db.add(m); db.flush(); return m

def get_maintenance_history(db: Session, machine_id: str, limit: int=20):
    return (db.query(MaintenanceLog).filter(MaintenanceLog.machine_id==machine_id)
              .order_by(desc(MaintenanceLog.timestamp)).limit(limit).all())

def get_recurring_patterns(db: Session, machine_id: str):
    logs = get_maintenance_history(db, machine_id, 50)
    patterns = {}
    for l in logs:
        day = l.timestamp.strftime("%A"); key = f"{day}_{l.maintenance_type}"
        if key not in patterns:
            patterns[key] = {"day": day, "type": l.maintenance_type, "count": 0, "descriptions": []}
        patterns[key]["count"] += 1; patterns[key]["descriptions"].append(l.description)
    return [p for p in patterns.values() if p["count"] >= 2]

def save_failure_story(db: Session, data: dict):
    ts = data.get("timestamp")
    if isinstance(ts, str): ts = datetime.fromisoformat(ts.replace("Z","+00:00"))
    elif ts is None: ts = datetime.now(timezone.utc)
    cf = data.get("contributing_factors", [])
    fs = FailureStory(machine_id=data["machine_id"], timestamp=ts,
         story=data["story"], root_cause=data.get("root_cause"),
         contributing_factors=json.dumps(cf),
         health_at_failure=data.get("health_at_failure"),
         trigger_alert_id=data.get("trigger_alert_id"))
    db.add(fs); db.flush(); return fs

def get_latest_failure_story(db: Session, machine_id: str):
    return (db.query(FailureStory).filter(FailureStory.machine_id==machine_id)
              .order_by(desc(FailureStory.timestamp)).first())

def update_copilot_context(db: Session, machine_id: str, readings: list):
    ctx = db.query(CopilotContext).filter(CopilotContext.machine_id==machine_id).first()
    payload = json.dumps([
        {"timestamp": r.timestamp.isoformat(), "temperature": r.temperature,
         "vibration": r.vibration, "rpm": r.rpm,
         "health_score": r.health_score, "shift": r.shift}
        for r in readings[-48:]
    ])
    if ctx: ctx.context=payload; ctx.updated_at=datetime.now(timezone.utc)
    else: db.add(CopilotContext(machine_id=machine_id, context=payload,
                                updated_at=datetime.now(timezone.utc)))

def get_copilot_context(db: Session, machine_id: str):
    ctx = db.query(CopilotContext).filter(CopilotContext.machine_id==machine_id).first()
    return ctx.context if ctx else None

def get_safety_summary(db: Session, machine_id: str, limit: int = 10):
    rows = (db.query(PPEViolation)
            .filter(PPEViolation.machine_id == machine_id)
            .order_by(desc(PPEViolation.id))
            .limit(limit)
            .all())
    latest = rows[0].violation if rows else None
    status = "critical" if len(rows) >= 3 else "attention" if rows else "ok"
    return {
        "machine_id": machine_id,
        "violation_count": len(rows),
        "latest_violation": latest,
        "status": status,
        "recent_violations": [r.violation for r in rows],
    }

def update_shift_baseline(db: Session, machine_id: str, shift: str, parameter: str, value: float):
    b = (db.query(ShiftBaseline)
           .filter(ShiftBaseline.machine_id==machine_id,
                   ShiftBaseline.shift==shift, ShiftBaseline.parameter==parameter).first())
    if b:
        alpha=0.05; b.mean=(1-alpha)*b.mean+alpha*value
        b.std=(1-alpha)*b.std+alpha*abs(value-b.mean)
        b.updated_at=datetime.now(timezone.utc)
    else:
        db.add(ShiftBaseline(machine_id=machine_id, shift=shift, parameter=parameter,
                             mean=value, std=value*0.05, updated_at=datetime.now(timezone.utc)))

def get_threshold_configs(db: Session, machine_id: str):
    return db.query(ThresholdConfig).filter(ThresholdConfig.machine_id == machine_id).all()

def save_threshold_config(db: Session, data: dict):
    t = db.query(ThresholdConfig).filter(
        ThresholdConfig.machine_id == data["machine_id"],
        ThresholdConfig.parameter == data["parameter"]
    ).first()
    if t:
        if "warning" in data: t.warning = data["warning"]
        if "critical" in data: t.critical = data["critical"]
        if "warning_low" in data: t.warning_low = data["warning_low"]
        if "warning_high" in data: t.warning_high = data["warning_high"]
        t.updated_at = datetime.now(timezone.utc)
    else:
        t = ThresholdConfig(
            machine_id=data["machine_id"], parameter=data["parameter"],
            warning=data.get("warning"), critical=data.get("critical"),
            warning_low=data.get("warning_low"), warning_high=data.get("warning_high"),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(t)
    db.flush()
    return t
