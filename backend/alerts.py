"""
EdgePilot AI — Predictive Alert Engine
Fires alerts BEFORE thresholds are crossed using linear regression on sensor trends.
Also generates human-readable Failure Stories.
"""

import os
import time
import numpy as np
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
from dotenv import load_dotenv
import threading
import requests

load_dotenv(Path(__file__).parent.parent / ".env")

# ── PARAMETER CONFIG ──────────────────────────────────────────────
PARAMETER_CONFIG = {
    "temperature": {
        "warning":      float(os.getenv("TEMP_WARNING",       "70.0")),
        "critical":     float(os.getenv("TEMP_CRITICAL",      "80.0")),
        "unit":         "C",
        "direction":    "increasing",
        "friendly_name":"Temperature",
    },
    "vibration": {
        "warning":      float(os.getenv("VIBRATION_WARNING",  "4.5")),
        "critical":     float(os.getenv("VIBRATION_CRITICAL", "6.0")),
        "unit":         "mm/s",
        "direction":    "increasing",
        "friendly_name":"Vibration",
    },
    "rpm": {
        "warning_low":  float(os.getenv("RPM_WARNING_LOW",    "1400")),
        "warning_high": float(os.getenv("RPM_WARNING_HIGH",   "1600")),
        "unit":         "RPM",
        "direction":    "both",
        "friendly_name":"Motor RPM",
    },
    "motor_current": {
        "warning":      float(os.getenv("CURRENT_WARNING",    "15.0")),
        "critical":     float(os.getenv("CURRENT_CRITICAL",   "20.0")),
        "unit":         "A",
        "direction":    "increasing",
        "friendly_name":"Motor Current",
    },
    "health_score": {
        "warning":      float(os.getenv("HEALTH_WARNING",     "70")),
        "critical":     float(os.getenv("HEALTH_CRITICAL",    "50")),
        "unit":         "%",
        "direction":    "decreasing",
        "friendly_name":"Health Score",
    },
}

HORIZON_HOURS  = float(os.getenv("PREDICTION_HORIZON_HOURS", "6"))
MIN_R2         = 0.25
ALERT_COOLDOWN = 300   # 5 minutes between same alert type

# Cooldown tracker
_last_fired: Dict[str, float] = {}


def _can_fire(key: str) -> bool:
    """Check alert cooldown to avoid spamming same alert."""
    now = time.time()
    if now - _last_fired.get(key, 0) > ALERT_COOLDOWN:
        _last_fired[key] = now
        return True
    return False


def _linear_regression(x: np.ndarray, y: np.ndarray) -> Tuple[float, float, float]:
    """
    Simple linear regression.
    Returns (slope, intercept, r_squared).
    """
    n = len(x)
    if n < 2:
        return 0.0, float(y[0]) if n == 1 else 0.0, 0.0

    sx  = x.sum()
    sy  = y.sum()
    sxy = (x * y).sum()
    sx2 = (x * x).sum()
    den = n * sx2 - sx * sx

    if den == 0:
        return 0.0, float(sy / n), 0.0

    slope     = (n * sxy - sx * sy) / den
    intercept = (sy - slope * sx) / n
    y_pred    = slope * x + intercept
    ss_res    = ((y - y_pred) ** 2).sum()
    ss_tot    = ((y - y.mean()) ** 2).sum()
    r2        = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return float(slope), float(intercept), float(r2)


def _hours_to_breach(
    values: List[float],
    timestamps: List[datetime],
    threshold: float,
    direction: str,
) -> Tuple[Optional[float], Optional[datetime], float]:
    """
    Predict hours until a value crosses a threshold.
    Returns (hours, breach_datetime, r_squared) or (None, None, r2).
    """
    if len(values) < 4:
        return None, None, 0.0

    t0 = timestamps[0]
    x  = np.array([(ts - t0).total_seconds() / 3600.0 for ts in timestamps])
    y  = np.array(values, dtype=float)

    slope, intercept, r2 = _linear_regression(x, y)

    if r2 < MIN_R2 or slope == 0:
        return None, None, r2

    x_current   = x[-1]
    val_current = y[-1]

    if direction == "increasing":
        if slope <= 0 or val_current >= threshold:
            return None, None, r2
        hours = (threshold - val_current) / slope

    elif direction == "decreasing":
        if slope >= 0 or val_current <= threshold:
            return None, None, r2
        hours = (threshold - val_current) / slope

    else:
        return None, None, r2

    if hours < 0 or hours > HORIZON_HOURS:
        return None, None, r2

    breach_dt = datetime.now(timezone.utc) + timedelta(hours=hours)
    return round(hours, 2), breach_dt, r2


