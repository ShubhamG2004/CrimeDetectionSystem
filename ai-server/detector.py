import cv2
import base64
import requests
import time
import math
from ultralytics import YOLO

# ---------------- CONFIG ----------------
BACKEND_URL = "http://localhost:5000/api/incidents/create"
CAMERA_ID = "cam01"
COOLDOWN_SECONDS = 15

model = YOLO("yolov8n.pt")
cap = cv2.VideoCapture(0)

last_sent_time = 0
prev_positions = {}   # track person movement
loitering_start = {}

print("🚀 Crime Detection AI Started...")

# ---------------- HELPERS ----------------
def distance(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

def encode_image(frame):
    _, buffer = cv2.imencode(".jpg", frame)
    return base64.b64encode(buffer).decode("utf-8")

def send_incident(crime_type, confidence, frame):
    global last_sent_time
    now = time.time()
    if now - last_sent_time < COOLDOWN_SECONDS:
        return

    payload = {
        "type": crime_type,
        "confidence": confidence,
        "cameraId": CAMERA_ID,
        "imageBase64": f"data:image/jpeg;base64,{encode_image(frame)}"
    }

    try:
        res = requests.post(BACKEND_URL, json=payload, timeout=5)
        print(f"🚨 {crime_type} → Sent ({res.status_code})")
        last_sent_time = now
    except:
        print("❌ Backend not reachable")

# ---------------- MAIN LOOP ----------------
while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = model(frame, conf=0.5)
    persons = []
    weapons = []

    for r in results:
        for box in r.boxes:
            cls = int(box.cls[0])
            label = model.names[cls]

            x1, y1, x2, y2 = map(int, box.xyxy[0])
            cx, cy = (x1+x2)//2, (y1+y2)//2

            if label == "person":
                persons.append((cx, cy))
            if label in ["knife", "gun"]:
                weapons.append((cx, cy))

    current_time = time.time()

    # ---------------- CRIME RULES ----------------

    # 🔴 1. WEAPON DETECTION
    if persons and weapons:
        send_incident("WEAPON_DETECTED", 0.95, frame)

    # 🔴 2. FIGHT DETECTION (fast + close motion)
    if len(persons) >= 2:
        speeds = []
        for i, p in enumerate(persons):
            if i in prev_positions:
                speeds.append(distance(prev_positions[i], p))

        if speeds and max(speeds) > 40:   # fast movement threshold
            send_incident("FIGHT_DETECTED", 0.9, frame)

    # 🟠 3. LOITERING
    for i, p in enumerate(persons):
        if i not in loitering_start:
            loitering_start[i] = current_time
        elif current_time - loitering_start[i] > 20:
            send_incident("LOITERING", 0.7, frame)

    # 🟠 4. RUNNING / PANIC
    for i, p in enumerate(persons):
        if i in prev_positions:
            if distance(prev_positions[i], p) > 60:
                send_incident("SUSPICIOUS_RUNNING", 0.8, frame)

    prev_positions = {i: p for i, p in enumerate(persons)}

    cv2.imshow("Crime Detection AI", frame)
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
