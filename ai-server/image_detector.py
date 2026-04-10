"""
ai_server.py v4 — Crime Detection API Server
Fixes for portrait FP, fish market FP, fallen victim FN
"""

import os
import cv2
import numpy as np
import logging
from datetime import datetime
from pathlib import Path
from dataclasses import asdict
from typing import Tuple, List, Set, Optional
import json

from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from flask_cors import CORS
from ultralytics import YOLO

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Try to import DeepSort for tracking
try:
    from deep_sort_realtime.deepsort_tracker import DeepSort
    DEEPSORT_AVAILABLE = True
except ImportError:
    DeepSort = None
    DEEPSORT_AVAILABLE = False
    logger.warning("DeepSort not available - tracking disabled")

# Import pose detector modules
from pose_detector import PoseCrimeDetector, MultiLayerValidator
from reasoning_layer import reasoning_layer

# Flask app configuration
app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "./ai_uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "gif", "tiff", "webp"}
MAX_CONTENT_LENGTH = 20 * 1024 * 1024  # 20MB

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
Path(UPLOAD_FOLDER).mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
#  Model initialization
# ─────────────────────────────────────────────────────────────────────────────

logger.info("Initializing models...")

# Pose model
try:
    _pose_model = YOLO("yolov8n-pose.pt")
    logger.info("✅ Pose model loaded successfully")
except Exception as e:
    _pose_model = None
    logger.error(f"❌ Failed to load pose model: {e}")

# Weapon/object model
try:
    _weapon_model = YOLO("yolov8n.pt")
    logger.info("✅ Object detection model loaded successfully")
except Exception as e:
    _weapon_model = None
    logger.error(f"❌ Failed to load object model: {e}")

# Pose detector
try:
    _detector = PoseCrimeDetector()
    logger.info("✅ PoseCrimeDetector initialized")
except Exception as e:
    _detector = None
    logger.error(f"❌ Failed to initialize detector: {e}")

# Tracker
if DEEPSORT_AVAILABLE:
    try:
        _tracker = DeepSort(max_age=30, n_init=2, max_cosine_distance=0.3)
        _track_history: dict = {}
        logger.info("✅ DeepSort tracker initialized")
    except Exception as e:
        _tracker = None
        _track_history = {}
        logger.error(f"❌ Failed to initialize tracker: {e}")
else:
    _tracker = None
    _track_history = {}

# Multi-layer validator
_validator = (
    MultiLayerValidator(_pose_model, _weapon_model, _detector)
    if _pose_model and _detector else None
)
if _validator:
    logger.info("✅ MultiLayerValidator initialized")
else:
    logger.error("❌ Validator initialization failed")


# ─────────────────────────────────────────────────────────────────────────────
#  Constants
# ─────────────────────────────────────────────────────────────────────────────

SAFE_LOCATIONS = {
    "kitchen", "restaurant", "home", "market", "fish_market",
    "supermarket", "cafeteria", "butcher", "shop", "food_stall",
}

CRIMINAL_ACTIVITIES = {
    "PHYSICAL_ASSAULT", "CHOKING_MOTION", "RESTRAINING_MOTION",
    "RESTRAINT_ATTEMPT", "STABBING_ATTACK", "ARMED_THREAT",
    "SHOOTING_THREAT", "WEAPON_THREAT",
}

CRIMINAL_SIGNALS = {
    "DIRECT_ASSAULT", "DOMINANT_OVER_FALLEN", "ASSAULT_HEAD", "GRAB_NECK_LEFT",
    "GRAB_NECK_RIGHT", "GUN_AIMING_LEFT", "GUN_AIMING_RIGHT", "GUN_HOLDING_LEFT",
    "GUN_HOLDING_RIGHT", "RESTRAINING_HOLD", "BODY_COLLISION", "GRABBING",
    "FALLEN", "VULNERABLE_POSITION", "POWER_IMBALANCE",
}


