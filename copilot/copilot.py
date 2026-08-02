"""
EdgePilot AI — AI Maintenance Copilot
Powered by Google Gemini (free). Grounded on real sensor data.

Install: py -3.11 -m pip install google-genai
"""

import os, json
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")

SYSTEM_PROMPT = """You are EdgePilot AI Maintenance Copilot for industrial heavy machinery.

STRICT RULES:
1. ONLY use the machine data provided below. Never invent or guess sensor values.
2. Keep answer under 4 sentences.
3. Always end with ONE recommendation starting with "Action:".
4. Use plain language — the operator is not a data scientist.
5. If data is insufficient, say so clearly.
6. Be direct and confident.

You answer these 5 question types:
1. Why is this machine overheating?
2. What caused the latest anomaly?
3. What maintenance should I perform?
4. What is the current health status?
5. Generate a quick maintenance report
"""

ALLOWED_QUESTIONS = [
    "Why is this machine overheating?",
    "What caused the latest anomaly?",
    "What maintenance should I perform?",
    "What is the current health status?",
    "Generate a quick maintenance report",
]


def _get_context(machine_id: str) -> dict:
    """Pull live machine context from database."""
    try:
        from backend.database import get_db, get_latest_reading, get_recent_readings, get_recent_alerts
        with get_db() as db:
            latest   = get_latest_reading(db, machine_id)
            readings = get_recent_readings(db, machine_id, limit=48)
            alerts   = get_recent_alerts(db, machine_id, limit=5)

        if not latest:
            return {}

        n = len(readings)
        avg_temp = round(sum(r.temperature  for r in readings) / n, 1) if n else 0
        avg_vib  = round(sum(r.vibration    for r in readings) / n, 2) if n else 0
        avg_h    = round(sum(r.health_score for r in readings) / n, 1) if n else 0
        temp_delta = round(latest.temperature - readings[0].temperature, 1) if readings else 0

        return {
            "machine_id":              machine_id,
            "machineiq_score":         latest.health_score,
            "current_temperature":     latest.temperature,
            "current_vibration":       latest.vibration,
            "current_rpm":             latest.rpm,
            "current_motor_current":   latest.motor_current,
            "current_shift":           latest.shift,
            "anomaly_active":          latest.is_anomaly,
            "24h_avg_temperature":     avg_temp,
            "24h_avg_vibration":       avg_vib,
            "24h_avg_health":          avg_h,
            "temperature_delta_trend": temp_delta,
            "total_readings_used":     n,
            "recent_alerts": [a.message for a in alerts if not a.acknowledged][:3],
        }
    except Exception as e:
        return {"error": str(e)}


def ask_copilot(question: str, machine_id: str) -> str:
    """Ask the AI Copilot. Returns a grounded plain-language answer."""

    if not GEMINI_KEY or GEMINI_KEY == "your_gemini_key_here":
        return ("[WARN] Gemini API key not configured. "
                "Add GEMINI_API_KEY to your .env file. "
                "Get a free key at https://aistudio.google.com")

    context = _get_context(machine_id)
    if not context or "error" in context:
        return "No sensor data available yet. Start the simulator first."

    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_KEY)

        prompt = f"""{SYSTEM_PROMPT}

Machine Sensor Data (live + last 24h averages):
{json.dumps(context, indent=2)}

Operator Question: {question}
"""
        response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        return response.text.strip()

    except Exception as e:
        return f"Copilot error: {str(e)}"


def generate_work_order(machine_id: str) -> str:
    if not GEMINI_KEY or GEMINI_KEY == "your_gemini_key_here":
        return "Gemini API key not configured. Cannot generate work order."

    context = _get_context(machine_id)
    if not context or "error" in context:
        return "No sensor data available to generate work order."

    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_KEY)

        prompt = f"""You are an expert industrial maintenance planner.
Based on the following machine sensor data and recent alerts, generate a comprehensive Jira/ServiceNow-style Work Order Ticket.

Machine Sensor Data:
{json.dumps(context, indent=2)}

Include the following sections:
- Ticket Title
- Priority (Low, Medium, High, Critical)
- Description of Issue
- Suspected Root Cause
- Required Parts/Tools
- Step-by-Step Resolution Plan

Use Markdown formatting. Be professional and detailed.
"""
        response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        return response.text.strip()
    except Exception as e:
        return f"Error generating work order: {str(e)}"


def get_allowed_questions() -> list:
    return ALLOWED_QUESTIONS


if __name__ == "__main__":
    print("EdgePilot AI Copilot — CLI Test")
    for i, q in enumerate(ALLOWED_QUESTIONS, 1):
        print(f"  {i}. {q}")
    choice = int(input("\nPick (1-5): ")) - 1
    print(f"\nA: {ask_copilot(ALLOWED_QUESTIONS[choice], 'machine_001')}")
