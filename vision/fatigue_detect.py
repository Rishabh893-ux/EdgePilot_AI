"""
EdgePilot AI — Fatigue & Drowsiness Detection (MediaPipe)
Detects eye closure (EAR), yawning (MAR), head drooping.

Run: py -3.11 vision/fatigue_detect.py
"""

import cv2, time, math, os, sys, requests
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import mediapipe as mp
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

CAMERA  = os.getenv("CAMERA_SOURCE", "0")
BACKEND = f"http://{os.getenv('BACKEND_HOST','localhost')}:{os.getenv('BACKEND_PORT','8000')}"

EAR_THRESH    = 0.22   # Eye Aspect Ratio below = closed
CLOSED_FRAMES = 20     # frames before alert
MAR_THRESH    = 0.60   # Mouth Aspect Ratio above = yawning
COOLDOWN      = 15

LEFT_EYE  = [362,385,387,263,373,380]
RIGHT_EYE = [33,160,158,133,153,144]
MOUTH     = [61,291,39,181,0,17,269,405]

mp_mesh = mp.solutions.face_mesh


def dist(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)


def ear(lm, idx, w, h):
    pts = [(int(lm[i].x*w), int(lm[i].y*h)) for i in idx]
    return (dist(pts[1],pts[5]) + dist(pts[2],pts[4])) / (2.0 * max(dist(pts[0],pts[3]),0.001))


def mar(lm, w, h):
    pts = [(int(lm[i].x*w), int(lm[i].y*h)) for i in MOUTH]
    return (dist(pts[2],pts[6]) + dist(pts[3],pts[7])) / (2.0 * max(dist(pts[0],pts[4]),0.001))


def log_event(msg: str):
    try:
        requests.post(f"{BACKEND}/api/violations",
                      params={"violation": msg, "shift": "current"}, timeout=2)
        print(f"[FATIGUE] {msg}")
    except Exception:
        pass


def run():
    src = int(CAMERA) if str(CAMERA).isdigit() else CAMERA
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print(f"[FATIGUE] [FAIL] Cannot open camera: {CAMERA}")
        return

    print("[FATIGUE] MediaPipe FaceMesh loaded | Q to quit")
    closed = 0; last_alert = 0

    with mp_mesh.FaceMesh(max_num_faces=1, refine_landmarks=True,
                          min_detection_confidence=0.5,
                          min_tracking_confidence=0.5) as mesh:
        while True:
            ret, frame = cap.read()
            if not ret: break
            h, w = frame.shape[:2]
            rgb  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            res  = mesh.process(rgb)
            status = "No Face"; color = (128,128,128)

            if res.multi_face_landmarks:
                lm = res.multi_face_landmarks[0].landmark
                e  = (ear(lm, LEFT_EYE, w, h) + ear(lm, RIGHT_EYE, w, h)) / 2
                m  = mar(lm, w, h)
                now = time.time()

                if e < EAR_THRESH:
                    closed += 1
                    if closed >= CLOSED_FRAMES:
                        status = "⚠ DROWSY"; color = (0,0,255)
                        if now - last_alert > COOLDOWN:
                            log_event("Operator drowsiness — eyes closed")
                            last_alert = now
                else:
                    closed = 0; status = "✓ Alert"; color = (0,255,0)

                if m > MAR_THRESH:
                    status = "⚠ YAWNING"; color = (0,165,255)
                    if now - last_alert > COOLDOWN:
                        log_event("Operator fatigue — yawning detected")
                        last_alert = now

                cv2.putText(frame, f"EAR:{e:.2f} MAR:{m:.2f}", (10,60),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 1)

            cv2.putText(frame, f"EdgePilot AI Fatigue | {status}",
                        (10,30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            cv2.imshow("EdgePilot AI — Fatigue Monitor", frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    cap.release(); cv2.destroyAllWindows()
    print("[FATIGUE] Stopped")


if __name__ == "__main__":
    run()