# ─────────────────────────────────────────────────────────────────────────────
#  Helper functions
# ─────────────────────────────────────────────────────────────────────────────

def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def elapsed_ms(start_time: datetime) -> float:
    """Calculate elapsed milliseconds since start_time"""
    return round((datetime.now() - start_time).total_seconds() * 1000, 2)

def _is_aggressive_track(history: list) -> bool:
    """Detect aggressive motion from track history"""
    if len(history) < 3:
        return False
    total_movement = sum(
        abs(history[i][0] - history[i-1][0]) + abs(history[i][1] - history[i-1][1])
        for i in range(1, len(history))
    )
    return total_movement > 55.0

def _is_portrait_detection(detection: dict) -> bool:
    """
    Heuristic to detect when the image is just a face/portrait and the model
    has fired false activity signals on the upper body.
    
    Conditions (all must be true):
      - persons_detected == 1
      - No criminal signals detected
      - Only non-criminal activities
      - threat_score < 45
    """
    persons = int(detection.get("persons_detected", 0) or 0)
    signals = set(detection.get("signals", []) or [])
    activities = set(detection.get("activities", []) or [])
    raw_score = float(detection.get("raw_threat_score") or detection.get("threat_score", 0) or 0)

    if persons != 1:
        return False
    if signals & CRIMINAL_SIGNALS:
        return False
    if activities & CRIMINAL_ACTIVITIES:
        return False
    if raw_score >= 45:
        return False

    return True

def reasoning_engine(detection: dict, weapons: list, location: str = "unknown") -> Tuple[float, str]:
    """Compatibility wrapper that delegates final level to reasoning_layer."""
    crime_detected, _crime_type = reasoning_layer(detection, location)
    raw_score = float(detection.get("threat_score", 0) or 0)

    if crime_detected:
        return max(raw_score, 80.0), "CRITICAL"

    return min(raw_score, 20.0), "NORMAL"


def _reconcile_final_decision(detection: dict, crime_detected: bool, crime_type: str) -> Tuple[bool, str, str]:
    """Prevent contradictory outputs where high raw risk is reported as SAFE.

    The reasoning layer remains the primary decision engine. This guard only
    escalates when upstream detector output already indicates strong evidence.
    """
    final_crime = bool(crime_detected)
    final_type = crime_type

    raw_score = float(detection.get("threat_score", 0) or 0)
    raw_level = str(detection.get("threat_level", "") or "").upper()
    raw_type = str(detection.get("crime_type", "") or "").strip()
    signals = set(detection.get("signals", []) or [])

    critical_signals = {
        "DOMINANT_OVER_FALLEN",
        "DIRECT_ASSAULT",
        "GUN_AIMING_LEFT",
        "GUN_AIMING_RIGHT",
        "GRAB_NECK_LEFT",
        "GRAB_NECK_RIGHT",
        "RESTRAINING_HOLD",
    }

    must_escalate = (
        raw_score >= 55
        or raw_level in {"HIGH", "CRITICAL"}
        or bool(signals & critical_signals)
    )

    if not final_crime and must_escalate:
        final_crime = True

        if "GUN_AIMING_LEFT" in signals or "GUN_AIMING_RIGHT" in signals:
            final_type = "Armed Threat"
        elif "DOMINANT_OVER_FALLEN" in signals or "FALLEN" in signals:
            final_type = "Physical Assault (Victim on Ground)"
        elif raw_type and raw_type.lower() not in {"normal", "normal (filtered)", "filtered"}:
            final_type = raw_type
        else:
            final_type = "Suspicious Activity"

    # Calibrated final level: do not mark every detected crime as CRITICAL.
    strong_critical_signals = {
        "GUN_AIMING_LEFT",
        "GUN_AIMING_RIGHT",
        "DOMINANT_OVER_FALLEN",
        "DIRECT_ASSAULT",
        "GRAB_NECK_LEFT",
        "GRAB_NECK_RIGHT",
        "RESTRAINING_HOLD",
        "ASSAULT_HEAD",
        "BODY_COLLISION",
    }
    has_strong_signal = bool(signals & strong_critical_signals)
    normalized_type = str(final_type or "").lower()
    severe_type = any(
        token in normalized_type
        for token in ("armed threat", "physical assault", "violent", "choking", "shooting")
    )

    if not final_crime:
        final_level = "NORMAL"
    elif has_strong_signal or severe_type:
        if raw_score >= 70:
            final_level = "CRITICAL"
        elif raw_score >= 45:
            final_level = "HIGH"
        else:
            final_level = "MEDIUM"
    elif "suspicious" in normalized_type:
        if raw_score >= 55:
            final_level = "HIGH"
        elif raw_score >= 25:
            final_level = "MEDIUM"
        else:
            final_level = "LOW"
    else:
        if raw_score >= 70:
            final_level = "HIGH"
        elif raw_score >= 35:
            final_level = "MEDIUM"
        else:
            final_level = "LOW"

    return final_crime, final_type, final_level


