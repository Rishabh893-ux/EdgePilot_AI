<div align="center">

# ⚡ EdgePilot AI
### Autonomous Heavy Machine Intelligence Platform

**Built by Rishabh Kasaudhan**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://typescriptlang.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![Deployed on Vercel](https://img.shields.io/badge/Vercel-Live-black?style=for-the-badge&logo=vercel)](https://edge-pilot-ai.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

<br/>

> **EdgePilot AI** is a production-grade industrial IoT intelligence platform that combines real-time sensor analytics, predictive maintenance, computer vision safety monitoring, and an AI-powered operations copilot — all in a single, mission-control style dashboard.

🌐 **Live Demo:** [edge-pilot-ai.vercel.app](https://edge-pilot-ai.vercel.app)

<br/>

</div>

---

## 📸 Screenshots

### 🎛️ Mission Control | Fleet Command Center
<p align="center">
  <img src="https://github.com/user-attachments/assets/a7f185e9-eee6-46bd-b9fb-e70d3b262397" width="48%">
  <img src="https://github.com/user-attachments/assets/9cd2b257-ef1b-4d61-b29c-c94ff4bf5836" width="48%">
</p>

### 📊 Deep Analytics | Safety Intelligence
<p align="center">
  <img src="https://github.com/user-attachments/assets/fb60556e-a8ce-43f0-9a96-f7e1081ae169" width="48%">
  <img src="https://github.com/user-attachments/assets/0b2a0aac-ea25-4a51-a1e6-289e2c1f3e61" width="48%">
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/9df72f5b-3bc5-4cff-bfd9-5305222d1649" width="98%">
</p>

### 🛡️ Safety Hub | Reports & Exports
<p align="center">
  <img src="https://github.com/user-attachments/assets/7b8dfbe2-59f5-4597-bd0e-a205010cc103" width="48%">
  <img src="https://github.com/user-attachments/assets/96db057a-74de-4e45-b72d-669359cccd0b" width="48%">
</p>

---

## 🌟 Key Features

### 🎛️ Mission Control Dashboard
- **3D Digital Twin** — Three.js animated machine model with live temperature, vibration, and anomaly states
- **Real-time sensor monitoring** — Temperature, Vibration, RPM, Motor Current, Power Draw, Acoustic Frequency — all live-updating
- **Health score bar** with animated color-coded progress (green → amber → red)
- **⏪ Time-Travel Root Cause Analysis** — scrub a timeline slider to replay historical sensor states
- **Live Alert Ticker** — scrolling notification feed cycling through all active unacknowledged alerts
- **Session Uptime Clock** — real-time HH:MM:SS counter since login
- **🌱 Carbon Footprint Widget** — cumulative kWh and CO₂ emitted during the monitoring session
- **Trend arrows** on stat cards showing `▲ +2.1` / `▼ -0.4` vs previous readings
- **Split-tier API polling** — sensor data refreshes every 5s, fleet data every 30s

### 🤖 AI Copilot (Gemini 2.5 Flash)
- Ask natural language questions about any machine's current status
- Get intelligent maintenance recommendations in real-time
- AI-generated **Failure Story reports** — narrative analysis of machine degradation
- Smart context-aware answers using live sensor readings as context

### 📊 Deep Analytics
- **Multi-sensor trend chart** — Temperature, Vibration, Health Score, Motor Current on a dual-axis chart
- **Anomaly scatter map** — Temperature vs Vibration with red/green dot classification
- **Shift comparison bar chart** — Average Health and Anomaly count per shift
- **Power Draw** and **Acoustic Frequency** trend charts

### 🏭 Fleet Command Center
- Multi-machine overview with per-machine health bars and live status badges
- **Add new machines** via a modal form — saved locally across sessions
- Real-time data from `machine_001`, static demo data for other machines
- Admin-only machine removal controls

### 🦺 Safety Intelligence Hub
- PPE violation tracking with category breakdown (Helmet, Vest, Gloves, Goggles)
- **Risk scoring system** per shift and zone
- Trend analysis charts for shift-over-shift comparison
- Filterable violation history table with severity badges

### 🔧 Maintenance Hub
- Full maintenance log history with searchable records
- **Log new maintenance events** via a rich modal form
- Health impact analysis chart comparing before/after maintenance scores
- Recurring pattern detection for common failure modes
- Work Order generator (AI-powered via Gemini)

### 📋 Reports & Exports
- **Real CSV exports** — 24h, 7d, 30d machine data downloads
- **AI Failure Story** — Gemini-generated markdown narrative about machine health
- Maintenance history JSON export
- Dashboard snapshot JSON export
- Custom report generator with date range picker

### ⚙️ System Settings
- **Interactive sliders** for all thresholds (Temperature, Vibration, RPM, Current, Power)
- Sliders turn **amber/red** dynamically as you approach warning/critical thresholds
- Display preferences: Dark/Light theme toggle, °C/°F unit switcher, poll interval
- Notification toggles for email alerts, critical popups, maintenance reminders
- **System Diagnostics panel** — backend status, machine ID, API version, active alerts
- **Admin Danger Zone** — clear alert cache and reset ML model

### 🚨 Alerts Command Center
- Hourly alert bar chart (last 12 hours)
- Filter by severity (Critical / Warning / Unacknowledged)
- Live search across all alert messages
- Acknowledge individual or all alerts (Operator/Admin only)

### 🔐 Role-Based Access Control
- Three roles: **Admin**, **Operator**, **Viewer**
- Permission-gated UI — viewers can't acknowledge alerts or register machines
- Session-based token authentication via FastAPI

### 📡 MQTT + Real-Time Data Pipeline
- Live MQTT subscriber connecting to `test.mosquitto.org`
- Python sensor simulator with IST-aware shift detection (Morning/Afternoon/Night)
- Anomaly detection using **Isolation Forest** ML model
- Webhook notifications for critical predictive alerts

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Python 3.11** | Core language |
| **FastAPI** | REST API framework with automatic OpenAPI docs |
| **SQLAlchemy + SQLite** | Sensor data and alert persistence |
| **Paho-MQTT** | Real-time IoT data ingestion |
| **scikit-learn** | Isolation Forest anomaly detection |
| **Pydantic** | Data validation and serialization |

### Frontend
| Technology | Purpose |
|---|---|
| **Next.js 14** (App Router) | React framework with Turbopack for fast dev |
| **TypeScript** | Type-safe development |
| **Three.js / React Three Fiber** | 3D Digital Twin machine visualization |
| **Recharts** | Animated data visualization charts |
| **Lucide React** | Consistent icon library |
| **next/font** | Optimized Google Fonts (Inter) |
| **In-memory API Cache** | Per-endpoint TTL caching for instant tab switches |

### AI & Vision
| Technology | Purpose |
|---|---|
| **Google Gemini 2.5 Flash** | AI Copilot natural language Q&A and Work Orders |
| **Isolation Forest** | Unsupervised anomaly detection on sensor streams |
| **YOLO** | PPE (Personal Protective Equipment) detection |
| **MediaPipe** | Fatigue and drowsiness detection concepts |

### Deployment
| Service | Purpose |
|---|---|
| **Vercel** | Frontend hosting with automatic GitHub CI/CD |
| **Render** | FastAPI backend hosting |
| **GitHub** | Source control and CI pipeline |

---

## 📁 Project Structure

```
edgepilot/
├── 📂 backend/
│   ├── main.py              ← FastAPI app entry point (all API routes)
│   ├── database.py          ← SQLAlchemy models, CRUD, seeding
│   ├── alerts.py            ← Predictive alert engine with webhook support
│   ├── anomaly.py           ← Isolation Forest ML model training & inference
│   ├── auth.py              ← Token-based authentication + role management
│   ├── mqtt_subscriber.py   ← Live MQTT sensor data subscriber
│   ├── notifications.py     ← In-app notification system
│   ├── recommendations.py   ← Rule-based maintenance recommendation engine
│   └── tests/               ← Pytest unit tests
│
├── 📂 copilot/
│   └── copilot.py           ← Gemini 2.5 Flash integration for AI Q&A
│
├── 📂 frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              ← Mission Control (main dashboard)
│   │   │   ├── fleet/page.tsx        ← Fleet Command Center
│   │   │   ├── violations/page.tsx   ← Safety Intelligence Hub
│   │   │   ├── maintenance/page.tsx  ← Maintenance Hub
│   │   │   ├── reports/page.tsx      ← Reports & Exports
│   │   │   ├── analytics/page.tsx    ← Deep Analytics
│   │   │   ├── alerts/page.tsx       ← Alert Command Center
│   │   │   ├── copilot/page.tsx      ← AI Copilot chat interface
│   │   │   ├── settings/page.tsx     ← Threshold config & diagnostics
│   │   │   └── login/page.tsx        ← Authentication
│   │   ├── components/
│   │   │   ├── Sidebar.tsx           ← Navigation sidebar (day/night mode aware)
│   │   │   └── Machine3D.tsx         ← Three.js 3D digital twin component
│   │   └── lib/
│   │       ├── api.ts                ← Centralized API client with in-memory cache
│   │       └── auth.ts               ← Auth helper and permission gating
│   └── package.json
│
├── 📂 simulator/
│   └── simulate_sensors.py  ← MQTT sensor data generator (IST shift-aware)
│
├── 📂 vision/
│   ├── ppe_detect.py        ← Real-time PPE detection using YOLO + webcam
│   └── fatigue_detect.py    ← Operator fatigue detection using MediaPipe
│
├── .env                     ← API keys and environment configuration
├── requirements.txt         ← Python dependencies
├── README.md
└── LICENSE
```

---

## ▶️ Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))

### 1. Clone the repository
```bash
git clone https://github.com/Rishabh893-ux/EdgePilot_AI.git
cd EdgePilot_AI/edgepilot
```

### 2. Install Python dependencies
```bash
py -3.11 -m pip install -r requirements.txt
```

### 3. Configure environment variables
Create or update the `.env` file in the root `edgepilot/` folder:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Install frontend dependencies
```bash
cd frontend
npm install
cd ..
```

### 5. Start the backend (Terminal 1)
```bash
py -3.11 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### 6. Start the sensor simulator (Terminal 2)
```bash
py -3.11 simulator/simulate_sensors.py
```

### 7. Start the frontend (Terminal 3)
```bash
cd frontend
npm run dev
```

### 8. Open the app
| Service | URL |
|---|---|
| **Dashboard** | http://localhost:3000 |
| **API Documentation** | http://localhost:8000/docs |

---

## 🔐 Demo Credentials

| Role | Username | Password | Access Level |
|---|---|---|---|
| **Admin** | `admin` | `admin123` | Full access — can add machines, train models, change settings |
| **Operator** | `operator` | `op123` | Can acknowledge alerts, log maintenance, trigger work orders |
| **Viewer** | `viewer` | `view123` | Read-only dashboard access |

---

## 📡 API Reference

### Dashboard & Sensors
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Full dashboard payload (health, sensors, alerts, shift) |
| `GET` | `/api/machine/{id}/readings` | Raw sensor reading history |
| `GET` | `/api/machine/{id}/trend?n=25` | Trend chart data (last N readings) |
| `GET` | `/api/fleet` | All machines fleet overview |
| `GET` | `/api/status` | System status (uptime, total readings, active alerts) |

### Alerts & Notifications
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/machine/{id}/alerts` | Alert feed with severity |
| `POST` | `/api/alerts/{id}/acknowledge` | Acknowledge a specific alert |
| `GET` | `/api/machine/{id}/notifications` | Live notification stream |

### AI & Recommendations
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/copilot` | Ask the Gemini AI Copilot |
| `GET` | `/api/machine/{id}/recommendations` | Rule-based maintenance recommendations |
| `GET` | `/api/machine/{id}/failure-story` | AI-generated narrative failure analysis |
| `GET` | `/api/machine/{id}/work-order` | AI-generated maintenance work order |
| `POST` | `/api/machine/{id}/train` | Trigger Isolation Forest model training |
| `GET` | `/api/ml/status` | ML model training status |

### Safety & Maintenance
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/violations` | PPE violation history |
| `GET` | `/api/machine/{id}/safety` | Safety summary by shift/zone |
| `GET` | `/api/machine/{id}/maintenance` | Maintenance log history |
| `POST` | `/api/machine/{id}/maintenance` | Log a new maintenance event |
| `GET` | `/api/machine/{id}/export?days=30` | Download sensor data as CSV |

### Settings
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/machine/{id}/thresholds` | Get alert thresholds |
| `POST` | `/api/machine/{id}/thresholds` | Update alert thresholds |
| `POST` | `/api/machine/{id}/control` | Send control command (e.g. emergency stop) |

---

## 🧪 ML / AI Details

### Anomaly Detection
The backend uses **Isolation Forest** (scikit-learn) to detect sensor anomalies without requiring labeled data. The model trains on historical readings and flags when new readings fall outside the learned normal distribution.

Trigger training via:
```
POST http://localhost:8000/api/machine/machine_001/train
```

### AI Copilot
Powered by **Google Gemini 2.5 Flash** via the `google-genai` SDK. The copilot receives live machine sensor data as context alongside your question and returns operator-friendly recommendations in plain English.

### Shift Detection
The simulator automatically detects the current IST (India Standard Time) shift:
- 🌅 **Morning Shift**: 06:00 – 13:59 IST
- 🌇 **Afternoon Shift**: 14:00 – 21:59 IST
- 🌙 **Night Shift**: 22:00 – 05:59 IST

---

## 🎥 Vision Features (Optional)

Requires a connected webcam or IP camera.

**PPE Detection** (YOLO-based):
```bash
py -3.11 vision/ppe_detect.py
```

**Fatigue Detection** (MediaPipe-based):
```bash
py -3.11 vision/fatigue_detect.py
```

For IP camera support, set in `.env`:
```env
CAMERA_SOURCE=http://your-phone-ip:8080/video
```

---

## 🧰 Troubleshooting

| Problem | Solution |
|---|---|
| `ModuleNotFoundError` | Run `py -3.11 -m pip install -r requirements.txt` |
| Port 8000 already in use | Run `netstat -ano \| findstr :8000` then `taskkill /PID <number> /F` |
| No data on dashboard | Ensure the simulator is running in a separate terminal |
| Copilot not responding | Verify `GEMINI_API_KEY` is set correctly in `.env` |
| Slow page loads | Run `npm run build && npm run start` for production mode |
| MQTT warnings | The public broker (`test.mosquitto.org`) sometimes drops connections — auto-reconnects |
| 3D model not loading | Clear browser cache; Three.js requires WebGL support |

---

## 🗺️ Roadmap

- [x] Real-time MQTT sensor data pipeline
- [x] Isolation Forest anomaly detection
- [x] Gemini AI Copilot integration
- [x] Role-based access control (Admin / Operator / Viewer)
- [x] 3D Digital Twin visualization
- [x] Time-Travel Root Cause Analysis
- [x] Carbon footprint tracker
- [x] IST-aware shift detection
- [x] Interactive settings with sliders and diagnostics
- [ ] Multi-machine MQTT support for 5+ simultaneous machines
- [ ] Real YOLO integration for live PPE violation detection
- [ ] Grafana/Prometheus metrics export
- [ ] Mobile-responsive PWA layout
- [ ] Docker Compose for one-command deployment

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for full details.

---

<div align="center">

## 🤝 Built by

**Rishabh Kasaudhan**

*AI Engineer & Full Stack Developer*

[![GitHub](https://img.shields.io/badge/GitHub-Rishabh893--ux-181717?style=for-the-badge&logo=github)](https://github.com/Rishabh893-ux)

*Autonomous Heavy Machine Intelligence Platform · v1.0.0*

⭐ If you found this project useful, please consider starring the repository!

</div>
