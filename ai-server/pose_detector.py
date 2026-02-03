from ultralytics import YOLO
import numpy as np
import math

class PoseCrimeDetector:
    def __init__(self):
        self.model = YOLO("yolov8n-pose.pt")
        print("✅ YOLO Pose model loaded")
        
    def analyze(self, image):
        try:
            # Run pose detection
            results = self.model(image, conf=0.4, verbose=False)[0]
            
            # Check if keypoints are available
            if results.keypoints is None or len(results.keypoints) == 0:
                return self._empty_result()
            
            kps_all = results.keypoints.xy.cpu().numpy()
            persons = len(kps_all)
            
            if persons == 0:
                return self._empty_result()
            
            # Initialize
            signals = []
            activities = []
            
            # ---- SINGLE PERSON ANALYSIS ----
            for kps in kps_all:
                person_signals, person_activities = self._analyze_person(kps)
                signals.extend(person_signals)
                activities.extend(person_activities)
            
            # ---- MULTI-PERSON ANALYSIS ----
            if persons >= 2:
                inter_signals, inter_activities = self._analyze_interactions(kps_all)
                signals.extend(inter_signals)
                activities.extend(inter_activities)
            
            # Remove duplicates
            signals = list(set(signals))
            activities = list(set(activities))
            
            # ---- THREAT SCORING ----
            threat_score = self._calculate_threat_score(signals, activities, persons)
            
            # ---- CLASSIFICATION ----
            crime_type, threat_level = self._classify(signals, activities, persons)
            crime_detected = threat_score >= 40  # Threshold for crime detection
            
            return {
                "persons_detected": persons,
                "signals": signals,
                "activities": activities,
                "threat_score": min(100, threat_score),
                "crime_detected": crime_detected,
                "crime_type": crime_type,
                "threat_level": threat_level,
                "confidence": min(100, threat_score) / 100.0  # Convert to 0-1
            }
            
        except Exception as e:
            print(f"Error in analyze: {e}")
            return self._empty_result()
    
    def _analyze_person(self, kps):
        """Analyze single person poses"""
        signals = []
        activities = []
        
        # Check for valid keypoints
        if np.isnan(kps).any():
            return signals, activities
        
        # Keypoint indices
        NOSE = 0
        L_SHOULDER = 5; R_SHOULDER = 6
        L_ELBOW = 7; R_ELBOW = 8
        L_WRIST = 9; R_WRIST = 10
        L_HIP = 11; R_HIP = 12
        L_KNEE = 13; R_KNEE = 14
        
        # Get keypoints
        nose = kps[NOSE]
        l_shoulder, r_shoulder = kps[L_SHOULDER], kps[R_SHOULDER]
        l_elbow, r_elbow = kps[L_ELBOW], kps[R_ELBOW]
        l_wrist, r_wrist = kps[L_WRIST], kps[R_WRIST]
        l_hip, r_hip = kps[L_HIP], kps[R_HIP]
        l_knee, r_knee = kps[L_KNEE], kps[R_KNEE]
        
        # Calculate torso height for normalization
        shoulder_mid = (l_shoulder + r_shoulder) / 2
        hip_mid = (l_hip + r_hip) / 2
        torso_height = np.linalg.norm(shoulder_mid - hip_mid)
        
        if torso_height < 10:
            return signals, activities
        
        # 1. PUNCH DETECTION (wrist above elbow)
        if l_wrist[1] < l_elbow[1] - 20:
            signals.append("PUNCH_LEFT")
            activities.append("AGGRESSIVE_MOTION")
        if r_wrist[1] < r_elbow[1] - 20:
            signals.append("PUNCH_RIGHT")
            activities.append("AGGRESSIVE_MOTION")
        
        # 2. KICK DETECTION (knee above hip)
        if l_knee[1] < l_hip[1] - 30:
            signals.append("KICK_LEFT")
            activities.append("KICKING_MOTION")
        if r_knee[1] < r_hip[1] - 30:
            signals.append("KICK_RIGHT")
            activities.append("KICKING_MOTION")
        
        # 3. WEAPON THREAT (straight arm)
        l_arm_length = np.linalg.norm(l_shoulder - l_wrist)
        r_arm_length = np.linalg.norm(r_shoulder - r_wrist)
        
        if l_arm_length > torso_height * 0.8 and abs(l_elbow[1] - l_wrist[1]) < 30:
            signals.append("WEAPON_THREAT_LEFT")
            activities.append("THREATENING_GESTURE")
        if r_arm_length > torso_height * 0.8 and abs(r_elbow[1] - r_wrist[1]) < 30:
            signals.append("WEAPON_THREAT_RIGHT")
            activities.append("THREATENING_GESTURE")
        
        # 4. NECK GRAB (wrist near neck area)
        neck_y = nose[1] + torso_height * 0.3
        neck_area = np.array([nose[0], neck_y])
        
        if np.linalg.norm(l_wrist - neck_area) < torso_height * 0.4:
            signals.append("GRAB_NECK_LEFT")
            activities.append("CHOKING_MOTION")
        if np.linalg.norm(r_wrist - neck_area) < torso_height * 0.4:
            signals.append("GRAB_NECK_RIGHT")
            activities.append("CHOKING_MOTION")
        
        # 5. FALLEN PERSON (check body orientation)
        verticality = self._calculate_verticality(kps)
        if verticality < 0.3:
            signals.append("FALLEN")
            activities.append("PRONE_POSITION")
        
        # 6. CROUCHING
        if (l_knee[1] > l_hip[1] + 40 or r_knee[1] > r_hip[1] + 40) and verticality > 0.6:
            activities.append("CROUCHING")
        
        # 7. RUNNING (legs in running position)
        if abs(l_knee[1] - r_knee[1]) > 40 and verticality > 0.7:
            activities.append("RUNNING")
        
        return signals, activities
    
    def _analyze_interactions(self, kps_all):
        """Analyze interactions between multiple people"""
        signals = []
        activities = []
        num_people = len(kps_all)
        
        for i in range(num_people):
            for j in range(i + 1, num_people):
                # Get hip centers for distance calculation
                hip_i = self._get_hip_center(kps_all[i])
                hip_j = self._get_hip_center(kps_all[j])
                
                distance = np.linalg.norm(hip_i - hip_j)
                
                # CLOSE CONTACT
                if distance < 150:
                    signals.append("CLOSE_CONTACT")
                    activities.append("PHYSICAL_PROXIMITY")
                
                # ASSAULT (wrist near head)
                for wrist_idx in [9, 10]:  # Left and right wrists
                    for head_idx in [0, 1, 2, 3, 4]:  # Head points
                        dist = np.linalg.norm(kps_all[i][wrist_idx] - kps_all[j][head_idx])
                        if dist < 60:
                            signals.append("ASSAULT_HEAD")
                            activities.append("PHYSICAL_ASSAULT")
                            break
                
                # GRABBING (wrist near shoulder/hip)
                for wrist_idx in [9, 10]:
                    for body_idx in [5, 6, 11, 12]:  # Shoulders and hips
                        dist = np.linalg.norm(kps_all[i][wrist_idx] - kps_all[j][body_idx])
                        if dist < 40:
                            signals.append("GRABBING")
                            activities.append("RESTRAINING_MOTION")
                            break
        
        return signals, activities
    
    def _calculate_verticality(self, kps):
        """Calculate how vertical the body is (0=horizontal, 1=vertical)"""
        shoulder_mid = (kps[5] + kps[6]) / 2
        hip_mid = (kps[11] + kps[12]) / 2
        
        dy = abs(hip_mid[1] - shoulder_mid[1])
        dx = abs(hip_mid[0] - shoulder_mid[0])
        
        if dy + dx == 0:
            return 0.5
        
        return dy / (dy + dx)
    
    def _get_hip_center(self, kps):
        return (kps[11] + kps[12]) / 2
    
    def _calculate_threat_score(self, signals, activities, persons):
        """Calculate threat score based on detected signals"""
        score = 0
        
        # Signal weights
        signal_weights = {
            "GRAB_NECK_LEFT": 25, "GRAB_NECK_RIGHT": 25,
            "WEAPON_THREAT_LEFT": 20, "WEAPON_THREAT_RIGHT": 20,
            "ASSAULT_HEAD": 30, "GRABBING": 20,
            "PUNCH_LEFT": 15, "PUNCH_RIGHT": 15,
            "KICK_LEFT": 15, "KICK_RIGHT": 15,
            "FALLEN": 10, "CLOSE_CONTACT": 10
        }
        
        # Activity weights
        activity_weights = {
            "CHOKING_MOTION": 30, "PHYSICAL_ASSAULT": 25,
            "THREATENING_GESTURE": 20, "RESTRAINING_MOTION": 20,
            "AGGRESSIVE_MOTION": 15, "KICKING_MOTION": 15,
            "PHYSICAL_PROXIMITY": 10
        }
        
        # Add signal scores
        for signal in set(signals):
            score += signal_weights.get(signal, 5)
        
        # Add activity scores
        for activity in set(activities):
            score += activity_weights.get(activity, 5)
        
        # Multiplier based on number of people
        if persons >= 3:
            score *= 1.4
        elif persons == 2:
            score *= 1.2
        
        return min(100, int(score))
    
    def _classify(self, signals, activities, persons):
        """Classify the type of crime/threat"""
        signal_set = set(signals)
        activity_set = set(activities)
        
        # CRITICAL threats
        if any("GRAB_NECK" in s for s in signal_set):
            return "Choking / Attempted Murder", "CRITICAL"
        
        if any("WEAPON_THREAT" in s for s in signal_set) and "CLOSE_CONTACT" in signal_set:
            return "Assault with Weapon", "CRITICAL"
        
        if "FALLEN" in signal_set and persons >= 2 and any("PUNCH" in s or "KICK" in s for s in signal_set):
            return "Assault on Fallen Victim", "CRITICAL"
        
        if "GRABBING" in signal_set and persons == 2:
            return "Kidnapping / Abduction", "CRITICAL"
        
        # HIGH threats
        if "ASSAULT_HEAD" in signal_set:
            return "Physical Assault", "HIGH"
        
        if persons >= 3 and any("PUNCH" in s or "KICK" in s for s in signal_set):
            return "Crowd Violence / Riot", "HIGH"
        
        if any("PUNCH" in s or "KICK" in s for s in signal_set) and persons == 2:
            return "Fight / Physical Violence", "HIGH"
        
        # MEDIUM threats
        if "CLOSE_CONTACT" in signal_set and persons == 2:
            return "Robbery / Mugging", "MEDIUM"
        
        if "THREATENING_GESTURE" in activity_set:
            return "Threatening Behavior", "MEDIUM"
        
        # LOW threats (suspicious but not clearly violent)
        if len(signal_set) > 0 or len(activity_set) > 0:
            return "Suspicious Activity", "LOW"
        
        return "Normal", "LOW"
    
    def _empty_result(self):
        """Return empty/default result"""
        return {
            "persons_detected": 0,
            "signals": [],
            "activities": [],
            "threat_score": 0,
            "crime_detected": False,
            "crime_type": "Normal",
            "threat_level": "LOW",
            "confidence": 0.0
        }