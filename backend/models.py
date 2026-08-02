"""EdgePilot AI — Pydantic Schemas"""
from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, ConfigDict


class SensorReadingOut(BaseModel):
    id: int
    machine_id: str
    timestamp: datetime
    shift: str
    temperature: float
    vibration: float
    rpm: float
    motor_current: float
    health_score: float
    is_anomaly: bool
    local_anomaly: Optional[bool] = False
    anomaly_score: Optional[float]
    power_kw: Optional[float] = None
    carbon_emission: Optional[float] = None
    acoustic_freq: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)


class AlertOut(BaseModel):
    id: int
    machine_id: str
    timestamp: datetime
    alert_type: str
    severity: str
    parameter: str
    message: str
    current_value: float
    threshold_value: float
    hours_until_breach: Optional[float]
    acknowledged: bool
    model_config = ConfigDict(from_attributes=True)


class MaintenanceCreate(BaseModel):
    machine_id: str = "machine_001"
    maintenance_type: str = "inspection"
    description: str
    performed_by: Optional[str] = None
    health_before: Optional[float] = None
    health_after: Optional[float] = None
    cost_estimate: Optional[float] = None
    duration_hours: Optional[float] = None
    notes: Optional[str] = None


class MaintenanceOut(MaintenanceCreate):
    id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)


class FailureStoryOut(BaseModel):
    id: int
    machine_id: str
    timestamp: datetime
    story: str
    root_cause: Optional[str]
    contributing_factors: Optional[str]
    health_at_failure: Optional[float]
    model_config = ConfigDict(from_attributes=True)


class CopilotRequest(BaseModel):
    machine_id: str = "machine_001"
    question: str


class CopilotResponse(BaseModel):
    answer: str
    question: str
    machine_id: str
    grounded: bool = True


class DashboardResponse(BaseModel):
    machine_id: str
    machineiq_score: float
    temperature: float
    vibration: float
    rpm: float
    motor_current: float
    shift: str
    is_anomaly: bool
    rul_days: int
    active_alerts: int
    total_readings: int
    last_updated: datetime
    power_kw: Optional[float] = None
    carbon_emission: Optional[float] = None
    recent_readings: List[Dict[str, Any]] = []
    recent_alerts: List[Dict[str, Any]] = []


class SystemStatus(BaseModel):
    status: str
    mqtt_connected: bool
    readings_processed: int
    model_trained: bool
    active_alerts: int
    db_path: str


class ThresholdConfigUpdate(BaseModel):
    machine_id: str
    parameter: str
    warning: Optional[float] = None
    critical: Optional[float] = None
    warning_low: Optional[float] = None
    warning_high: Optional[float] = None
