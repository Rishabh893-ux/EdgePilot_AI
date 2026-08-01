from typing import List, Dict, Any


def build_notifications(machine_id: str, metrics: dict, alerts: List[dict]) -> List[Dict[str, Any]]:
    notifications: List[Dict[str, Any]] = []

    if metrics.get("is_anomaly"):
        notifications.append({
            "id": f"{machine_id}-anomaly",
            "type": "anomaly",
            "title": "Anomaly detected",
            "message": "The machine is exhibiting abnormal conditions and should be inspected immediately.",
            "priority": "high",
        })

    if metrics.get("temperature", 0) > 75 or metrics.get("vibration", 0) > 5.5:
        notifications.append({
            "id": f"{machine_id}-warning",
            "type": "warning",
            "title": "Critical threshold approached",
            "message": "Temperature or vibration has crossed the warning band and needs attention.",
            "priority": "medium",
        })

    for alert in alerts:
        if not alert.get("acknowledged", False):
            notifications.append({
                "id": f"{machine_id}-{alert.get('severity', 'alert')}",
                "type": "alert",
                "title": "Open alert",
                "message": alert.get("message", "A new alert requires action."),
                "priority": "high" if alert.get("severity") == "critical" else "medium",
            })
            break

    if not notifications:
        notifications.append({
            "id": f"{machine_id}-ok",
            "type": "info",
            "title": "All systems normal",
            "message": "No critical issues detected at the moment.",
            "priority": "low",
        })

    return notifications
