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
    """
    Apply business logic to determine final threat level
    
    Args:
        detection: Raw detection results
        weapons: Detected weapons list
        location: Location context
        
    Returns:
        Tuple of (threat_score, threat_level)
    """
    persons = int(detection.get("persons_detected", 0) or 0)
    activities = list(detection.get("activities", []) or [])
    signals = list(detection.get("signals", []) or [])
    ss = set(signals)
    aa = set(activities)
    has_weapon = bool(weapons)
    agg_trk = bool(detection.get("aggressive_tracking"))

    # FIX 1: Portrait / face-only detection → NORMAL
    if _is_portrait_detection(detection):
        logger.debug("Portrait/headshot detected, forcing NORMAL")
        return 5.0, "NORMAL"

    # FIX 2: Safe location hard block
    loc = (location or "").lower().replace(" ", "_")
    aggression_present = bool(ss & CRIMINAL_SIGNALS) or any(
        a in aa for a in [
            "PHYSICAL_ASSAULT", "KICKING_MOTION", "AGGRESSIVE_GESTURE",
            "CHOKING_MOTION", "SHOOTING_THREAT", "RESTRAINT_ATTEMPT",
        ]
    )
    
    if loc in SAFE_LOCATIONS and not aggression_present:
        # Strip knife/stab activities — they're cooking, not crime
        safe_activities = {"STABBING_ATTACK", "ARMED_THREAT", "WEAPON_THREAT",
                           "THREATENING_GESTURE", "STABBING_MOTION_LEFT", "STABBING_MOTION_RIGHT"}
        safe_signals = {"KNIFE_WIELDING_LEFT", "KNIFE_WIELDING_RIGHT",
                        "STABBING_MOTION_LEFT", "STABBING_MOTION_RIGHT",
                        "WEAPON_THREAT_LEFT", "WEAPON_THREAT_RIGHT"}
        aa -= safe_activities
        ss -= safe_signals
        
        # After stripping, if nothing criminal remains → NORMAL
        if not (ss & CRIMINAL_SIGNALS) and not (aa & CRIMINAL_ACTIVITIES):
            return 8.0, "NORMAL"

    # FIX 4: GUN_AIMING → always CRITICAL
    if "GUN_AIMING_LEFT" in ss or "GUN_AIMING_RIGHT" in ss:
        return 98.0, "CRITICAL"

    # Weapon + people combinations
    if has_weapon and persons >= 2:
        return 95.0, "CRITICAL"
    if has_weapon and persons == 1:
        return 62.0, "HIGH"

    # Pose-based CRITICAL overrides
    if "DOMINANT_OVER_FALLEN" in ss:
        return 92.0, "CRITICAL"
    if "GRAB_NECK_LEFT" in ss or "GRAB_NECK_RIGHT" in ss:
        return 90.0, "CRITICAL"
    if "RESTRAINING_HOLD" in ss and "VULNERABLE_POSITION" in ss:
        return 88.0, "CRITICAL"
    if "FALLEN" in ss and "GRABBING" in ss and "POWER_IMBALANCE" in ss:
        return 88.0, "CRITICAL"

    # FIX 3: Fallen victim inferred at persons==1
    if "FALLEN" in ss and ("DOMINANT_POSITION" in aa or "POWER_IMBALANCE" in ss):
        return 85.0, "CRITICAL"

    # HIGH level threats
    if persons >= 2 and "KICKING_MOTION" in aa:
        return 76.0, "HIGH"
    if persons >= 2 and "PHYSICAL_ASSAULT" in aa:
        return 86.0, "HIGH"
    if "DIRECT_ASSAULT" in ss:
        return 86.0, "HIGH"
    if agg_trk and persons >= 2:
        return 82.0, "HIGH"

    has_aggression = any(a in aa for a in [
        "PHYSICAL_ASSAULT", "KICKING_MOTION", "AGGRESSIVE_GESTURE",
        "STABBING_ATTACK", "ARMED_THREAT", "CHOKING_MOTION", "SHOOTING_THREAT",
    ])
    has_interaction = any(s in ss for s in [
        "CLOSE_CONTACT", "BODY_COLLISION", "GRABBING", "DIRECT_ASSAULT",
    ]) or bool(detection.get("interaction_confirmed"))

    if not has_aggression and not has_weapon and len(signals) < 2:
        return 10.0, "NORMAL"

    if has_aggression and has_interaction and persons >= 2:
        return 80.0, "HIGH"

    if persons == 1 and (
            "GUN_HOLDING_LEFT" in ss or "GUN_HOLDING_RIGHT" in ss
            or "WEAPON_THREAT_LEFT" in ss or "WEAPON_THREAT_RIGHT" in ss):
        return 40.0, "MEDIUM"

    # Scored path
    score = 0.0
    if persons >= 2:
        score += 22
    if has_aggression:
        score += 28
    if has_interaction:
        score += 18
    if "KICKING_MOTION" in aa:
        score += 22
    if "PHYSICAL_ASSAULT" in aa:
        score += 30
    if "FOLLOWING_CHASING" in aa:
        score += 18
    if "STABBING_ATTACK" in aa:
        score += 40
    if "SHOOTING_THREAT" in aa:
        score += 45
    if "RESTRAINT_ATTEMPT" in aa:
        score += 28
    if agg_trk:
        score += 12

    base = float(detection.get("threat_score", 0) or 0)
    score += 0.25 * min(100.0, max(0.0, base))

    logger.debug(f"Signals: {signals}, Activities: {list(aa)}, Score: {score:.1f}, Location: {location}")

    if score >= 80:
        return score, "CRITICAL"
    if score >= 55:
        return score, "HIGH"
    if score >= 28:
        return score, "MEDIUM"
    return score, "NORMAL"


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

    # Apply reasoning engine
    if detection.get("rejected_at_layer"):
        final_score = float(detection.get("threat_score", 0) or 0)
        final_level = "LOW"
        crime_detected = False
        crime_type = "Normal"
    else:
        final_score, final_level = reasoning_engine(detection, weapons, location=location)
        crime_detected = final_level in ("HIGH", "CRITICAL")

        if final_level == "CRITICAL":
            crime_type = "Armed Threat" if weapons else "Physical Violence"
        elif final_level == "HIGH":
            crime_type = "Physical Violence"
        elif final_level == "MEDIUM":
            crime_type = "Suspicious Activity"
        else:
            crime_type = "Normal"

        # Final safety guard
        persons_final = int(detection.get("persons_detected", 0) or 0)
        ss_final = set(detection.get("signals", []) or [])
        gun_aiming = "GUN_AIMING_LEFT" in ss_final or "GUN_AIMING_RIGHT" in ss_final
        fallen_pattern = (
            "DOMINANT_OVER_FALLEN" in ss_final
            or ("FALLEN" in ss_final and (
                "DOMINANT_POSITION" in (detection.get("activities") or [])
                or "POWER_IMBALANCE" in ss_final
            ))
        )

        if (not weapons and persons_final < 2 and not gun_aiming and not fallen_pattern
                and final_level in ("HIGH", "CRITICAL")):
            has_clear_criminal = bool(ss_final & {
                "GRAB_NECK_LEFT", "GRAB_NECK_RIGHT", "DIRECT_ASSAULT",
                "RESTRAINING_HOLD", "ASSAULT_HEAD",
            })
            if not has_clear_criminal:
                final_level = "MEDIUM"
                crime_type = "Suspicious Activity"
                crime_detected = False

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

    if final_level in ("HIGH", "CRITICAL"):
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

        if det.get("rejected_at_layer"):
            fs, fl = 0.0, "LOW"
            ct = "Normal"
        else:
            fs, fl = reasoning_engine(det, wp, location=location)
            ct = ("Armed Threat" if fl == "CRITICAL" and wp else
                  "Physical Violence" if fl in ("HIGH", "CRITICAL") else
                  "Suspicious Activity" if fl == "MEDIUM" else "Normal")

        results.append({
            "filename": secure_filename(file.filename),
            "detection": {
                "crime_detected": fl in ("HIGH", "CRITICAL"),
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