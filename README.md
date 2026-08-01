# ⚡ EdgePilot AI
### Autonomous Heavy Machine Intelligence Platform
**Team Tech Titans · Tata Technologies InnoVent**

EdgePilot AI is an end-to-end industrial AI monitoring platform that combines real-time sensor analytics, predictive maintenance, computer vision safety monitoring, and AI-assisted operations in a single demo-ready product.

---

## ✨ Project Overview

EdgePilot AI is designed to simulate and showcase how modern manufacturing environments can use AI to:
- monitor machine health in real time
- predict failures before they happen
- detect safety issues using computer vision
- assist operators with AI-generated recommendations
- provide a mission-control style operations dashboard

This project is ideal for interviews, hackathons, and portfolio demos because it combines backend engineering, ML integration, computer vision, and a polished frontend into one system.

---

## 🧠 Core Features

- Real-time machine health dashboard
- Predictive alerts for temperature, vibration, RPM, and health score
- Anomaly detection using machine learning
- AI maintenance copilot for operator recommendations
- Auth flow with admin/operator/viewer roles
- Fleet overview for multi-machine monitoring
- Safety monitoring with PPE violation detection
- Live notifications for alerting and status events
- Maintenance logging and failure-story generation

---

## 🛠 Tech Stack

### Backend
- Python
- FastAPI
- SQLAlchemy
- SQLite
- Pydantic

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- Recharts

### AI / Vision
- Isolation Forest for anomaly detection
- Gemini-powered copilot integration
- YOLO-based PPE detection
- MediaPipe-based fatigue detection concepts

---

## 📁 Project Structure

```text
edgepilot/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── alerts.py
│   ├── anomaly.py
│   ├── auth.py
│   ├── notifications.py
│   ├── recommendations.py
│   └── tests/
├── copilot/
│   └── copilot.py
├── frontend/
│   ├── src/
│   └── package.json
├── simulator/
│   └── simulate_sensors.py
├── vision/
│   ├── ppe_detect.py
│   └── fatigue_detect.py
├── requirements.txt
├── README.md
├── LICENSE
└── .gitignore
```

---

## ▶️ How to Run

### 1) Install Python dependencies

```bash
py -3.11 -m pip install -r requirements.txt
```

### 2) Configure environment

Create or update the `.env` file with your Gemini API key if you want copilot features enabled:

```env
GEMINI_API_KEY=your_gemini_key_here
```

### 3) Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 4) Start the backend

```bash
py -3.11 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5) Start the simulator

```bash
py -3.11 simulator/simulate_sensors.py
```

### 6) Start the frontend

```bash
cd frontend
npm run dev
```

### 7) Open the app

- Dashboard: http://localhost:3000
- API Docs: http://localhost:8000/docs

---

## 🔐 Demo Credentials

- Admin: `admin / admin123`
- Operator: `operator / op123`
- Viewer: `viewer / view123`

---

## 🧪 ML Training

After enough sensor data has been collected, you can trigger model training from the dashboard or via:

```bash
http://localhost:8000/api/machine/machine_001/train
```

---

## 📡 API Reference

| Endpoint | Purpose |
|---|---|
| GET /api/dashboard | Main dashboard payload |
| GET /api/fleet | Fleet overview for all machines |
| GET /api/machine/{machine_id}/readings | Raw sensor readings |
| GET /api/machine/{machine_id}/trend | Trend chart data |
| GET /api/machine/{machine_id}/alerts | Alert feed |
| GET /api/machine/{machine_id}/recommendations | Maintenance recommendations |
| GET /api/machine/{machine_id}/notifications | Live notifications |
| GET /api/machine/{machine_id}/safety | Safety / PPE summary |
| POST /api/alerts/{id}/acknowledge | Acknowledge an alert |
| POST /api/copilot | Ask the AI copilot |
| GET /api/violations | PPE violation history |

---

## 🎥 Optional Vision Features

Run the camera-based tools separately if your environment supports a webcam:

```bash
py -3.11 vision/ppe_detect.py
```

```bash
py -3.11 vision/fatigue_detect.py
```

If you use a phone camera, set:

```env
CAMERA_SOURCE=http://your-phone-ip:8080/video
```

---

## 🧰 Troubleshooting

### ModuleNotFoundError
```bash
py -3.11 -m pip install -r requirements.txt
```

### Port 8000 already in use
```bash
netstat -ano | findstr :8000
taskkill /PID <number> /F
```

### No data on dashboard
Make sure the simulator is running.

### Copilot not responding
Verify that your Gemini API key is present and valid in the `.env` file.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 🤝 Team

- Team Tech Titans
- Tata Technologies InnoVent