def _build_alert(
    machine_id: str,
    param: str,
    severity: str,
    cfg: dict,
    current: float,
    threshold: float,
    hours: Optional[float],
    breach_time: Optional[datetime],
) -> dict:
    """Build a single alert dictionary ready to save to DB."""
    name = cfg["friendly_name"]
    unit = cfg["unit"]

    if hours is None or hours == 0:
        msg = (
            f"{'CRITICAL' if severity == 'critical' else 'WARNING'}: "
            f"{name} is {current:.1f}{unit} "
            f"(threshold: {threshold:.1f}{unit})"
        )
        alert_type = "threshold"
    else:
        msg = (
            f"PREDICTIVE {'CRITICAL' if severity == 'critical' else 'WARNING'}: "
            f"{name} will reach {threshold:.1f}{unit} "
            f"in ~{hours:.1f}h (currently {current:.1f}{unit})"
        )
        alert_type = "trend"

    alert_dict = {
        "machine_id":           machine_id,
        "timestamp":            datetime.now(timezone.utc).isoformat(),
        "alert_type":           alert_type,
        "severity":             severity,
        "parameter":            param,
        "message":              msg,
        "current_value":        current,
        "threshold_value":      threshold,
        "hours_until_breach":   hours if hours and hours > 0 else None,
        "predicted_breach_time":breach_time.isoformat() if breach_time else None,
    }

    if severity == "critical":
        def _fire_webhook():
            try:
                # Mock webhook for automated ticketing
                requests.post("http://localhost:8000/api/mock/webhook", json=alert_dict, timeout=1)
            except Exception:
                pass
            print(f"\n[WEBHOOK] Automated Maintenance Ticket created: {msg}\n")
        
        threading.Thread(target=_fire_webhook).start()

    return alert_dict


def generate_trend_alerts(
    machine_id: str,
    readings: List[dict],
    existing_alerts: List[dict] = [],
    db = None
) -> List[dict]:
    """
    Analyse recent readings and generate new predictive alerts.
    existing_alerts is used to avoid duplicate types.
    Returns list of alert dicts (not yet saved to DB).
    """
    if len(readings) < 6:
        return []

    timestamps = []
    for r in readings:
        ts = r.get("timestamp")
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        elif not isinstance(ts, datetime):
            ts = datetime.now(timezone.utc)
        timestamps.append(ts)

    # Fetch custom thresholds from DB
    custom_thresholds = {}
    if db is not None:
        from backend.database import get_threshold_configs
        configs = get_threshold_configs(db, machine_id)
        for c in configs:
            custom_thresholds[c.parameter] = {
                "warning": c.warning,
                "critical": c.critical,
                "warning_low": c.warning_low,
                "warning_high": c.warning_high,
            }

    new_alerts = []

    for param, default_cfg in PARAMETER_CONFIG.items():
        cfg = dict(default_cfg)
        if param in custom_thresholds:
            for k, v in custom_thresholds[param].items():
                if v is not None:
                    cfg[k] = v
                    
        direction = cfg["direction"]
        values    = [r.get(param, 0) for r in readings]

        if direction == "both":
            # RPM — check both falling below min and rising above max
            for thresh, dir_ in [
                (cfg["warning_low"],  "decreasing"),
                (cfg["warning_high"], "increasing"),
            ]:
                hours, breach_time, r2 = _hours_to_breach(values, timestamps, thresh, dir_)
                if hours is not None:
                    key = f"{machine_id}_{param}_{dir_}_trend"
                    if _can_fire(key):
                        new_alerts.append(_build_alert(
                            machine_id, param, "warning",
                            cfg, values[-1], thresh, hours, breach_time,
                        ))

        else:
            # Check critical first, then warning (only fire worst)
            fired = False
            for level in ["critical", "warning"]:
                thresh = cfg.get(level)
                if thresh is None:
                    continue
                hours, breach_time, r2 = _hours_to_breach(
                    values, timestamps, thresh, direction
                )
                if hours is not None:
                    key = f"{machine_id}_{param}_{level}_trend"
                    if _can_fire(key):
                        new_alerts.append(_build_alert(
                            machine_id, param, level,
                            cfg, values[-1], thresh, hours, breach_time,
                        ))
                    fired = True
                    break  # only fire worst severity

            # Immediate threshold breach (no trend needed)
            current = values[-1]
            if not fired:
                if direction == "increasing":
                    if current >= cfg.get("critical", 9999):
                        key = f"{machine_id}_{param}_crit_now"
                        if _can_fire(key):
                            new_alerts.append(_build_alert(
                                machine_id, param, "critical",
                                cfg, current, cfg["critical"], 0, None,
                            ))
                    elif current >= cfg.get("warning", 9999):
                        key = f"{machine_id}_{param}_warn_now"
                        if _can_fire(key):
                            new_alerts.append(_build_alert(
                                machine_id, param, "warning",
                                cfg, current, cfg["warning"], 0, None,
                            ))
                elif direction == "decreasing":
                    if current <= cfg.get("critical", -9999):
                        key = f"{machine_id}_{param}_crit_now"
                        if _can_fire(key):
                            new_alerts.append(_build_alert(
                                machine_id, param, "critical",
                                cfg, current, cfg["critical"], 0, None,
                            ))
                    elif current <= cfg.get("warning", -9999):
                        key = f"{machine_id}_{param}_warn_now"
                        if _can_fire(key):
                            new_alerts.append(_build_alert(
                                machine_id, param, "warning",
                                cfg, current, cfg["warning"], 0, None,
                            ))

    return new_alerts


