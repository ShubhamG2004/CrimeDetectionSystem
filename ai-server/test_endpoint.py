#!/usr/bin/env python3
"""Test script for AI server detect-image endpoint"""

import requests
import cv2
import numpy as np
from io import BytesIO

# Create a simple test image (just a blank image)
test_image = np.zeros((480, 640, 3), dtype=np.uint8)
# Add some random noise to make it not completely blank
test_image += np.random.randint(0, 50, (480, 640, 3), dtype=np.uint8)

# Encode to PNG bytes
is_success, buffer = cv2.imencode('.png', test_image)
img_bytes = BytesIO(buffer)

# Prepare the request
files = {'image': ('test.png', img_bytes, 'image/png')}

try:
    print("🧪 Testing AI server /detect-image endpoint...")
    print("📤 Sending test image to http://127.0.0.1:8000/detect-image")
    
    response = requests.post(
        'http://127.0.0.1:8000/detect-image',
        files=files,
        timeout=30
    )
    
    print(f"✅ Status Code: {response.status_code}")
    print(f"📦 Response:")
    print(response.json())
    
except Exception as e:
    print(f"❌ Error: {e}")
