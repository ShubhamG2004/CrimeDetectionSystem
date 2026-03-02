from ultralytics import YOLO
import numpy as np
import math
from collections import defaultdict

class PoseCrimeDetector:
    def __init__(self):
        # Use medium model for better accuracy or keep nano for speed
        self.model = YOLO("yolov8n-pose.pt")
        # Cache for temporal analysis (simple version)
        self.frame_history = []
        self.max_history = 5
        
    def analyze(self, image):
        # Process with higher resolution for better keypoint accuracy
        results = self.model(image, conf=0.3, iou=0.45, verbose=False)[0]  # Lowered confidence threshold
        
        if results.keypoints is None or len(results.keypoints) == 0:
            return self._empty_result()
        
        kps_all = results.keypoints.xy.cpu().numpy()
        conf_all = results.keypoints.conf.cpu().numpy() if results.keypoints.conf is not None else None
        boxes = results.boxes.xyxy.cpu().numpy()
        
        persons = len(kps_all)
        threat_score = 0
        signals = []
        activities = []
        
        # ---- SINGLE PERSON ANALYSIS ----
        person_signals = []
        for idx, kps in enumerate(kps_all):
            kps_conf = conf_all[idx] if conf_all is not None else None
            person_sig, person_acts = self._analyze_person(kps, kps_conf)
            person_signals.append(person_sig)
            signals.extend(person_sig)
            activities.extend(person_acts)
        
        # ---- MULTI-PERSON ANALYSIS ----
        if persons >= 2:
            inter_signals, inter_acts = self._analyze_interactions(kps_all, boxes, person_signals)
            signals.extend(inter_signals)
            activities.extend(inter_acts)
        
        # ---- TEMPORAL ANALYSIS (Simple) ----
        self._update_history(signals)
        signals.extend(self._temporal_analysis())
        
        # ---- THREAT SCORING ----
        threat_score = self._calculate_threat_score(signals, activities, persons)
        
        # ---- FINAL CLASSIFICATION ----
        crime_type, threat_level = self._classify(signals, activities, persons)
        crime_detected = threat_score >= 40
        
        return {
            "persons_detected": persons,
            "signals": list(set(signals)),
            "activities": list(set(activities)),
            "threat_score": min(100, threat_score),
            "crime_detected": crime_detected,
            "crime_type": crime_type,
            "threat_level": threat_level,
            "confidence": min(100, threat_score)
        }
    
    # -------------------------------------------------
    # IMPROVED PERSON-LEVEL ANALYSIS
    # -------------------------------------------------
    def _analyze_person(self, k, conf=None):
        s = []
        acts = []
        
        # Validate keypoints confidence
        min_conf = 0.3  # Lowered threshold
        if conf is not None:
            valid_points = [i for i, c in enumerate(conf) if c > min_conf]
            if len(valid_points) < 8:  # Reduced requirement
                return s, acts
        
        # Keypoint indices (COCO format)
        nose = k[0]
        left_eye, right_eye = k[1], k[2]
        left_ear, right_ear = k[3], k[4]
        left_shoulder, right_shoulder = k[5], k[6]
        left_elbow, right_elbow = k[7], k[8]
        left_wrist, right_wrist = k[9], k[10]
        left_hip, right_hip = k[11], k[12]
        left_knee, right_knee = k[13], k[14]
        left_ankle, right_ankle = k[15], k[16]
        
        # Calculate body proportions for normalization
        torso_height = abs(nose[1] - (left_hip[1] + right_hip[1]) / 2)
        shoulder_width = abs(left_shoulder[0] - right_shoulder[0])
        
        if torso_height < 5 or shoulder_width < 5:  # Lowered threshold
            return s, acts
        
        # Calculate neck area for improved harassment/molestation detection
        neck_pos = (nose[0], nose[1] + torso_height * 0.2)
        chest_pos = ((left_shoulder[0] + right_shoulder[0]) / 2, (left_shoulder[1] + right_shoulder[1]) / 2)
        lower_torso_pos = ((left_hip[0] + right_hip[0]) / 2, (left_hip[1] + right_hip[1]) / 2)
        
        # ---- AGGRESSIVE GESTURES ----
        
        # Punch detection (improved with lower thresholds)
        left_arm_extended = self._is_arm_extended(
            left_shoulder, left_elbow, left_wrist, torso_height
        )
        right_arm_extended = self._is_arm_extended(
            right_shoulder, right_elbow, right_wrist, torso_height
        )
        
        # Check if wrist is above elbow (punching motion) - more sensitive
        if left_arm_extended and left_wrist[1] < left_elbow[1] - torso_height * 0.05:
            s.append("PUNCH_LEFT")
            acts.append("AGGRESSIVE_GESTURE")
        if right_arm_extended and right_wrist[1] < right_elbow[1] - torso_height * 0.05:
            s.append("PUNCH_RIGHT")
            acts.append("AGGRESSIVE_GESTURE")
        
        # Kick detection (improved with lower thresholds)
        left_leg_raised = self._is_leg_raised(
            left_hip, left_knee, left_ankle, torso_height
        )
        right_leg_raised = self._is_leg_raised(
            right_hip, right_knee, right_ankle, torso_height
        )
        
        if left_leg_raised:
            s.append("KICK_LEFT")
            acts.append("KICKING_MOTION")
        if right_leg_raised:
            s.append("KICK_RIGHT")
            acts.append("KICKING_MOTION")
        
        # Weapon threat (straight arm pointing) - more sensitive
        if left_arm_extended and abs(left_wrist[0] - left_shoulder[0]) > shoulder_width * 1.2:
            s.append("WEAPON_THREAT_LEFT")
            acts.append("THREATENING_GESTURE")
        if right_arm_extended and abs(right_wrist[0] - right_shoulder[0]) > shoulder_width * 1.2:
            s.append("WEAPON_THREAT_RIGHT")
            acts.append("THREATENING_GESTURE")
        
        # Choking/grabbing neck (improved with larger radius)
        neck_y = nose[1] + torso_height * 0.25  # Adjusted neck position
        if self._distance(left_wrist, [nose[0], neck_y]) < torso_height * 0.4:
            s.append("GRAB_NECK_LEFT")
            acts.append("CHOKING_MOTION")
        if self._distance(right_wrist, [nose[0], neck_y]) < torso_height * 0.4:
            s.append("GRAB_NECK_RIGHT")
            acts.append("CHOKING_MOTION")
        
        # ---- WOMEN-SPECIFIC CRIME DETECTION ----
        
        # Chest/breast touching (molestation/sexual harassment) - NEW
        chest_y = chest_pos[1]
        chest_x = chest_pos[0]
        left_chest_dist = self._distance(left_wrist, [chest_x, chest_y])
        right_chest_dist = self._distance(right_wrist, [chest_x, chest_y])
        
        if left_chest_dist < torso_height * 0.35 or right_chest_dist < torso_height * 0.35:
            s.append("CHEST_CONTACT")
            acts.append("MOLESTATION_SIGNAL")
        
        # Lower body contact (sexual assault/molestation indication) - NEW
        if self._distance(left_wrist, lower_torso_pos) < torso_height * 0.35 or \
           self._distance(right_wrist, lower_torso_pos) < torso_height * 0.35:
            if chest_pos[1] - lower_torso_pos[1] > 0:  # Ensure it's the lower body
                s.append("LOWER_BODY_CONTACT")
                acts.append("SEXUAL_ASSAULT_SIGNAL")
        
        # Hair grabbing (harassment/assault) - NEW
        head_y = nose[1]
        if self._distance(left_wrist, [nose[0], head_y]) < torso_height * 0.25 or \
           self._distance(right_wrist, [nose[0], head_y]) < torso_height * 0.25:
            s.append("HAIR_GRAB")
            acts.append("HARASSMENT_SIGNAL")
        
        # Defensive shielding gesture (victim protection) - NEW
        if (left_wrist[1] < left_shoulder[1] - torso_height * 0.1 and 
            left_elbow[1] < left_shoulder[1]) or \
           (right_wrist[1] < right_shoulder[1] - torso_height * 0.1 and 
            right_elbow[1] < right_shoulder[1]):
            acts.append("DEFENSIVE_SHIELD")
        
        # Restraining arm lock (against torso) - NEW
        if (abs(left_wrist[0] - right_shoulder[0]) < shoulder_width * 0.4 and
            abs(left_wrist[1] - right_shoulder[1]) < torso_height * 0.3) or \
           (abs(right_wrist[0] - left_shoulder[0]) < shoulder_width * 0.4 and
            abs(right_wrist[1] - left_shoulder[1]) < torso_height * 0.3):
            s.append("ARM_LOCK")
            acts.append("RESTRAINT_ATTEMPT")
        
        # ---- STANDARD DETECTION ----
        
        # Fallen person (improved)
        body_verticality = self._calculate_body_verticality(k)
        if body_verticality < 0.4:  # Slightly higher threshold
            s.append("FALLEN")
            acts.append("PRONE_POSITION")
        
        # Running detection
        if self._is_running(k):
            acts.append("RUNNING")
        
        # Crouching detection
        if self._is_crouching(k):
            acts.append("CROUCHING")
        
        # Hands up (surrender or threat)
        if left_wrist[1] < left_shoulder[1] - torso_height * 0.15 and \
           right_wrist[1] < right_shoulder[1] - torso_height * 0.15:
            acts.append("HANDS_UP")
        
        # Victim vulnerability detection
        if self._is_crouching(k) or body_verticality < 0.5:
            s.append("VULNERABLE_POSITION")
            acts.append("DEFENSIVE_POSTURE")
        
        return s, acts
    
    # -------------------------------------------------
    # IMPROVED INTERACTION ANALYSIS
    # -------------------------------------------------
    def _analyze_interactions(self, kps_all, boxes, person_signals):
        s = []
        acts = []
        n = len(kps_all)
        
        for i in range(n):
            for j in range(i + 1, n):
                # Use hip center for distance calculation
                hip_i = self._get_hip_center(kps_all[i])
                hip_j = self._get_hip_center(kps_all[j])
                
                distance = self._distance(hip_i, hip_j)
                frame_diagonal = self._calculate_frame_diagonal(boxes[i], boxes[j])
                
                normalized_distance = distance / frame_diagonal if frame_diagonal > 0 else 1.0
                
                # ---- WOMEN-SPECIFIC CRIME INTERACTIONS ----
                
                # Rear approach (stalking/sexual assault indicator) - NEW
                if self._is_rear_approach(kps_all[i], kps_all[j]):
                    s.append("REAR_APPROACH")
                    acts.append("STALKING_SIGNAL")
                
                # Unwanted proximity from behind - NEW
                if self._is_close_rear_contact(kps_all[i], kps_all[j], normalized_distance):
                    s.append("REAR_CONTACT")
                    acts.append("HARASSMENT_SIGNAL")
                
                # Downward arm positioning over another person (restraint/control) - NEW
                if self._is_restraining_hold(kps_all[i], kps_all[j]):
                    s.append("RESTRAINING_HOLD")
                    acts.append("CONFINEMENT_SIGNAL")
                
                # Circle surrounding pattern (mob mentality/collective crime) - NEW
                if n >= 3 and self._is_surrounding_pattern(kps_all, i, j):
                    s.append("SURROUNDING_PATTERN")
                    acts.append("GROUP_HARASSMENT")
                
                # Hands on shoulders from behind (control/force) - NEW
                if self._is_shoulder_control(kps_all[i], kps_all[j]):
                    s.append("SHOULDER_CONTROL")
                    acts.append("PHYSICAL_CONTROL")
                
                # ---- STANDARD INTERACTIONS ----
                
                # Close contact (based on body proportions) - increased thresholds
                if normalized_distance < 0.4:  # More sensitive
                    s.append("CLOSE_CONTACT")
                    acts.append("PHYSICAL_PROXIMITY")
                
                # Body collision detection (very close contact)
                if normalized_distance < 0.2:  # More sensitive
                    s.append("BODY_COLLISION")
                    acts.append("PHYSICAL_CONTACT")
                
                # Assault detection - IMPROVED
                for wrist_idx in [9, 10]:  # Left and right wrists
                    for head_idx in [0, 1, 2, 3, 4]:  # Head keypoints
                        if np.any(np.isnan(kps_all[i][wrist_idx])) or np.any(np.isnan(kps_all[j][head_idx])):
                            continue
                        dist = self._distance(kps_all[i][wrist_idx], kps_all[j][head_idx])
                        if dist < 50:  # Increased threshold for better detection
                            s.append("ASSAULT_HEAD")
                            acts.append("PHYSICAL_ASSAULT")
                            
                # Also check wrists to torso/body contact
                for wrist_idx in [9, 10]:
                    for body_idx in [5, 6, 11, 12]:  # Shoulders and hips
                        if np.any(np.isnan(kps_all[i][wrist_idx])) or np.any(np.isnan(kps_all[j][body_idx])):
                            continue
                        dist = self._distance(kps_all[i][wrist_idx], kps_all[j][body_idx])
                        if dist < 40:
                            s.append("BODY_CONTACT")
                            acts.append("PHYSICAL_ASSAULT")
                
                # Grabbing detection - IMPROVED
                if self._is_grabbing(kps_all[i], kps_all[j]):
                    s.append("GRABBING")
                    acts.append("RESTRAINING_MOTION")
                
                # Following/chasing detection
                if self._is_following(kps_all[i], kps_all[j], boxes[i], boxes[j]):
                    acts.append("FOLLOWING_CHASING")
                
                # Crowd formation detection
                if n >= 3:
                    if self._is_circle_formation([kps_all[i], kps_all[j]], kps_all):
                        acts.append("CROWD_FORMATION")
                
                # Overpower detection (aggressor standing over crouched victim)
                if hip_i is not None and hip_j is not None:
                    vertical_diff = abs(hip_i[1] - hip_j[1])
                    
                    if vertical_diff > 20:  # Lowered threshold
                        s.append("POWER_IMBALANCE")
                        acts.append("DOMINANT_POSITION")
                
                # Strong assault detection rule - IMPROVED
                if "CLOSE_CONTACT" in s and (
                    "AGGRESSIVE_GESTURE" in acts or
                    "KICKING_MOTION" in acts or
                    "BODY_COLLISION" in s or
                    "ASSAULT_HEAD" in s
                ):
                    s.append("DIRECT_ASSAULT")
                    acts.append("PHYSICAL_ASSAULT")
        
        return s, acts
    
    # -------------------------------------------------
    # HELPER METHODS
    # -------------------------------------------------
    def _is_arm_extended(self, shoulder, elbow, wrist, torso_height):
        """Check if arm is relatively straight and extended"""
        # Calculate angles
        angle1 = self._angle_between(shoulder, elbow, wrist)
        # Check if arm is relatively straight (angle close to 180 degrees) - wider range
        arm_straight = abs(angle1 - 180) < 45  # More tolerant
        
        # Check extension length
        arm_length = self._distance(shoulder, wrist)
        extended = arm_length > torso_height * 0.5  # Lower threshold
        
        return arm_straight and extended
    
    def _is_leg_raised(self, hip, knee, ankle, torso_height):
        """Check if leg is raised for kicking - more sensitive"""
        # Check if knee is significantly higher than hip (front kick)
        front_kick = knee[1] < hip[1] - torso_height * 0.05  # Lower threshold
        
        # Check if ankle is significantly higher than knee (high kick)
        high_kick = ankle[1] < knee[1] - torso_height * 0.05  # Lower threshold
        
        # Check leg angle for side kick - wider range
        leg_angle = self._angle_between(hip, knee, ankle)
        side_kick = 100 < leg_angle < 180  # Wider range
        
        return front_kick or high_kick or side_kick
    
    def _calculate_body_verticality(self, k):
        """Calculate how vertical/horizontal the body is (0-1, 1=vertical)"""
        shoulder_mid = [(k[5][0] + k[6][0])/2, (k[5][1] + k[6][1])/2]
        hip_mid = [(k[11][0] + k[12][0])/2, (k[11][1] + k[12][1])/2]
        
        # Vector from shoulders to hips
        vec = [hip_mid[0] - shoulder_mid[0], hip_mid[1] - shoulder_mid[1]]
        
        # Vertical vector
        vert = [0, 1]
        
        # Calculate cosine similarity
        dot = vec[0]*vert[0] + vec[1]*vert[1]
        mag_vec = math.sqrt(vec[0]**2 + vec[1]**2)
        mag_vert = 1.0
        
        if mag_vec < 1e-6:
            return 0.5
        
        cosine = dot / (mag_vec * mag_vert)
        return (cosine + 1) / 2  # Normalize to 0-1
    
    def _is_running(self, k):
        """Detect running motion"""
        # Check if legs are in running position
        left_leg_angle = self._angle_between(k[11], k[13], k[15])
        right_leg_angle = self._angle_between(k[12], k[14], k[16])
        
        # Running typically has legs bent at acute angles - more tolerant
        return (left_leg_angle < 140 or right_leg_angle < 140) and \
               abs(k[13][1] - k[14][1]) > 15  # Lower threshold
    
    def _is_crouching(self, k):
        """Detect crouching/sneaking position"""
        # Check if knees are significantly lower than hips
        knee_height_ratio = (k[13][1] + k[14][1]) / (2 * (k[11][1] + k[12][1]) / 2 + 1e-6)
        return knee_height_ratio > 1.1  # Lower threshold
    
    def _get_hip_center(self, k):
        if np.any(np.isnan(k[11])) or np.any(np.isnan(k[12])):
            return None
        return [(k[11][0] + k[12][0])/2, (k[11][1] + k[12][1])/2]
    
    def _calculate_frame_diagonal(self, box1, box2):
        """Calculate approximate frame diagonal for normalization"""
        boxes_combined = np.vstack([box1, box2])
        min_x, min_y = boxes_combined[:, :2].min(axis=0)
        max_x, max_y = boxes_combined[:, 2:].max(axis=0)
        return math.sqrt((max_x - min_x)**2 + (max_y - min_y)**2)
    
    def _is_grabbing(self, kps1, kps2):
        """Check if one person is grabbing another - more sensitive"""
        for wrist_idx in [9, 10]:  # Check both wrists
            for body_idx in [5, 6, 11, 12, 13, 14]:  # Expanded to include knees
                if (np.any(np.isnan(kps1[wrist_idx])) or 
                    np.any(np.isnan(kps2[body_idx]))):
                    continue
                if self._distance(kps1[wrist_idx], kps2[body_idx]) < 35:  # Larger radius
                    return True
        return False
    
    def _is_following(self, kps1, kps2, box1, box2):
        """Check if one person might be following another"""
        # Simple directional check
        direction1 = self._get_facing_direction(kps1)
        direction2 = self._get_facing_direction(kps2)
        
        # Check if person1 is facing person2 and moving toward them
        pos1 = self._get_hip_center(kps1)
        pos2 = self._get_hip_center(kps2)
        
        if pos1 is None or pos2 is None:
            return False
        
        vec_to_target = [pos2[0] - pos1[0], pos2[1] - pos1[1]]
        vec_to_target_mag = math.sqrt(vec_to_target[0]**2 + vec_to_target[1]**2)
        
        if vec_to_target_mag < 1e-6:
            return False
        
        # Normalize
        vec_to_target = [vec_to_target[0]/vec_to_target_mag, vec_to_target[1]/vec_to_target_mag]
        
        # Dot product indicates alignment - lower threshold
        dot = direction1[0]*vec_to_target[0] + direction1[1]*vec_to_target[1]
        return dot > 0.5  # Lower threshold
    
    def _get_facing_direction(self, kps):
        """Estimate which direction person is facing"""
        # Simple method using shoulders and nose
        shoulder_mid = [(kps[5][0] + kps[6][0])/2, (kps[5][1] + kps[6][1])/2]
        nose = kps[0]
        
        vec = [nose[0] - shoulder_mid[0], nose[1] - shoulder_mid[1]]
        mag = math.sqrt(vec[0]**2 + vec[1]**2)
        
        if mag < 1e-6:
            return [0, 1]  # Default downward
        
        return [vec[0]/mag, vec[1]/mag]
    
    def _is_circle_formation(self, reference_kps, all_kps):
        """Check if people form a circle/group around something"""
        if len(all_kps) < 3:
            return False
        
        centers = []
        for k in all_kps:
            center = self._get_hip_center(k)
            if center is not None:
                centers.append(center)
        
        if len(centers) < 3:
            return False
        
        avg_center = np.mean(centers, axis=0)
        
        distances = [self._distance(c, avg_center) for c in centers]
        avg_distance = np.mean(distances)
        
        # Check if distances are relatively uniform (circle-like) - more tolerant
        std_distance = np.std(distances)
        return std_distance / (avg_distance + 1e-6) < 0.4  # More tolerant
    
    def _update_history(self, signals):
        """Maintain a simple history of signals"""
        self.frame_history.append(set(signals))
        if len(self.frame_history) > self.max_history:
            self.frame_history.pop(0)
    
    def _temporal_analysis(self):
        """Simple temporal analysis for sustained signals"""
        if len(self.frame_history) < 3:
            return []
        
        sustained_signals = set.intersection(*self.frame_history)
        return list(sustained_signals)
    
    def _calculate_threat_score(self, signals, activities, persons):
        """Improved threat scoring"""
        score = 0
        
        # Signal weights - increased weights for assault-related signals
        signal_weights = {
            "GRAB_NECK_LEFT": 30, "GRAB_NECK_RIGHT": 30,
            "WEAPON_THREAT_LEFT": 25, "WEAPON_THREAT_RIGHT": 25,
            "ASSAULT_HEAD": 35, "GRABBING": 25,
            "BODY_CONTACT": 20,  # New
            "PUNCH_LEFT": 20, "PUNCH_RIGHT": 20,  # Increased
            "KICK_LEFT": 20, "KICK_RIGHT": 20,  # Increased
            "FALLEN": 15, "CLOSE_CONTACT": 15,  # Increased
            "DIRECT_ASSAULT": 40,  # Increased
            "POWER_IMBALANCE": 25,  # Increased
            "VULNERABLE_POSITION": 30,  # Increased
            "BODY_COLLISION": 30,  # Increased
            # Women-specific crimes
            "CHEST_CONTACT": 35,
            "LOWER_BODY_CONTACT": 40,
            "HAIR_GRAB": 28,
            "ARM_LOCK": 32,
            "REAR_APPROACH": 20,
            "REAR_CONTACT": 32,
            "RESTRAINING_HOLD": 38,
            "SHOULDER_CONTROL": 30,
            "SURROUNDING_PATTERN": 35
        }
        
        # Activity weights - increased weights
        activity_weights = {
            "PHYSICAL_ASSAULT": 25, "CHOKING_MOTION": 30,
            "THREATENING_GESTURE": 20, "RESTRAINING_MOTION": 25,
            "AGGRESSIVE_GESTURE": 15, "KICKING_MOTION": 15,
            "FOLLOWING_CHASING": 20, "CROWD_FORMATION": 15,
            "DEFENSIVE_POSTURE": 25,  # Increased
            "DOMINANT_POSITION": 25,  # Increased
            # Women-specific activities
            "MOLESTATION_SIGNAL": 38,
            "SEXUAL_ASSAULT_SIGNAL": 45,
            "HARASSMENT_SIGNAL": 28,
            "DEFENSIVE_SHIELD": 22,
            "RESTRAINT_ATTEMPT": 35,
            "STALKING_SIGNAL": 30,
            "GROUP_HARASSMENT": 32,
            "PHYSICAL_CONTROL": 30,
            "CONFINEMENT_SIGNAL": 40
        }
        
        # Add signal scores
        for signal in set(signals):
            score += signal_weights.get(signal, 5)
        
        # Add activity scores
        for activity in set(activities):
            score += activity_weights.get(activity, 5)
        
        # Multiplier for multiple persons - increased
        if persons >= 3:
            score *= 1.5
        elif persons == 2:
            score *= 1.3
        
        # Sustained signals multiplier
        if len(self.frame_history) >= 3 and len(set.intersection(*self.frame_history)) > 0:
            score *= 1.3
        
        return min(100, score)
    
    # -------------------------------------------------
    # IMPROVED CLASSIFICATION - 20+ Crime Types
    # -------------------------------------------------
    def _classify(self, signals, activities, persons):
        s = set(signals)
        a = set(activities)

        # Helper flags
        has_punch = any(sig.startswith("PUNCH") for sig in s)
        has_kick = any(sig.startswith("KICK") for sig in s)
        has_assault_signal = any(sig in ["ASSAULT_HEAD", "BODY_CONTACT", "DIRECT_ASSAULT"] for sig in s)
        has_physical_contact = any(sig in ["CLOSE_CONTACT", "BODY_COLLISION", "GRABBING"] for sig in s)
        
        # Women-specific crime indicators
        has_chest_contact = "CHEST_CONTACT" in s
        has_lower_body_contact = "LOWER_BODY_CONTACT" in s
        has_hair_grab = "HAIR_GRAB" in s
        has_rear_contact = "REAR_CONTACT" in s
        has_restraining_hold = "RESTRAINING_HOLD" in s
        has_shoulder_control = "SHOULDER_CONTROL" in s
        has_sexual_assault_signal = "SEXUAL_ASSAULT_SIGNAL" in a

        # ---- CRITICAL WOMEN-RELATED CRIMES ----
        
        # Sexual Assault / Molestation - HIGH PRIORITY
        if (has_lower_body_contact or has_chest_contact or has_hair_grab) and \
           (has_physical_contact or "CLOSE_CONTACT" in s):
            if has_lower_body_contact:
                return "Sexual Assault / Molestation", "CRITICAL"
            else:
                return "Eve Teasing / Harassment", "HIGH"
        
        # Attempted Rape / Sexual Assault - CRITICAL
        if has_lower_body_contact and has_restraining_hold and persons == 2:
            return "Attempted Rape / Sexual Assault", "CRITICAL"
        
        # Rape / Sexual Violence - CRITICAL
        if has_sexual_assault_signal and "RESTRAINT_ATTEMPT" in a and \
           (has_restraining_hold or "ARM_LOCK" in s):
            return "Rape / Sexual Violence", "CRITICAL"
        
        # Stalking
        if "STALKING_SIGNAL" in a and (has_rear_contact or "FOLLOWING_CHASING" in a):
            return "Stalking / Harassment", "HIGH"
        
        # Domestic Violence
        if persons == 2 and (has_assault_signal or has_punch or has_kick) and \
           (has_restraining_hold or "DOMINANT_POSITION" in a):
            return "Domestic Violence", "CRITICAL"
        
        # Eve Teasing / Street Harassment
        if has_rear_contact and "HARASSMENT_SIGNAL" in a and not has_restraining_hold:
            return "Eve Teasing / Street Harassment", "HIGH"
        
        # Forced Confinement / Kidnapping
        if "CONFINEMENT_SIGNAL" in a and has_restraining_hold and \
           ("SURROUNDING_PATTERN" in s or persons >= 2):
            return "Forced Confinement / Kidnapping", "CRITICAL"
        
        # Human Trafficking (group with restraint)
        if "GROUP_HARASSMENT" in a and has_restraining_hold and persons >= 3:
            return "Human Trafficking / Abduction", "CRITICAL"
        
        # Dowry-related Violence
        if "DOMINANT_POSITION" in a and has_assault_signal and \
           has_physical_contact and persons == 2:
            return "Dowry Violence / Domestic Abuse", "HIGH"
        
        # Honor Crime (public violence against woman)
        if "GROUP_HARASSMENT" in a and has_assault_signal and persons >= 3:
            return "Honor Crime / Mob Violence", "CRITICAL"
        
        # Indecent Assault / Groping
        if (has_chest_contact or has_hair_grab) and not has_lower_body_contact:
            if "CLOSE_CONTACT" in s and not has_restraining_hold:
                return "Indecent Assault / Groping", "HIGH"
        
        # Human Trafficking (movement with restraint)
        if "FOLLOWING_CHASING" in a and has_restraining_hold:
            return "Human Trafficking", "CRITICAL"
        
        # Kidnapping
        if "GRABBING" in s and "RESTRAINING_MOTION" in a and \
           ("FOLLOWING_CHASING" in a or has_restraining_hold):
            return "Kidnapping / Abduction", "CRITICAL"
        
        # ---- GENERAL CRIMES ----
        
        # CRITICAL: Woman Assault / Physical Violence detection for the image
        if persons >= 2 and (has_assault_signal or has_punch or has_kick) and has_physical_contact:
            if "VULNERABLE_POSITION" in s or "POWER_IMBALANCE" in s:
                return "Woman Assault / Physical Violence", "CRITICAL"
            return "Physical Assault", "HIGH"

        # Critical threat scenarios
        if (
            "DIRECT_ASSAULT" in s and
            "VULNERABLE_POSITION" in s
        ):
            return "Woman Assault / Physical Violence", "CRITICAL"

        if (
            "DIRECT_ASSAULT" in s
        ):
            return "Physical Assault", "HIGH"
        
        # High threat scenarios
        if "GRAB_NECK_LEFT" in s or "GRAB_NECK_RIGHT" in s:
            return "Choking / Attempted Murder", "CRITICAL"

        if ("WEAPON_THREAT_LEFT" in s or "WEAPON_THREAT_RIGHT" in s) and \
           ("CLOSE_CONTACT" in s or "PHYSICAL_ASSAULT" in a):
            return "Assault with Weapon", "CRITICAL"

        if "GRABBING" in s and "FOLLOWING_CHASING" in a:
            return "Kidnapping / Abduction", "CRITICAL"

        if "FALLEN" in s and persons >= 2 and (has_punch or has_kick):
            return "Assault on Fallen Victim", "CRITICAL"

        if persons >= 3 and ("PHYSICAL_ASSAULT" in a or "CROWD_FORMATION" in a):
            return "Crowd Violence / Riot", "HIGH"

        # Fight detection
        if persons == 2 and (has_punch or has_kick or has_assault_signal):
            return "Fight / Physical Violence", "HIGH"

        # Medium threat scenarios
        if "ASSAULT_HEAD" in s:
            return "Physical Assault", "HIGH"

        if "CLOSE_CONTACT" in s and persons == 2 and "RUNNING" in a:
            return "Robbery / Mugging", "HIGH"

        if "THREATENING_GESTURE" in a and "CLOSE_CONTACT" in s:
            return "Threatening Behavior", "MEDIUM"

        # Low threat scenarios
        if len(s) > 0 or len(a) > 0:
            return "Suspicious Activity", "LOW"

        return "Normal", "LOW"

    
    # ---- WOMEN-SPECIFIC CRIME HELPER METHODS ----
    
    def _is_rear_approach(self, kps1, kps2):
        """Detect if one person is approaching another from behind"""
        pos1 = self._get_hip_center(kps1)
        pos2 = self._get_hip_center(kps2)
        
        if pos1 is None or pos2 is None:
            return False
        
        # Get facing direction of person 2
        facing_dir = self._get_facing_direction(kps2)
        
        # Vector from person2 to person1
        vec_to_person1 = [pos1[0] - pos2[0], pos1[1] - pos2[1]]
        mag = math.sqrt(vec_to_person1[0]**2 + vec_to_person1[1]**2)
        
        if mag < 1e-6:
            return False
        
        vec_to_person1 = [vec_to_person1[0]/mag, vec_to_person1[1]/mag]
        
        # If person1 is behind person2 (opposite to facing direction)
        dot = facing_dir[0]*vec_to_person1[0] + facing_dir[1]*vec_to_person1[1]
        return dot < -0.3  # Behind threshold
    
    def _is_close_rear_contact(self, kps1, kps2, normalized_distance):
        """Detect close contact from behind (harassment pattern)"""
        if not self._is_rear_approach(kps1, kps2):
            return False
        return normalized_distance < 0.25
    
    def _is_restraining_hold(self, kps1, kps2):
        """Detect arm positioning suggesting restraint"""
        # Check if person1's wrists are positioned downward on person2's body
        hip_center = self._get_hip_center(kps2)
        
        if hip_center is None:
            return False
        
        # If both wrists are below shoulder level and close to target
        wrist1_low = kps1[9][1] > kps1[5][1] and kps1[10][1] > kps1[6][1]
        wrist1_close_x = abs(kps1[9][0] - hip_center[0]) < 50 and abs(kps1[10][0] - hip_center[0]) < 50
        
        return wrist1_low and wrist1_close_x
    
    def _is_shoulder_control(self, kps1, kps2):
        """Detect hands on shoulders from behind (control gesture)"""
        shoulder_l2 = kps2[5]
        shoulder_r2 = kps2[6]
        
        # Check if wrists are near shoulders
        left_wrist_near = self._distance(kps1[9], shoulder_l2) < 40
        right_wrist_near = self._distance(kps1[10], shoulder_r2) < 40
        
        return left_wrist_near or right_wrist_near
    
    def _is_surrounding_pattern(self, kps_all, idx_i, idx_j):
        """Detect if people are forming a surrounding/mob pattern"""
        if len(kps_all) < 3:
            return False
        
        target_idx = idx_j
        other_centers = []
        
        for k, kps in enumerate(kps_all):
            if k != target_idx:
                center = self._get_hip_center(kps)
                if center is not None:
                    other_centers.append(center)
        
        if len(other_centers) < 2:
            return False
        
        target_center = self._get_hip_center(kps_all[target_idx])
        
        # Check if others are surrounding (distributed around target)
        angles = []
        for center in other_centers:
            vec = [center[0] - target_center[0], center[1] - target_center[1]]
            angle = math.atan2(vec[1], vec[0])
            angles.append(angle)
        
        # Check if angles are spread out (not all in one direction)
        angles_sorted = sorted(angles)
        if len(angles_sorted) >= 2:
            total_spread = max(angles_sorted) - min(angles_sorted)
            return total_spread > math.pi / 2  # Spread > 90 degrees
        
        return False
    
    # -------------------------------------------------
    # UTILITY METHODS
    # -------------------------------------------------
    def _distance(self, a, b):
        if a is None or b is None or np.any(np.isnan(a)) or np.any(np.isnan(b)):
            return float('inf')
        return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)
    
    def _angle_between(self, p1, p2, p3):
        """Calculate angle at p2 formed by p1-p2-p3"""
        if any(p is None or np.any(np.isnan(p)) for p in [p1, p2, p3]):
            return 180
        
        a = np.array(p1)
        b = np.array(p2)
        c = np.array(p3)
        
        ba = a - b
        bc = c - b
        
        norm_ba = np.linalg.norm(ba)
        norm_bc = np.linalg.norm(bc)
        
        if norm_ba < 1e-6 or norm_bc < 1e-6:
            return 180
        
        cosine_angle = np.dot(ba, bc) / (norm_ba * norm_bc)
        angle = np.degrees(np.arccos(np.clip(cosine_angle, -1.0, 1.0)))
        
        return angle
    
    def _empty_result(self):
        return {
            "persons_detected": 0,
            "signals": [],
            "activities": [],
            "threat_score": 0,
            "crime_detected": False,
            "crime_type": "Normal",
            "threat_level": "LOW",
            "confidence": 0
        }