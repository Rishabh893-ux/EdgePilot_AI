"""
EdgePilot AI — PPE & Safety Detection (YOLOv8n)
Detects helmets, safety vests, danger zone intrusions.

Run: py -3.11 vision/ppe_detect.py

Camera: set CAMERA_SOURCE=0 (webcam) or http://phone-ip:8080/video (IP Webcam app)
"""

import cv2, os, sys, time, requests, datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from ultralytics import YOLO
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

CAMERA   = os.getenv("CAMERA_SOURCE", "0")
BACKEND  = f"http://{os.getenv('BACKEND_HOST','localhost')}:{os.getenv('BACKEND_PORT','8000')}"
SKIP     = 5       # run inference every N frames
CONF     = 0.45    # detection confidence
COOLDOWN = 10      # seconds between same violation logs

# Danger zone — right 40% of frame
DANGER_ZONE = (0.6, 0.0, 1.0, 1.0)

PPE_LABELS = {"helmet","hard hat","safety helmet","hardhat",
              "vest","safety vest","high visibility","hi-vis"}


def get_shift():
    h = datetime.datetime.now().hour
    if 6 <= h < 14: return "morning"
    elif 14 <= h < 22: return "afternoon"
    return "night"


def log_violation(msg: str):
    try:
        requests.post(f"{BACKEND}/api/violations",
                      params={"violation": msg, "shift": get_shift()}, timeout=2)
        print(f"[PPE] Logged: {msg}")
    except Exception:
        pass


def in_zone(box, w, h):
    x1,y1,x2,y2 = box
    zx = DANGER_ZONE[0] * w
    cx = (x1 + x2) / 2
    return cx > zx


def run():
    model = YOLO("yolov8n.pt")
    print("[PPE] YOLOv8n loaded")

    src = int(CAMERA) if str(CAMERA).isdigit() else CAMERA
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print(f"[PPE] [FAIL] Cannot open camera: {CAMERA}")
        print("  Laptop: set CAMERA_SOURCE=0 in .env")
        print("  Phone:  install 'IP Webcam' app → set CAMERA_SOURCE=http://phone-ip:8080/video")
        return

    print(f"[PPE] Camera open: {CAMERA} | Q to quit")
    frame_n = 0
    last_viol = 0

    while True:
        ret, frame = cap.read()
        if not ret: break
        frame_n += 1
        h, w = frame.shape[:2]

        # Danger zone overlay
        cv2.rectangle(frame, (int(DANGER_ZONE[0]*w), 0), (w, h), (0,0,255), 2)
        cv2.putText(frame, "DANGER ZONE", (int(DANGER_ZONE[0]*w)+5, 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 2)

        if frame_n % SKIP == 0:
            results   = model(frame, conf=CONF, verbose=False)
            annotated = results[0].plot()
            now = time.time()
            detected  = set()
            has_person = False

            for box in results[0].boxes:
                lbl = model.names[int(box.cls[0])].lower()
                detected.add(lbl)
                coords = box.xyxy[0].tolist()

                if lbl == "person":
                    has_person = True
                    if in_zone(coords, w, h):
                        cv2.putText(annotated, "⚠ DANGER ZONE BREACH",
                                    (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,255), 2)
                        if now - last_viol > COOLDOWN:
                            log_violation("Person in danger zone")
                            last_viol = now

            has_ppe = any(l in PPE_LABELS for l in detected)
            if has_person and not has_ppe:
                cv2.putText(annotated, "⚠ PPE VIOLATION",
                            (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,165,255), 2)
                if now - last_viol > COOLDOWN:
                    log_violation("PPE violation: no helmet or safety vest")
                    last_viol = now

            status = "✓ PPE OK" if not has_person or has_ppe else "✗ PPE MISSING"
            color  = (0,255,0) if "OK" in status else (0,165,255)
            cv2.putText(annotated, f"EdgePilot AI | {status}",
                        (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            cv2.imshow("EdgePilot AI — Safety Monitor", annotated)
        else:
            cv2.imshow("EdgePilot AI — Safety Monitor", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("[PPE] Stopped")


if __name__ == "__main__":
    run()