def check_threshold_breach(param: str, value: float) -> Tuple[Optional[str], Optional[str]]:
    """
    Quick per-reading threshold check.
    Returns (alert_type, severity) or (None, None).
    """
    cfg = PARAMETER_CONFIG.get(param)
    if not cfg:
        return None, None

    direction = cfg["direction"]

    if direction == "increasing":
        if value >= cfg.get("critical", 9999):
            return "threshold", "critical"
        if value >= cfg.get("warning", 9999):
            return "threshold", "warning"

    elif direction == "decreasing":
        if value <= cfg.get("critical", -9999):
            return "threshold", "critical"
        if value <= cfg.get("warning", -9999):
            return "threshold", "warning"

    elif direction == "both":
        if value <= cfg.get("warning_low", -9999):
            return "threshold", "warning"
        if value >= cfg.get("warning_high", 9999):
            return "threshold", "warning"

    return None, None


def generate_failure_story(
    machine_id: str,
    readings: List[dict],
    trigger_alert: dict = None,
    anomaly_readings: List[dict] = [],
) -> dict:
    """
    Generate a plain-language Failure Story from sensor history.
    Returns dict with story, root_cause, contributing_factors, health_at_failure.
    """
    if not readings:
        return {
            "story":                "No sensor data available for analysis.",
            "root_cause":           None,
            "contributing_factors": [],
            "health_at_failure":    None,
        }

    n      = len(readings)
    first  = readings[0]
    last   = readings[-1]

    avg_temp   = sum(r.get("temperature",   0) for r in readings) / n
    avg_vib    = sum(r.get("vibration",     0) for r in readings) / n
    avg_health = sum(r.get("health_score",  0) for r in readings) / n

    temp_delta   = last.get("temperature",  0) - first.get("temperature",  0)
    vib_delta    = last.get("vibration",    0) - first.get("vibration",    0)
    health_delta = last.get("health_score", 0) - first.get("health_score", 0)

    # Build contributing factors list
    factors = []
    if temp_delta > 3:
        factors.append(
            f"Temperature rose {temp_delta:.1f}C "
            f"({first.get('temperature',0):.1f} to {last.get('temperature',0):.1f}C)"
        )
    if vib_delta > 0.3:
        factors.append(
            f"Vibration increased {vib_delta:.2f} mm/s "
            f"({first.get('vibration',0):.2f} to {last.get('vibration',0):.2f} mm/s)"
        )
    if health_delta < -5:
        factors.append(
            f"MachineIQ Score fell {abs(health_delta):.0f} points "
            f"({first.get('health_score',0):.0f} to {last.get('health_score',0):.0f})"
        )
    if len(anomaly_readings) >= 3:
        factors.append(
            f"{len(anomaly_readings)} anomaly readings detected by ML model"
        )

    # Determine root cause
    current_temp   = last.get("temperature",  0)
    current_vib    = last.get("vibration",    0)
    current_health = last.get("health_score", 0)

    if current_temp > 75:
        root_cause = "Thermal stress or cooling system issue"
    elif current_vib > 4.0:
        root_cause = "Mechanical imbalance or bearing wear"
    elif current_health < 55:
        root_cause = "Multi-parameter degradation — service required immediately"
    elif temp_delta > 5 and vib_delta > 0.5:
        root_cause = "Combined thermal and mechanical stress"
    else:
        root_cause = "Gradual mechanical degradation — monitor closely"

    trend_str = ", and ".join(factors) if factors else "no major trend detected"

    story = (
        f"Failure Story for {machine_id}\n\n"
        f"Over the monitored period, {trend_str}. "
        f"Average temperature was {avg_temp:.1f}C with average vibration {avg_vib:.2f} mm/s. "
        f"MachineIQ Score averaged {avg_health:.0f} out of 100. "
        f"Root cause identified as: {root_cause}. "
        f"Recommendation: inspect bearing assembly, check coolant levels, "
        f"and perform lubrication before the next production shift."
    )

    return {
        "story":                story,
        "root_cause":           root_cause,
        "contributing_factors": factors,
        "health_at_failure":    current_health,
    }
