import cv2
import base64
import requests
import time
from ultralytics import YOLO

model = YOLO("yolov8n.pt")
BACKEND_URL = "http://localhost:5000/api/incidents/create"

cap = cv2.VideoCapture(0)

last_sent_time = 0
COOLDOWN_SECONDS = 10   # send max 1 alert every 10 seconds

print("🚀 YOLO Crime Detection Started...")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = model(frame, conf=0.5)
    detected_objects = []

    for r in results:
        for box in r.boxes:
            cls = int(box.cls[0])
            label = model.names[cls]
            detected_objects.append(label)

    current_time = time.time()

    if "person" in detected_objects and (current_time - last_sent_time) > COOLDOWN_SECONDS:
        print("⚠ Person detected (sending incident)")

        _, buffer = cv2.imencode(".jpg", frame)
        image_base64 = base64.b64encode(buffer).decode("utf-8")

        payload = {
            "type": "PERSON_DETECTED",
            "confidence": 0.85,
            "cameraId": "cam01",
            "imageBase64": f"data:image/jpeg;base64,{image_base64}"
        }

        try:
            res = requests.post(BACKEND_URL, json=payload, timeout=5)
            print("📡 Sent to backend:", res.status_code)
            last_sent_time = current_time
        except Exception as e:
            print("❌ Backend error:", e)

    cv2.imshow("Crime Detection Camera", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
