from datetime import datetime, timezone

from backend.database import PPEViolation, get_db, get_safety_summary


def test_get_safety_summary_counts_recent_violations():
    with get_db() as db:
        db.query(PPEViolation).delete(synchronize_session=False)
        db.commit()

        db.add_all([
            PPEViolation(machine_id="machine_001", violation="PPE violation: no helmet or safety vest", shift="morning", created_at=datetime.now(timezone.utc).isoformat()),
            PPEViolation(machine_id="machine_001", violation="Person in danger zone", shift="morning", created_at=datetime.now(timezone.utc).isoformat()),
            PPEViolation(machine_id="machine_002", violation="PPE violation: no helmet or safety vest", shift="afternoon", created_at=datetime.now(timezone.utc).isoformat()),
        ])
        db.commit()

        summary = get_safety_summary(db, "machine_001", limit=10)

    assert summary["machine_id"] == "machine_001"
    assert summary["violation_count"] == 2
    assert summary["latest_violation"] == "Person in danger zone"
    assert summary["status"] == "attention"
