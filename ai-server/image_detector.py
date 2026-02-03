"""
AI SERVER - Fixed Response Format
"""

import os
import cv2
from datetime import datetime
from pathlib import Path
import numpy as np
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

from pose_detector import PoseCrimeDetector

app = Flask(__name__)

# CORS headers
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
    return response

UPLOAD_FOLDER = "./uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp"}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
Path(UPLOAD_FOLDER).mkdir(parents=True, exist_ok=True)

# Initialize detector
print("🔄 Loading crime detection model...")
try:
    detector = PoseCrimeDetector()
    print("✅ Crime detector initialized successfully!")
except Exception as e:
    print(f"❌ Failed to initialize detector: {e}")
    detector = None

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/detect-image', methods=['POST', 'OPTIONS'])
def detect_image():
    if request.method == 'OPTIONS':
        return '', 200
    
    temp_filepath = None
    
    try:
        if 'image' not in request.files:
            return jsonify({
                "success": False,
                "error": "No image file provided",
                "type": "NO_IMAGE",
                "confidence": 0.0
            }), 400
        
        file = request.files['image']
        location = request.form.get('location', 'Unknown').strip()
        
        if file.filename == '':
            return jsonify({
                "success": False,
                "error": "No selected file",
                "type": "NO_IMAGE",
                "confidence": 0.0
            }), 400
        
        if not allowed_file(file.filename):
            return jsonify({
                "success": False,
                "error": "File type not allowed. Use PNG, JPG, or BMP.",
                "type": "INVALID_IMAGE",
                "confidence": 0.0
            }), 400
        
        if detector is None:
            return jsonify({
                "success": False,
                "error": "Detection system is not ready",
                "type": "SYSTEM_ERROR",
                "confidence": 0.0
            }), 500
        
        # Save file temporarily
        filename = secure_filename(file.filename)
        temp_filepath = os.path.join(app.config['UPLOAD_FOLDER'], 
                                    f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}")
        file.save(temp_filepath)
        
        # Read image
        image = cv2.imread(temp_filepath)
        if image is None:
            return jsonify({
                "success": False,
                "error": "Could not read image file",
                "type": "INVALID_IMAGE",
                "confidence": 0.0
            }), 400
        
        # Run detection
        result = detector.analyze(image)
        
        # Debug print
        print("\n" + "="*50)
        print("DEBUG - Raw result from detector:")
        print(f"Persons detected: {result.get('persons_detected')}")
        print(f"Threat score: {result.get('threat_score')}")
        print(f"Confidence: {result.get('confidence')}")
        print(f"Signals: {result.get('signals')}")
        print(f"Activities: {result.get('activities')}")
        print("="*50 + "\n")
        
        # Prepare response - ensure all fields are present
        response = {
            "success": True,
            "type": result.get("crime_type", "Normal"),
            "confidence": float(result.get("confidence", 0.0)),
            "crime_detected": bool(result.get("crime_detected", False)),
            "threat_level": result.get("threat_level", "LOW"),
            "persons_detected": int(result.get("persons_detected", 0)),
            "activities": result.get("activities", []),
            "signals": result.get("signals", []),
            "threat_score": int(result.get("threat_score", 0)),
            "location": location,
            "timestamp": datetime.now().isoformat()
        }
        
        # Log detection
        if response["crime_detected"]:
            print(f"🚨 CRIME DETECTED: {response['type']} at {location}")
        else:
            print(f"✅ Normal activity at {location}")
        
        print(f"   People: {response['persons_detected']}, Threat: {response['threat_level']}")
        print(f"   Score: {response['threat_score']}, Confidence: {response['confidence']}")
        
        return jsonify(response)
        
    except Exception as e:
        print(f"Server error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "success": False,
            "error": f"Detection failed: {str(e)}",
            "type": "ERROR",
            "confidence": 0.0
        }), 500
    
    finally:
        # Clean up temp file
        if temp_filepath and os.path.exists(temp_filepath):
            try:
                os.remove(temp_filepath)
            except:
                pass

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "running",
        "detector_ready": detector is not None,
        "service": "crime-detection-api",
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🤖 AI CRIME DETECTION SERVER")
    print("="*60)
    print("📡 Endpoints:")
    print("  POST /detect-image  - Upload image for analysis")
    print("  GET  /health        - Health check")
    print("\n📍 Server URL:")
    print("  http://localhost:8000")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=8000, debug=False)