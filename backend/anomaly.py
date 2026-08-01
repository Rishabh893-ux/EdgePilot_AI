"""
EdgePilot AI — Anomaly Detection
Isolation Forest with shift-aware engineered features. Persists to disk.
"""
import os, json, joblib
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

MODEL_DIR   = Path(__file__).parent / "models"
MODEL_DIR.mkdir(exist_ok=True)
MODEL_PATH    = MODEL_DIR / "isolation_forest.joblib"
SCALER_PATH   = MODEL_DIR / "scaler.joblib"
METADATA_PATH = MODEL_DIR / "metadata.json"
CONTAMINATION = float(os.getenv("IF_CONTAMINATION", "0.02"))
SHIFT_ENC = {"morning": 0, "afternoon": 1, "night": 2}

class AnomalyDetector:
    def __init__(self):
        self.model: Optional[IsolationForest] = None
        self.scaler: Optional[StandardScaler] = None
        self.is_trained = False
        self.training_samples = 0
        self._load()

    def _extract(self, r: dict) -> np.ndarray:
        ts = r.get("timestamp")
        if isinstance(ts, str):
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        elif isinstance(ts, datetime):
            dt = ts
        else:
            dt = datetime.now(timezone.utc)
        shift = SHIFT_ENC.get(r.get("shift", "morning"), 0)
        temp  = r["temperature"]; vib = r["vibration"]
        rpm   = r["rpm"];         curr = r["motor_current"]
        health= r["health_score"]
        return np.array([[temp, vib, rpm, curr, health, shift, dt.hour,
                          temp / max(vib, 0.1), (rpm * curr) / 1000.0]], dtype=np.float32)

    def train(self, readings: List[dict]) -> dict:
        if len(readings) < 50:
            return {"success": False, "error": "Need at least 50 readings"}
        print(f"[INFO] Training Isolation Forest on {len(readings)} samples...")
        X = np.vstack([self._extract(r) for r in readings])
        self.scaler = StandardScaler()
        Xs = self.scaler.fit_transform(X)
        self.model = IsolationForest(n_estimators=100, contamination=CONTAMINATION,
                                     random_state=42, n_jobs=-1)
        self.model.fit(Xs)
        self.is_trained = True; self.training_samples = len(readings)
        self._save()
        return {"success": True, "training_samples": len(readings)}

    def predict(self, r: dict) -> Dict[str, Any]:
        if not self.is_trained:
            return self._rule_based(r)
        X  = self._extract(r)
        Xs = self.scaler.transform(X)
        score = float(self.model.decision_function(Xs)[0])
        pred  = int(self.model.predict(Xs)[0])
        return {"is_anomaly": pred == -1, "anomaly_score": score}

    def _rule_based(self, r: dict) -> dict:
        anomaly = (r.get("temperature", 0) > 78 or
                   r.get("vibration",   0) > 4.0 or
                   r.get("health_score", 100) < 55)
        return {"is_anomaly": anomaly, "anomaly_score": -0.5 if anomaly else 0.1}

    def get_rul_days(self, readings: List[dict]) -> int:
        if len(readings) < 6: return -1
        scores = [r["health_score"] for r in readings]
        x = np.arange(len(scores), dtype=float)
        slope, intercept = np.polyfit(x, scores, 1)
        if slope >= 0: return 999
        steps_to_fail = -intercept / slope
        rul = max(0, int((steps_to_fail - len(scores)) / (86400 / 3)))
        return rul

    def _save(self):
        joblib.dump(self.model, MODEL_PATH)
        joblib.dump(self.scaler, SCALER_PATH)
        json.dump({"training_samples": self.training_samples,
                   "trained_at": datetime.now(timezone.utc).isoformat()},
                  open(METADATA_PATH, "w"), indent=2)
        print(f"[INFO] Model saved → {MODEL_DIR}")

    def _load(self):
        try:
            if MODEL_PATH.exists() and SCALER_PATH.exists():
                self.model = joblib.load(MODEL_PATH)
                self.scaler = joblib.load(SCALER_PATH)
                self.is_trained = True
                if METADATA_PATH.exists():
                    meta = json.load(open(METADATA_PATH))
                    self.training_samples = meta.get("training_samples", 0)
                print(f"[OK] Anomaly model loaded ({self.training_samples} samples)")
        except Exception as e:
            print(f"[WARN]  Could not load model: {e}")

    def info(self) -> dict:
        return {"is_trained": self.is_trained,
                "training_samples": self.training_samples,
                "model_exists": MODEL_PATH.exists()}

_detector: Optional[AnomalyDetector] = None

def get_detector() -> AnomalyDetector:
    global _detector
    if _detector is None:
        _detector = AnomalyDetector()
    return _detector

def detect_anomaly(reading: dict) -> dict:
    return get_detector().predict(reading)

def train_detector(readings: List[dict]) -> dict:
    return get_detector().train(readings)
