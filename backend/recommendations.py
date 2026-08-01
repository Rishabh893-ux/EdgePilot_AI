from typing import List, Dict, Any


def generate_recommendations(machine_id: str, metrics: dict, alerts: List[dict]) -> List[Dict[str, Any]]:
    recommendations: List[Dict[str, Any]] = []

    if metrics.get("temperature", 0) > 75:
        recommendations.append({
            "title": "Inspect cooling system",
            "description": "Temperature is above warning threshold; inspect coolant flow and radiator performance.",
            "priority": "high",
            "machine_id": machine_id,
        })

    if metrics.get("vibration", 0) > 5.5:
        recommendations.append({
            "title": "Check bearing alignment",
            "description": "Vibration is elevated; inspect bearings, alignment, and mounting integrity.",
            "priority": "high",
            "machine_id": machine_id,
        })

    if metrics.get("health_score", 100) < 60:
        recommendations.append({
            "title": "Schedule preventive maintenance",
            "description": "Machine health is declining; plan a service inspection soon.",
            "priority": "medium",
            "machine_id": machine_id,
        })

    if not recommendations:
        recommendations.append({
            "title": "Continue normal monitoring",
            "description": "No immediate intervention needed; maintain observation cadence.",
            "priority": "low",
            "machine_id": machine_id,
        })

    return recommendations