def generate_explanation(level: str, detection: dict, weapons: list) -> str:
    """Generate human-readable explanation of detection"""
    persons = int(detection.get("persons_detected", 0) or 0)
    activities = list(detection.get("activities", []) or [])
    signals = list(detection.get("signals", []) or [])
    ss = set(signals)
    wt = ", ".join(sorted(set(weapons))) if weapons else "no weapon"

    if level == "CRITICAL":
        if "GUN_AIMING_LEFT" in ss or "GUN_AIMING_RIGHT" in ss:
            return f"CRITICAL — Active aiming threat detected ({wt}). Immediate response required."
        if "DOMINANT_OVER_FALLEN" in ss:
            return "CRITICAL — Assault on fallen victim: attacker in dominant position over grounded person."
        if "GRAB_NECK_LEFT" in ss or "GRAB_NECK_RIGHT" in ss:
            return f"CRITICAL — Choking/attempted murder: neck-grab detected ({persons} person(s))."
        if "FALLEN" in ss and ("DOMINANT_POSITION" in activities or "POWER_IMBALANCE" in ss):
            return f"CRITICAL — Assault on downed victim detected ({persons} person(s) in scene)."
        if weapons:
            return f"CRITICAL — Armed threat: {wt} with {persons} person(s) in aggressive interaction."
        return f"CRITICAL — Severe physical assault: {persons} person(s), signals: {signals[:3]}."
    
    if level == "HIGH":
        return f"HIGH — Violent interaction: {persons} person(s). Activities: {activities[:3]}. Signals: {signals[:3]}."
    
    if level == "MEDIUM":
        return "MEDIUM — Suspicious activity detected. Recommend review and monitoring."

    if level == "LOW":
        return "LOW — Mild suspicious cues detected. Continue monitoring."
    
    if detection.get("rejected_at_layer"):
        return f"Filtered ({detection.get('rejected_at_layer')}). No reliable evidence of crime."
    
    return "Normal activity. No threat indicators detected."


# ─────────────────────────────────────────────────────────────────────────────
#  API Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy" if _validator else "unhealthy",
        "service": "crime-detection-api-v4",
        "timestamp": datetime.now().isoformat(),
        "model_loaded": _validator is not None,
        "tracking": _tracker is not None,
        "deep_sort_available": DEEPSORT_AVAILABLE,
    })


