"""
Configuration Module - System configuration and settings
"""

import os
from typing import Dict
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """System configuration"""
    
    # Camera settings
    CAMERA_SOURCE = int(os.getenv('CAMERA_SOURCE', '0'))  # 0 = default webcam
    CAMERA_WIDTH = int(os.getenv('CAMERA_WIDTH', '640'))
    CAMERA_HEIGHT = int(os.getenv('CAMERA_HEIGHT', '480'))
    CAPTURE_INTERVAL = float(os.getenv('CAPTURE_INTERVAL', '2.0'))  # seconds
    
    # Detection settings
    SSIM_SKIP_THRESHOLD = float(os.getenv('SSIM_SKIP_THRESHOLD', '0.95'))
    CRIME_DETECTION_THRESHOLD = float(os.getenv('CRIME_DETECTION_THRESHOLD', '30.0'))
    
    # Display settings
    DISPLAY_ENABLED = os.getenv('DISPLAY_ENABLED', 'True').lower() == 'true'
    DISPLAY_DETECTIONS = os.getenv('DISPLAY_DETECTIONS', 'True').lower() == 'true'
    FPS_LIMIT = int(os.getenv('FPS_LIMIT', '30'))
    
    # Alert settings
    ALERT_DIR = os.getenv('ALERT_DIR', './alerts')
    WEBHOOK_URL = os.getenv('WEBHOOK_URL', '')  # Optional webhook URL
    ENABLE_EMAIL_ALERTS = os.getenv('ENABLE_EMAIL_ALERTS', 'False').lower() == 'true'
    
    # AI settings
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')  # Optional OpenAI API key
    AI_MODEL = os.getenv('AI_MODEL', 'gpt-4-vision-preview')
    ENABLE_AI_ANALYSIS = os.getenv('ENABLE_AI_ANALYSIS', 'False').lower() == 'true'
    
    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'crime_detection.log')
    
    # Performance
    SKIP_SIMILAR_FRAMES = os.getenv('SKIP_SIMILAR_FRAMES', 'True').lower() == 'true'
    MAX_ANALYSIS_HISTORY = int(os.getenv('MAX_ANALYSIS_HISTORY', '100'))
    
    # Advanced settings
    USE_OPTICAL_FLOW = os.getenv('USE_OPTICAL_FLOW', 'True').lower() == 'true'
    USE_FRAME_DIFF = os.getenv('USE_FRAME_DIFF', 'True').lower() == 'true'
    MOTION_DETECTION_SENSITIVITY = float(os.getenv('MOTION_DETECTION_SENSITIVITY', '1.0'))
    # Detection robustness
    DETECTION_PERSISTENCE = int(os.getenv('DETECTION_PERSISTENCE', '2'))  # require N consecutive positives
    SMOOTHING_ALPHA = float(os.getenv('SMOOTHING_ALPHA', '0.6'))  # 0-1, higher = rely more on current score


def print_config():
    """Print current configuration"""
    print("\n" + "="*60)
    print("SYSTEM CONFIGURATION")
    print("="*60)
    print(f"Camera Source:              {Config.CAMERA_SOURCE}")
    print(f"Resolution:                 {Config.CAMERA_WIDTH}x{Config.CAMERA_HEIGHT}")
    print(f"Capture Interval:           {Config.CAPTURE_INTERVAL}s")
    print(f"SSIM Skip Threshold:        {Config.SSIM_SKIP_THRESHOLD}")
    print(f"Crime Detection Threshold:  {Config.CRIME_DETECTION_THRESHOLD}")
    print(f"Motion Sensitivity:        {Config.MOTION_DETECTION_SENSITIVITY}")
    print(f"Detection Persistence:     {Config.DETECTION_PERSISTENCE}")
    print(f"Smoothing Alpha:           {Config.SMOOTHING_ALPHA}")
    print(f"Display Enabled:            {Config.DISPLAY_ENABLED}")
    print(f"Alert Directory:            {Config.ALERT_DIR}")
    print(f"Webhook URL:                {'Configured' if Config.WEBHOOK_URL else 'Not configured'}")
    print(f"OpenAI API:                 {'Configured' if Config.OPENAI_API_KEY else 'Not configured'}")
    print(f"Enable AI Analysis:         {Config.ENABLE_AI_ANALYSIS}")
    print(f"Log Level:                  {Config.LOG_LEVEL}")
    print("="*60 + "\n")


def load_config_from_dict(config_dict: Dict) -> None:
    """
    Load configuration from dictionary
    
    Args:
        config_dict: Configuration dictionary
    """
    for key, value in config_dict.items():
        if hasattr(Config, key.upper()):
            setattr(Config, key.upper(), value)


def get_config_dict() -> Dict:
    """
    Get current configuration as dictionary
    
    Returns:
        Configuration dictionary
    """
    return {
        'camera_source': Config.CAMERA_SOURCE,
        'camera_width': Config.CAMERA_WIDTH,
        'camera_height': Config.CAMERA_HEIGHT,
        'capture_interval': Config.CAPTURE_INTERVAL,
        'ssim_skip_threshold': Config.SSIM_SKIP_THRESHOLD,
        'crime_detection_threshold': Config.CRIME_DETECTION_THRESHOLD,
        'display_enabled': Config.DISPLAY_ENABLED,
        'alert_dir': Config.ALERT_DIR,
        'webhook_url': Config.WEBHOOK_URL,
        'openai_api_key': bool(Config.OPENAI_API_KEY),
        'enable_ai_analysis': Config.ENABLE_AI_ANALYSIS,
        'log_level': Config.LOG_LEVEL
    }
