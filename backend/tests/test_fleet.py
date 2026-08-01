from datetime import datetime, timezone

from backend.database import SensorReading, get_db, get_machine_ids


def test_get_machine_ids_returns_distinct_machine_ids():
    with get_db() as db:
        db.query(SensorReading).delete(synchronize_session=False)
        db.commit()

        db.add_all([
            SensorReading(
                machine_id="machine_001",
                timestamp=datetime.now(timezone.utc),
                shift="morning",
                temperature=63.0,
                vibration=1.8,
                rpm=1480.0,
                motor_current=12.0,
                health_score=92.0,
                reading_id=1,
                is_anomaly=False,
            ),
            SensorReading(
                machine_id="machine_002",
                timestamp=datetime.now(timezone.utc),
                shift="afternoon",
                temperature=67.0,
                vibration=2.1,
                rpm=1510.0,
                motor_current=13.2,
                health_score=88.0,
                reading_id=2,
                is_anomaly=False,
            ),
            SensorReading(
                machine_id="machine_001",
                timestamp=datetime.now(timezone.utc),
                shift="night",
                temperature=70.0,
                vibration=2.6,
                rpm=1530.0,
                motor_current=14.4,
                health_score=81.0,
                reading_id=3,
                is_anomaly=True,
            ),
        ])
        db.commit()

        machine_ids = get_machine_ids(db)

    assert "machine_001" in machine_ids
    assert "machine_002" in machine_ids
    assert machine_ids.count("machine_001") == 1