@app.route("/detect-image", methods=["POST"])
def detect_image():
    """
    Detect crime in uploaded image
    
    Expected form data:
        - image: Image file
        - location: Optional location string
        - camera_id: Optional camera identifier
        - timestamp: Optional timestamp
        - fresh_session: Optional flag to reset temporal history
    """
    start = datetime.now()

    if _validator is None:
        logger.error("Detection system not initialized")
        return jsonify({
            "success": False,
            "message": "Detection system not initialised",
            "response_time_ms": elapsed_ms(start)
        }), 500

    if "image" not in request.files:
        return jsonify({
            "success": False,
            "message": "No image file provided",
            "response_time_ms": elapsed_ms(start)
        }), 400

    file = request.files["image"]
    location = request.form.get("location", "Unknown")
    camera_id = request.form.get("camera_id", "Unknown")
    timestamp = request.form.get("timestamp", datetime.now().isoformat())
    fresh_session = request.form.get("fresh_session", "0") == "1"

    if not file.filename or not allowed_file(file.filename):
        return jsonify({
            "success": False,
            "message": "Invalid file type",
            "response_time_ms": elapsed_ms(start)
        }), 400

    # Save and read image
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)
    
    image = cv2.imread(filepath)
    try:
        os.remove(filepath)  # Clean up
    except:
        pass

    if image is None:
        return jsonify({
            "success": False,
            "message": "Could not read image",
            "response_time_ms": elapsed_ms(start)
        }), 400

    if fresh_session:
        _validator.reset_temporal()

    # Run validation
    result = _validator.validate(image, location=location)
    detection = asdict(result)
    weapons = detection.get("weapons", []) or []

    # Store raw scores before reasoning overrides
    detection["raw_threat_score"] = detection.get("threat_score")
    detection["raw_confidence"] = detection.get("confidence")

    # DeepSort tracking integration
    if _tracker is not None:
        boxes = detection.get("boxes", []) or []
        if boxes:
            tinputs = [([b[0], b[1], b[2] - b[0], b[3] - b[1]], 1.0, "person") for b in boxes]
            tracks = _tracker.update_tracks(tinputs, frame=image)

            confirmed = [t for t in tracks if t.is_confirmed()]
            for track in confirmed:
                tid = track.track_id
                ltrb = list(track.to_ltrb())
                if tid not in _track_history:
                    _track_history[tid] = []
                _track_history[tid].append(ltrb)
                if len(_track_history[tid]) > 10:
                    _track_history[tid].pop(0)

            if len(confirmed) >= 2:
                detection["interaction_confirmed"] = True

            if any(_is_aggressive_track(h) for h in _track_history.values()):
                detection["aggressive_tracking"] = True

            # Clean up old tracks
            if len(_track_history) > 50:
                _track_history.clear()

    crime_detected, crime_type = reasoning_layer(detection, location)
    crime_detected, crime_type, final_level = _reconcile_final_decision(
        detection, crime_detected, crime_type
    )

    # Optional crowd-scene calibration: reduce inflated aggregate score when
    # many people are present in a single frame.
    if int(detection.get("persons_detected", 0) or 0) >= 5:
        detection["threat_score"] = float(detection.get("threat_score", 0) or 0) * 0.5

    final_score = float(detection.get("threat_score", 0) or 0)

    explanation = generate_explanation(final_level, detection, weapons)
    confidence = round(min(1.0, max(0.0, final_score / 100.0)), 3)

    logger.info(f"Detection: persons={detection.get('persons_detected')}, "
                f"weapons={weapons}, level={final_level}, score={final_score:.1f}, loc={location}")

    payload = {
        "success": True,
        "crime_detected": bool(crime_detected),
        "type": crime_type,
        "crime_type": crime_type,
        "threat_level": final_level,
        "threat_score": float(final_score),
        "confidence": confidence,
        "persons_detected": int(detection.get("persons_detected", 0) or 0),
        "signals": detection.get("signals", []),
        "activities": detection.get("activities", []),
        "weapons_detected": weapons,
        "weapons": weapons,
        "explanation": explanation,
        "raw_crime_type": detection.get("crime_type"),
        "raw_threat_level": detection.get("threat_level"),
        "raw_threat_score": detection.get("raw_threat_score"),
        "raw_confidence": detection.get("raw_confidence"),
        "rejected_at_layer": detection.get("rejected_at_layer"),
        "location": location,
        "camera_id": camera_id,
        "timestamp": timestamp,
        "analysis_timestamp": datetime.now().isoformat(),
        "response_time_ms": elapsed_ms(start),
        "system_status": "operational",
    }

    if crime_detected:
        logger.warning(f"🚨 {final_level}: {crime_type} @ {location} "
                       f"score={final_score:.1f} conf={confidence}")

    return jsonify(payload)


