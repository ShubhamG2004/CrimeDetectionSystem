"""
AI SERVER - Crime Detection System (YOLOv8-Pose)
Image Upload API with Logical Post-Validation
"""

import os
import cv2
from datetime import datetime
from pathlib import Path

from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

from pose_detector import PoseCrimeDetector

# --------------------------------------------------
# INITIALIZE
# --------------------------------------------------

app = Flask(__name__)

UPLOAD_FOLDER = "./ai_uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp"}

Path(UPLOAD_FOLDER).mkdir(parents=True, exist_ok=True)

pose_detector = PoseCrimeDetector()

# --------------------------------------------------
# HELPERS
# --------------------------------------------------

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def normalize_confidence(raw_confidence):
    """
    Normalize confidence to 0.0–1.0
    """
    try:
        raw_confidence = float(raw_confidence)
        if raw_confidence > 1:
            return min(raw_confidence / 100.0, 1.0)
        return max(raw_confidence, 0.0)
    except Exception:
        return 0.0


# --------------------------------------------------
# CORE ANALYSIS
# --------------------------------------------------

def analyze_image(image):
    result = pose_detector.analyze(image)

    detection = {
        "type": result.get("crime_type", "NO_CRIME"),
        "confidence": normalize_confidence(
            result.get("confidence", 0.0)
        ),
        "crime_detected": int(result.get("crime_detected", 0)),
        "threat_level": result.get("threat_level", "LOW"),
        "persons_detected": int(
            result.get("persons_detected", 0)
        ),
        "activities": result.get("activities", []),
        "signals": result.get("signals", []),
    }

    # --------------------------------------------------
    # 🧠 POST-VALIDATION (CRITICAL FIX)
    # --------------------------------------------------

    crime = detection["type"]
    persons = detection["persons_detected"]

    # Crimes that REQUIRE at least 2 people
    MULTI_PERSON_CRIMES = [
        "FIGHT",
        "PHYSICAL_ASSAULT",
        "CHOKING",
        "CHOKING / ATTEMPTED MURDER",
    ]

    # Crimes that MUST be HIGH threat
    HIGH_THREAT_CRIMES = [
        "CHOKING",
        "CHOKING / ATTEMPTED MURDER",
        "ASSAULT_WITH_WEAPON",
        "ARMED_INTRUSION",
        "ROBBERY",
    ]

    # ❌ Invalid crime if people < 2
    if crime in MULTI_PERSON_CRIMES and persons < 2:
        detection["type"] = "NO_CRIME"
        detection["confidence"] = 0.0
        detection["crime_detected"] = 0
        detection["threat_level"] = "LOW"
        detection["persons_detected"] = max(persons, 1)

    # 🔴 Force HIGH threat for violent crimes
    if detection["type"] in HIGH_THREAT_CRIMES:
        detection["threat_level"] = "HIGH"

    # 🧍 Never allow 0 people for detected crimes
    if detection["type"] != "NO_CRIME" and detection["persons_detected"] == 0:
        detection["persons_detected"] = 1

    return detection


# --------------------------------------------------
# API ENDPOINT
# --------------------------------------------------

@app.route("/detect-image", methods=["POST"])
def detect_image():
    try:
        if "image" not in request.files:
            return jsonify({
                "type": "NO_IMAGE",
                "confidence": 0.0,
                "location": request.form.get("locationName", "Unknown"),
            }), 400

        file = request.files["image"]
        location = request.form.get("locationName", "Unknown")

        if file.filename == "" or not allowed_file(file.filename):
            return jsonify({
                "type": "INVALID_IMAGE",
                "confidence": 0.0,
                "location": location,
            }), 400

        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        image = cv2.imread(filepath)
        if image is None:
            raise ValueError("Failed to read image")

        detection = analyze_image(image)

        return jsonify({
            "type": detection["type"],
            "confidence": round(detection["confidence"], 3),
            "threat_level": detection["threat_level"],
            "persons_detected": detection["persons_detected"],
            "activities": detection["activities"],
            "signals": detection["signals"],
            "location": location,
            "timestamp": datetime.now().isoformat(),
        })

    except Exception as e:
        return jsonify({
            "type": "ERROR",
            "confidence": 0.0,
            "location": request.form.get("locationName", "Unknown"),
            "error": str(e),
        }), 500


# --------------------------------------------------
# RUN SERVER
# --------------------------------------------------

if __name__ == "__main__":
    print("\n🤖 AI CRIME DETECTION SERVER (YOLOv8-POSE)")
    print("📡 API → http://127.0.0.1:8000/detect-image\n")
    app.run(host="0.0.0.0", port=8000)
