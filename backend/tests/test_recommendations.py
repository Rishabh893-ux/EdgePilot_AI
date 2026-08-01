import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.recommendations import generate_recommendations


def test_recommendations_for_risk_signals():
    recommendations = generate_recommendations(
        "machine_001",
        {"temperature": 82, "vibration": 6.5, "health_score": 42},
        [{"severity": "critical", "message": "High vibration"}],
    )

    assert any(item["priority"] == "high" for item in recommendations)
    assert any("bearing" in item["title"].lower() or "cooling" in item["title"].lower() for item in recommendations)