@app.route("/batch-detect", methods=["POST"])
def batch_detect():
    """
    Batch detection for multiple images
    
    Expected form data:
        - images: List of image files
        - location: Optional location string
    """
    start = datetime.now()
    location = request.form.get("location", "Unknown")

    if _validator is None:
        return jsonify({
            "success": False,
            "message": "Detection system not initialized",
            "response_time_ms": elapsed_ms(start)
        }), 500

    if "images" not in request.files:
        return jsonify({
            "success": False,
            "message": "No images provided",
            "response_time_ms": elapsed_ms(start)
        }), 400

    results = []
    for file in request.files.getlist("images"):
        if not (file and allowed_file(file.filename)):
            continue
            
        fb = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(fb, cv2.IMREAD_COLOR)
        if image is None:
            continue

        _validator.reset_temporal()
        result = _validator.validate(image, location=location)
        det = asdict(result)
        det["raw_threat_score"] = det.get("threat_score")
        wp = det.get("weapons", []) or []

        crime_detected, ct = reasoning_layer(det, location)
        crime_detected, ct, fl = _reconcile_final_decision(det, crime_detected, ct)

        if int(det.get("persons_detected", 0) or 0) >= 5:
            det["threat_score"] = float(det.get("threat_score", 0) or 0) * 0.5

        fs = float(det.get("threat_score", 0) or 0)

        results.append({
            "filename": secure_filename(file.filename),
            "detection": {
                "crime_detected": crime_detected,
                "crime_type": ct,
                "threat_level": fl,
                "threat_score": float(fs),
                "confidence": round(fs / 100.0, 3),
                "persons_detected": result.persons_detected,
                "signals": result.signals,
                "activities": result.activities,
                "weapons_detected": wp,
                "rejected_at_layer": result.rejected_at_layer,
                "explanation": generate_explanation(fl, det, wp),
            },
        })

    return jsonify({
        "success": True,
        "results": results,
        "total_processed": len(results),
        "response_time_ms": elapsed_ms(start),
    })


# ─────────────────────────────────────────────────────────────────────────────
#  Error handlers
# ─────────────────────────────────────────────────────────────────────────────

@app.errorhandler(413)
def too_large(e):
    return jsonify({"success": False, "message": "File exceeds 20MB limit"}), 413

@app.errorhandler(404)
def not_found(e):
    return jsonify({"success": False, "message": "Endpoint not found"}), 404

@app.errorhandler(500)
def server_error(e):
    logger.error(f"Server error: {e}")
    return jsonify({"success": False, "message": "Internal server error"}), 500


# ─────────────────────────────────────────────────────────────────────────────
#  Main entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "=" * 65)
    print("🤖  CRIME DETECTION API  v4")
    print("   (portrait + fish market + fallen victim fixes)")
    print("=" * 65)
    print("\n📋 Available endpoints:")
    print("   POST   /detect-image   - Single image analysis")
    print("   POST   /batch-detect   - Batch image analysis")
    print("   GET    /health         - System health check")
    print("\n📝 Example usage:")
    print("   curl -X POST http://localhost:8000/detect-image \\")
    print("        -F 'image=@test.jpg' \\")
    print("        -F 'location=street'")
    print("\n" + "=" * 65)
    print("🚀 Starting server on http://0.0.0.0:8000")
    print("=" * 65 + "\n")
    
    app.run(host="0.0.0.0", port=8000, debug=False, threaded=True)