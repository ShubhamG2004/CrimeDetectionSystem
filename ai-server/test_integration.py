#!/usr/bin/env python3
"""Comprehensive test of the Crime Detection System"""

import requests
import cv2
import numpy as np
from io import BytesIO
import json

def create_test_image(name="blank"):
    """Create a test image"""
    if name == "blank":
        # Blank image - should be detected as Normal/Safe
        test_image = np.zeros((480, 640, 3), dtype=np.uint8)
        test_image += np.random.randint(0, 30, (480, 640, 3), dtype=np.uint8)
    else:
        # Create a simple test image
        test_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
    
    is_success, buffer = cv2.imencode('.png', test_image)
    return BytesIO(buffer)

def test_ai_server_direct():
    """Test AI server directly"""
    print("\n" + "="*60)
    print("TEST 1: AI Server Direct (/detect-image)")
    print("="*60)
    
    try:
        files = {'image': ('test.png', create_test_image(), 'image/png')}
        response = requests.post(
            'http://127.0.0.1:8000/detect-image',
            files=files,
            timeout=30
        )
        
        print(f"✅ Status: {response.status_code}")
        data = response.json()
        
        # Check for required fields
        required_fields = ['type', 'confidence', 'crime_detected', 'threat_level', 'persons_detected']
        missing = [f for f in required_fields if f not in data]
        
        if missing:
            print(f"❌ Missing fields: {missing}")
        else:
            print("✅ All required fields present")
            print(f"  - type: {data.get('type')}")
            print(f"  - crime_detected: {data.get('crime_detected')}")
            print(f"  - threat_level: {data.get('threat_level')}")
            print(f"  - persons_detected: {data.get('persons_detected')}")
        
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_backend_detect():
    """Test backend /api/detect/image endpoint"""
    print("\n" + "="*60)
    print("TEST 2: Backend Endpoint (/api/detect/image)")
    print("="*60)
    
    try:
        img_file = create_test_image()
        files = {'image': ('test.png', img_file, 'image/png')}
        data = {
            'cameraId': 'test-camera-001',
            'location': json.dumps({
                'name': 'Test Location',
                'lat': 18.5,
                'lng': 73.8,
            })
        }
        
        response = requests.post(
            'http://localhost:5000/api/detect/image',
            files=files,
            data=data,
            timeout=30
        )
        
        print(f"✅ Status: {response.status_code}")
        result = response.json()
        
        if response.status_code == 200:
            print("✅ Request successful")
            print(f"  - Success: {result.get('success')}")
            if result.get('data'):
                print(f"  - Crime Type: {result['data'].get('type')}")
                print(f"  - Threat Level: {result['data'].get('threat_level')}")
        else:
            print(f"❌ Error Response: {result}")
        
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print("\n" + "="*60)
    print("🔥 CRIME DETECTION SYSTEM - INTEGRATION TEST")
    print("="*60)
    
    test1_ok = test_ai_server_direct()
    test2_ok = test_backend_detect()
    
    print("\n" + "="*60)
    print("📊 TEST RESULTS")
    print("="*60)
    print(f"✅ AI Server Direct:  {'PASS' if test1_ok else 'FAIL'}")
    print(f"✅ Backend Endpoint:  {'PASS' if test2_ok else 'FAIL'}")
    print("="*60)
    
    if test1_ok and test2_ok:
        print("\n🎉 All tests passed! System is operational.")
    else:
        print("\n⚠️  Some tests failed. Check the details above.")

if __name__ == '__main__':
    main()
