"""
EdgePilot AI — Notifier Module (Mock)
Simulates sending out-of-band alerts (Email/SMS) for critical anomalies.
"""

from datetime import datetime, timezone

def send_critical_alert(alert_message: str):
    """
    Mock function to simulate sending an SMS or Email to the on-call engineer.
    In a production system, this would integrate with SendGrid, Twilio, etc.
    """
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    print("\n" + "=" * 60)
    print("🔔 OUT-OF-BAND NOTIFICATION (SMS/EMAIL) SENT")
    print(f"   Time    : {now}")
    print(f"   To      : oncall-engineer@tech-titans.local")
    print(f"   Message : {alert_message}")
    print("=" * 60 + "\n")
