import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.notifications import build_notifications


def test_build_notifications_for_alerts_and_anomaly():
    notifications = build_notifications(
        "machine_001",
        {"temperature": 82, "vibration": 6.5, "health_score": 42, "is_anomaly": True},
        [{"severity": "critical", "message": "High vibration", "acknowledged": False}],
    )

    assert any(item["type"] == "anomaly" for item in notifications)
    assert any(item["type"] == "warning" for item in notifications)
    assert notifications[0]["title"]
