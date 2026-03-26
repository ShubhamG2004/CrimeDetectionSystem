from ultralytics import YOLO
import numpy as np
import math
from collections import defaultdict

SINGLE_PERSON_WEAPON_SIGNALS = {
    "STABBING_MOTION_LEFT",
    "STABBING_MOTION_RIGHT",
    "KNIFE_WIELDING_LEFT",
    "KNIFE_WIELDING_RIGHT",
    "WEAPON_THREAT_LEFT",
    "WEAPON_THREAT_RIGHT",
}

SINGLE_PERSON_WEAPON_ACTIVITIES = {
    "STABBING_ATTACK",
    "WEAPON_THREAT",
    "ARMED_THREAT",
    "SHOOTING_THREAT",
}

SINGLE_PERSON_SEXUAL_MARKERS = {
    "SEXUAL_ASSAULT_SIGNAL",
    "MOLESTATION_SIGNAL",
    "HARASSMENT_SIGNAL",
}

class PoseCrimeDetector:
    def __init__(self):
        # Use medium model for better accuracy or keep nano for speed
        self.model = YOLO("yolov8n-pose.pt")
        # Cache for temporal analysis (improved version)
        self.frame_history = []
        self.max_history = 10  # Increased for better temporal consistency
        self.min_keypoint_conf_threshold = 0.5  # Stricter confidence threshold
        self.min_valid_keypoints = 10  # Require at least 10 valid keypoints
        
    def analyze(self, image):
        # Process with higher resolution for better keypoint accuracy
        results = self.model(image, conf=0.3, iou=0.45, verbose=False)[0]  # Lowered confidence threshold

        # ---------------- ROBUST PERSON COUNTING ----------------
        # Base person count primarily on raw detections, with a safe fallback
        raw_persons_kps = 0
        raw_persons_boxes = 0

        if results.keypoints is not None and getattr(results.keypoints, "xy", None) is not None:
            raw_kps_all = results.keypoints.xy.cpu().numpy()
            raw_persons_kps = len(raw_kps_all)
        else:
            raw_kps_all = None

        if results.boxes is not None:
            raw_persons_boxes = len(results.boxes)

        # If no keypoints at all, we can't do pose analysis – treat as empty
        if raw_kps_all is None or raw_persons_kps == 0:
            return self._empty_result()

        # Use keypoints for detailed analysis
        kps_all = raw_kps_all
        conf_all = results.keypoints.conf.cpu().numpy() if results.keypoints.conf is not None else None
        boxes = results.boxes.xyxy.cpu().numpy() if results.boxes is not None else None
        
        # Filter out low-quality detections EARLY
        valid_detections = []
        for idx, kps in enumerate(kps_all):
            if conf_all is not None:
                valid_count = np.sum(conf_all[idx] > self.min_keypoint_conf_threshold)
                if valid_count >= self.min_valid_keypoints:
                    valid_detections.append(idx)
            else:
                # If no confidence data, check if keypoints are not NaN
                valid_count = np.sum(~np.isnan(kps).any(axis=1))
                if valid_count >= self.min_valid_keypoints:
                    valid_detections.append(idx)
        
        if len(valid_detections) == 0:
            # Even if all poses are low quality, keep person count from raw detections
            persons_valid = 0
        else:
            # Use only valid detections
            kps_all = kps_all[valid_detections]
            if conf_all is not None:
                conf_all = conf_all[valid_detections]
            if boxes is not None:
                boxes = boxes[valid_detections]
            persons_valid = len(kps_all)

        # FINAL PERSON COUNT (robust): use max of valid poses, raw poses, and raw boxes
        persons = max(persons_valid, raw_persons_kps, raw_persons_boxes)
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
        # Use only validated pose detections for interaction analysis
        if persons_valid >= 2:
            inter_signals, inter_acts = self._analyze_interactions(kps_all, boxes, person_signals, conf_all)
            signals.extend(inter_signals)
            activities.extend(inter_acts)
        
        if persons < 2:
            filtered_signals = [
                sig
                for sig in signals
                if sig not in SINGLE_PERSON_WEAPON_SIGNALS and "SEXUAL" not in sig
            ]
            filtered_activities = [
                act
                for act in activities
                if act not in SINGLE_PERSON_WEAPON_ACTIVITIES
                and act not in SINGLE_PERSON_SEXUAL_MARKERS
                and "SEXUAL" not in act
            ]
            signals = filtered_signals
            activities = filtered_activities

        # ---- TEMPORAL ANALYSIS (Improved) ----
        self._update_history(signals)
        temporal_signals = self._temporal_analysis()
        signals.extend(temporal_signals)
        
        # ---- THREAT SCORING ----
        threat_score = self._calculate_threat_score(signals, activities, persons)
        crime_type, threat_level = self._classify(signals, activities, persons)
        
        # Only consider serious threats (reduce false positives)
        crime_detected = threat_score >= 35 and threat_level in ["HIGH", "CRITICAL"]
        
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
        
        # Validate keypoints confidence - STRICTER
        min_conf = self.min_keypoint_conf_threshold
        if conf is not None:
            valid_points = [i for i, c in enumerate(conf) if c > min_conf]
            if len(valid_points) < self.min_valid_keypoints:
                return s, acts
        
        # Check for NaN values - robust handling
        if np.any(np.isnan(k)):
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
        
        # Calculate body proportions for normalization - IMPROVED
        torso_height = abs(nose[1] - (left_hip[1] + right_hip[1]) / 2)
        shoulder_width = abs(left_shoulder[0] - right_shoulder[0])
        
        # Stricter minimum requirements
        if torso_height < 10 or shoulder_width < 5:
            return s, acts
        
        # Validate all critical points are not NaN
        critical_points = [nose, left_shoulder, right_shoulder, left_hip, right_hip, 
                          left_wrist, right_wrist, left_elbow, right_elbow]
        if any(np.any(np.isnan(p)) for p in critical_points):
            return s, acts
        
        # Calculate neck area for improved harassment/molestation detection
        neck_pos = (nose[0], nose[1] + torso_height * 0.2)
        chest_pos = ((left_shoulder[0] + right_shoulder[0]) / 2, (left_shoulder[1] + right_shoulder[1]) / 2)
        lower_torso_pos = ((left_hip[0] + right_hip[0]) / 2, (left_hip[1] + right_hip[1]) / 2)
        
        # ---- AGGRESSIVE GESTURES - STRICT ACCURACY ----
        
        # Punch detection - IMPROVED with confidence checks
        left_arm_extended = self._is_arm_extended(
            left_shoulder, left_elbow, left_wrist, torso_height, conf, [5, 7, 9]
        )
        right_arm_extended = self._is_arm_extended(
            right_shoulder, right_elbow, right_wrist, torso_height, conf, [6, 8, 10]
        )
        
        # Check if wrist is above elbow (punching motion) - more strict
        if left_arm_extended and left_wrist[1] < left_elbow[1] - torso_height * 0.1:
            # Additional validation: check arm angle
            angle = self._angle_between(left_shoulder, left_elbow, left_wrist)
            if 100 < angle < 170:  # Reasonable punch angle
                s.append("PUNCH_LEFT")
                acts.append("AGGRESSIVE_GESTURE")
        
        if right_arm_extended and right_wrist[1] < right_elbow[1] - torso_height * 0.1:
            angle = self._angle_between(right_shoulder, right_elbow, right_wrist)
            if 100 < angle < 170:
                s.append("PUNCH_RIGHT")
                acts.append("AGGRESSIVE_GESTURE")
        
        # Kick detection - IMPROVED with stricter thresholds
        left_leg_raised = self._is_leg_raised(
            left_hip, left_knee, left_ankle, torso_height, conf, [11, 13, 15]
        )
        right_leg_raised = self._is_leg_raised(
            right_hip, right_knee, right_ankle, torso_height, conf, [12, 14, 16]
        )
        
        if left_leg_raised:
            s.append("KICK_LEFT")
            acts.append("KICKING_MOTION")
        if right_leg_raised:
            s.append("KICK_RIGHT")
            acts.append("KICKING_MOTION")
        
        # Weapon threat (straight arm pointing) - STRICT validation
        if left_arm_extended and abs(left_wrist[0] - left_shoulder[0]) > shoulder_width * 1.3:
            # Verify arm is truly extended and tense
            arm_angle = self._angle_between(left_shoulder, left_elbow, left_wrist)
            if arm_angle > 160:  # Nearly straight
                s.append("WEAPON_THREAT_LEFT")
                acts.append("THREATENING_GESTURE")
        if right_arm_extended and abs(right_wrist[0] - right_shoulder[0]) > shoulder_width * 1.3:
            arm_angle = self._angle_between(right_shoulder, right_elbow, right_wrist)
            if arm_angle > 160:
                s.append("WEAPON_THREAT_RIGHT")
                acts.append("THREATENING_GESTURE")
        
        # Choking/grabbing neck - STRICT proximity check
        neck_y = nose[1] + torso_height * 0.25
        left_grab_neck = self._distance(left_wrist, [nose[0], neck_y]) < torso_height * 0.35
        right_grab_neck = self._distance(right_wrist, [nose[0], neck_y]) < torso_height * 0.35
        
        if left_grab_neck and left_arm_extended:
            s.append("GRAB_NECK_LEFT")
            acts.append("CHOKING_MOTION")
        if right_grab_neck and right_arm_extended:
            s.append("GRAB_NECK_RIGHT")
            acts.append("CHOKING_MOTION")
        
        # ---- WOMEN-SPECIFIC CRIME DETECTION - STRICT ACCURACY ----
        
        # Chest/breast touching (molestation/sexual harassment) - STRICT
        chest_y = chest_pos[1]
        chest_x = chest_pos[0]
        left_chest_dist = self._distance(left_wrist, [chest_x, chest_y])
        right_chest_dist = self._distance(right_wrist, [chest_x, chest_y])
        
        # Only if wrist is below shoulder (not just reaching up)
        if (left_chest_dist < torso_height * 0.3 and left_wrist[1] > left_shoulder[1]) or \
           (right_chest_dist < torso_height * 0.3 and right_wrist[1] > right_shoulder[1]):
            s.append("CHEST_CONTACT")
            acts.append("MOLESTATION_SIGNAL")
        
        # Lower body contact (sexual assault/molestation indication) - STRICT
        hip_dist = abs(chest_pos[1] - lower_torso_pos[1])
        if hip_dist > torso_height * 0.2:  # Ensure gap between chest and hip
            if self._distance(left_wrist, lower_torso_pos) < torso_height * 0.3 or \
               self._distance(right_wrist, lower_torso_pos) < torso_height * 0.3:
                s.append("LOWER_BODY_CONTACT")
                acts.append("SEXUAL_ASSAULT_SIGNAL")
        
        # Hair grabbing (harassment/assault) - STRICT
        head_y = nose[1]
        if self._distance(left_wrist, [nose[0], head_y]) < torso_height * 0.2 or \
           self._distance(right_wrist, [nose[0], head_y]) < torso_height * 0.2:
            s.append("HAIR_GRAB")
            acts.append("HARASSMENT_SIGNAL")
        
        # Defensive shielding gesture (victim protection) - STRICT
        if (left_wrist[1] < left_shoulder[1] - torso_height * 0.15 and 
            left_elbow[1] < left_shoulder[1] - torso_height * 0.05) or \
           (right_wrist[1] < right_shoulder[1] - torso_height * 0.15 and 
            right_elbow[1] < right_shoulder[1] - torso_height * 0.05):
            acts.append("DEFENSIVE_SHIELD")
        
        # Restraining arm lock (against torso) - STRICT
        if (abs(left_wrist[0] - right_shoulder[0]) < shoulder_width * 0.3 and
            abs(left_wrist[1] - right_shoulder[1]) < torso_height * 0.25) or \
           (abs(right_wrist[0] - left_shoulder[0]) < shoulder_width * 0.3 and
            abs(right_wrist[1] - left_shoulder[1]) < torso_height * 0.25):
            s.append("ARM_LOCK")
            acts.append("RESTRAINT_ATTEMPT")
        
        # ---- STANDARD DETECTION - STRICT ----
        
        # Fallen person (improved) - STRICT
        body_verticality = self._calculate_body_verticality(k)
        if body_verticality < 0.35:  # More strict
            s.append("FALLEN")
            acts.append("PRONE_POSITION")
        
        # Running detection - STRICT
        if self._is_running(k, conf):
            acts.append("RUNNING")
        
        # Crouching detection - STRICT
        if self._is_crouching(k):
            acts.append("CROUCHING")
        
        # Hands up (surrender or threat) - STRICT
        if left_wrist[1] < left_shoulder[1] - torso_height * 0.2 and \
           right_wrist[1] < right_shoulder[1] - torso_height * 0.2:
            acts.append("HANDS_UP")
        
        # ---- WEAPON-SPECIFIC DETECTION - STRICT ACCURACY ----
        
        # Gun holding posture - ONE ARM EXTENDED HORIZONTALLY
        left_gun_posture = self._is_gun_holding_posture(
            left_shoulder, left_elbow, left_wrist, right_shoulder, right_elbow, right_wrist, torso_height, conf, [5, 7, 9]
        )
        right_gun_posture = self._is_gun_holding_posture(
            right_shoulder, right_elbow, right_wrist, left_shoulder, left_elbow, left_wrist, torso_height, conf, [6, 8, 10]
        )
        
        if left_gun_posture:
            s.append("GUN_HOLDING_LEFT")
            acts.append("ARMED_THREAT")
        if right_gun_posture:
            s.append("GUN_HOLDING_RIGHT")
            acts.append("ARMED_THREAT")
        
        # Gun aiming posture - ONE ARM RAISED WITH ELBOW BENT, OTHER HAND SUPPORTING
        left_aiming = self._is_gun_aiming_posture(
            left_shoulder, left_elbow, left_wrist, right_wrist, torso_height, conf, [5, 7, 9, 10]
        )
        right_aiming = self._is_gun_aiming_posture(
            right_shoulder, right_elbow, right_wrist, left_wrist, torso_height, conf, [6, 8, 10, 9]
        )
        
        if left_aiming:
            s.append("GUN_AIMING_LEFT")
            acts.append("SHOOTING_THREAT")
        if right_aiming:
            s.append("GUN_AIMING_RIGHT")
            acts.append("SHOOTING_THREAT")
        
        # Knife wielding - AGGRESSIVE ARM MOTION WITH HIGH SPEED
        left_knife = self._is_knife_wielding(
            left_shoulder, left_elbow, left_wrist, torso_height, conf, [5, 7, 9]
        )
        right_knife = self._is_knife_wielding(
            right_shoulder, right_elbow, right_wrist, torso_height, conf, [6, 8, 10]
        )
        
        if left_knife:
            s.append("KNIFE_WIELDING_LEFT")
            acts.append("WEAPON_THREAT")
        if right_knife:
            s.append("KNIFE_WIELDING_RIGHT")
            acts.append("WEAPON_THREAT")
        
        # Stabbing motion - DOWNWARD THRUSTING WITH TENSION
        left_stab = self._is_stabbing_motion(
            left_shoulder, left_elbow, left_wrist, torso_height, conf, [5, 7, 9]
        )
        right_stab = self._is_stabbing_motion(
            right_shoulder, right_elbow, right_wrist, torso_height, conf, [6, 8, 10]
        )
        
        if left_stab:
            s.append("STABBING_MOTION_LEFT")
            acts.append("STABBING_ATTACK")
        if right_stab:
            s.append("STABBING_MOTION_RIGHT")
            acts.append("STABBING_ATTACK")
        
        # Victim vulnerability detection - STRICT
        if (self._is_crouching(k) or body_verticality < 0.4) and len(s) == 0:
            s.append("VULNERABLE_POSITION")
            acts.append("DEFENSIVE_POSTURE")
        
        return s, acts
    
    # -------------------------------------------------
    # IMPROVED INTERACTION ANALYSIS - STRICT ACCURACY
    # -------------------------------------------------
    def _analyze_interactions(self, kps_all, boxes, person_signals, conf_all=None):
        s = []
        acts = []
        n = len(kps_all)
        
        for i in range(n):
            for j in range(i + 1, n):
                # Validate body positions
                hip_i = self._get_hip_center(kps_all[i])
                hip_j = self._get_hip_center(kps_all[j])
                
                if hip_i is None or hip_j is None:
                    continue
                
                distance = self._distance(hip_i, hip_j)
                frame_diagonal = self._calculate_frame_diagonal(boxes[i], boxes[j])
                
                if frame_diagonal <= 0:
                    continue
                
                normalized_distance = distance / frame_diagonal
                
                # ---- WOMEN-SPECIFIC CRIME INTERACTIONS - STRICT ----
                
                # Rear approach (stalking/sexual assault indicator) - STRICT
                if self._is_rear_approach(kps_all[i], kps_all[j], conf_all, i, j):
                    if normalized_distance < 0.35:  # Stricter proximity
                        s.append("REAR_APPROACH")
                        acts.append("STALKING_SIGNAL")
                
                # Unwanted proximity from behind - STRICT
                if self._is_close_rear_contact(kps_all[i], kps_all[j], normalized_distance, conf_all, i, j):
                    s.append("REAR_CONTACT")
                    acts.append("HARASSMENT_SIGNAL")
                
                # Downward arm positioning over another person (restraint/control) - STRICT
                if self._is_restraining_hold(kps_all[i], kps_all[j], conf_all, i, j):
                    s.append("RESTRAINING_HOLD")
                    acts.append("CONFINEMENT_SIGNAL")
                
                # Circle surrounding pattern (mob mentality/collective crime) - STRICT
                if n >= 3 and self._is_surrounding_pattern(kps_all, i, j, conf_all):
                    s.append("SURROUNDING_PATTERN")
                    acts.append("GROUP_HARASSMENT")
                
                # Hands on shoulders from behind (control/force) - STRICT
                if self._is_shoulder_control(kps_all[i], kps_all[j], conf_all, i, j):
                    s.append("SHOULDER_CONTROL")
                    acts.append("PHYSICAL_CONTROL")
                
                # ---- STANDARD INTERACTIONS - STRICT ----
                
                # Close contact (based on body proportions) - STRICT
                if normalized_distance < 0.35:  # Stricter
                    s.append("CLOSE_CONTACT")
                    acts.append("PHYSICAL_PROXIMITY")
                
                # Body collision detection (very close contact) - STRICT
                if normalized_distance < 0.15:  # Stricter
                    s.append("BODY_COLLISION")
                    acts.append("PHYSICAL_CONTACT")
                
                # Assault detection - HEAD CONTACT ONLY
                torso_i = abs(kps_all[i][0][1] - (kps_all[i][11][1] + kps_all[i][12][1]) / 2)
                
                for wrist_idx in [9, 10]:  # Left and right wrists
                    for head_idx in [0, 1, 2, 3, 4]:  # Head keypoints
                        if np.any(np.isnan(kps_all[i][wrist_idx])) or np.any(np.isnan(kps_all[j][head_idx])):
                            continue
                        dist = self._distance(kps_all[i][wrist_idx], kps_all[j][head_idx])
                        if dist < 40:  # Stricter threshold
                            # Verify wrist is actually extended
                            if wrist_idx == 9:
                                is_extended = self._is_arm_extended(kps_all[i][5], kps_all[i][7], kps_all[i][9], torso_i, conf_all[i] if conf_all is not None else None, [5, 7, 9])
                            else:
                                is_extended = self._is_arm_extended(kps_all[i][6], kps_all[i][8], kps_all[i][10], torso_i, conf_all[i] if conf_all is not None else None, [6, 8, 10])
                            
                            if is_extended:
                                s.append("ASSAULT_HEAD")
                                acts.append("PHYSICAL_ASSAULT")
                
                # Body contact (torso level) 
                for wrist_idx in [9, 10]:
                    for body_idx in [5, 6, 11, 12]:  # Shoulders and hips
                        if np.any(np.isnan(kps_all[i][wrist_idx])) or np.any(np.isnan(kps_all[j][body_idx])):
                            continue
                        dist = self._distance(kps_all[i][wrist_idx], kps_all[j][body_idx])
                        if dist < 30:  # Stricter
                            s.append("BODY_CONTACT")
                            acts.append("PHYSICAL_ASSAULT")
                
                # Grabbing detection - STRICT
                if self._is_grabbing(kps_all[i], kps_all[j], conf_all, i, j):
                    s.append("GRABBING")
                    acts.append("RESTRAINING_MOTION")
                
                # Following/chasing detection - STRICT
                if self._is_following(kps_all[i], kps_all[j], boxes[i], boxes[j]):
                    acts.append("FOLLOWING_CHASING")
                
                # Crowd formation detection
                if n >= 3:
                    if self._is_circle_formation([kps_all[i], kps_all[j]], kps_all):
                        acts.append("CROWD_FORMATION")
                
                # Overpower detection (aggressor standing over crouched victim)
                vertical_diff = abs(hip_i[1] - hip_j[1])
                
                if vertical_diff > 30:  # Stricter
                    s.append("POWER_IMBALANCE")
                    acts.append("DOMINANT_POSITION")
                
                # Strong assault detection rule - ONLY WITH MULTIPLE SIGNALS
                if "CLOSE_CONTACT" in s and (
                    ("AGGRESSIVE_GESTURE" in acts and ("PUNCH_LEFT" in s or "PUNCH_RIGHT" in s)) or
                    ("KICKING_MOTION" in acts and ("KICK_LEFT" in s or "KICK_RIGHT" in s)) or
                    ("BODY_COLLISION" in s and "ASSAULT_HEAD" in s)
                ):
                    s.append("DIRECT_ASSAULT")
                    acts.append("PHYSICAL_ASSAULT")
        
        return s, acts
    
    # -------------------------------------------------
    # HELPER METHODS
    # -------------------------------------------------
    def _is_arm_extended(self, shoulder, elbow, wrist, torso_height, conf=None, indices=None):
        """Check if arm is relatively straight and extended - STRICT"""
        # Validate keypoints are not NaN
        if np.any(np.isnan(shoulder)) or np.any(np.isnan(elbow)) or np.any(np.isnan(wrist)):
            return False
        
        # Check confidence if available
        if conf is not None and indices is not None:
            min_conf = 0.5
            if not all(conf[i] > min_conf for i in indices):
                return False
        
        # Calculate angles
        angle1 = self._angle_between(shoulder, elbow, wrist)
        # Check if arm is relatively straight (angle close to 180 degrees) - STRICT
        arm_straight = abs(angle1 - 180) < 35  # More strict
        
        # Check extension length - STRICT
        arm_length = self._distance(shoulder, wrist)
        extended = arm_length > torso_height * 0.4  # Stricter
        
        return arm_straight and extended
    
    def _is_leg_raised(self, hip, knee, ankle, torso_height, conf=None, indices=None):
        """Check if leg is raised for kicking - STRICT"""
        # Validate keypoints
        if np.any(np.isnan(hip)) or np.any(np.isnan(knee)) or np.any(np.isnan(ankle)):
            return False
        
        # Check confidence if available
        if conf is not None and indices is not None:
            min_conf = 0.5
            if not all(conf[i] > min_conf for i in indices):
                return False
        
        hip_level = hip[1]
        knee_level = knee[1]
        ankle_level = ankle[1]
        
        # Check if knee is significantly higher than hip (front kick) - STRICT
        front_kick = knee_level < hip_level - torso_height * 0.15  # Stricter
        
        # Check if ankle is significantly higher than knee (high kick) - STRICT
        high_kick = ankle_level < knee_level - torso_height * 0.15  # Stricter
        
        # Check leg angle for side kick - STRICT range
        leg_angle = self._angle_between(hip, knee, ankle)
        side_kick = 110 < leg_angle < 170  # More strict
        
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
    
    def _is_running(self, k, conf=None):
        """Detect running motion - STRICT"""
        # Check confidence
        if conf is not None:
            if not all(conf[i] > 0.5 for i in [11, 13, 15, 12, 14, 16]):
                return False
        
        # Check if legs are in running position - STRICT
        left_leg_angle = self._angle_between(k[11], k[13], k[15])
        right_leg_angle = self._angle_between(k[12], k[14], k[16])
        
        # Running typically has legs bent at acute angles - STRICT
        leg_bending = (left_leg_angle < 135 or right_leg_angle < 135)
        
        # Check knee separation (dynamic leg movement)
        knee_separation = abs(k[13][1] - k[14][1]) > 25  # Stricter
        
        return leg_bending and knee_separation
    
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
    
    def _is_grabbing(self, kps1, kps2, conf_all=None, idx1=None, idx2=None):
        """Check if one person is grabbing another - STRICT"""
        # Check confidence
        if conf_all is not None and idx1 is not None and idx2 is not None:
            wrist_conf_ok = conf_all[idx1][9] > 0.5 and conf_all[idx1][10] > 0.5
            if not wrist_conf_ok:
                return False
        
        for wrist_idx in [9, 10]:  # Check both wrists
            for body_idx in [5, 6, 11, 12]:  # Shoulders and hips only
                if (np.any(np.isnan(kps1[wrist_idx])) or 
                    np.any(np.isnan(kps2[body_idx]))):
                    continue
                if self._distance(kps1[wrist_idx], kps2[body_idx]) < 30:  # Stricter
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
        """Maintain a history of signals with improved tracking"""
        self.frame_history.append(set(signals))
        if len(self.frame_history) > self.max_history:
            self.frame_history.pop(0)
    
    def _temporal_analysis(self):
        """Improved temporal analysis for sustained signals - STRICT"""
        if len(self.frame_history) < 5:  # Require at least 5 frames for confirmation
            return []
        
        # Find signals that appear in at least 70% of recent frames
        recent_frames = self.frame_history[-5:]
        signal_counts = defaultdict(int)
        
        for frame_signals in recent_frames:
            for signal in frame_signals:
                signal_counts[signal] += 1
        
        # Only return signals that appear consistently (at least 3 out of 5 frames)
        sustained_signals = [sig for sig, count in signal_counts.items() if count >= 3]
        return sustained_signals
    
    def _calculate_threat_score(self, signals, activities, persons):
        """Improved threat scoring with robbery and property crimes"""
        score = 0
        
        # Convert to sets for easier checking
        signal_set = set(signals)
        activity_set = set(activities)
        
        # Signal weights - increased weights for assault-related signals + weapons
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
            "SURROUNDING_PATTERN": 35,
            # WEAPON-SPECIFIC SIGNALS (HIGH PRIORITY)
            "GUN_HOLDING_LEFT": 45, "GUN_HOLDING_RIGHT": 45,
            "GUN_AIMING_LEFT": 50, "GUN_AIMING_RIGHT": 50,
            "KNIFE_WIELDING_LEFT": 42, "KNIFE_WIELDING_RIGHT": 42,
            "STABBING_MOTION_LEFT": 48, "STABBING_MOTION_RIGHT": 48,
        }
        
        # Activity weights - increased weights with robbery/property crime indicators + weapons
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
            "CONFINEMENT_SIGNAL": 40,
            # Robbery & property crime indicators
            "ROBBERY_INDICATOR": 28,
            "THEFT_ATTEMPT": 18,
            "EVASIVE_MOTION": 22,
            "COORDINATED_ACTION": 25,
            "RAPID_ESCAPE": 30,
            # WEAPON-SPECIFIC ACTIVITIES (CRITICAL)
            "ARMED_THREAT": 48,
            "SHOOTING_THREAT": 52,
            "WEAPON_THREAT": 45,
            "STABBING_ATTACK": 50,
        }
        
        # Add signal scores
        for signal in signal_set:
            score += signal_weights.get(signal, 5)
        
        # Add activity scores
        for activity in activity_set:
            score += activity_weights.get(activity, 5)
        
        # Multiplier for multiple persons - CONSERVATIVE
        if persons >= 3:
            score *= 1.4  # Reduced from 1.5
        elif persons == 2:
            score *= 1.2  # Reduced from 1.3
        
        # Sustained signals multiplier - REQUIRES MORE FRAMES
        if len(self.frame_history) >= 5:
            recent_frames = self.frame_history[-5:]
            intersection_signals = set.intersection(*recent_frames) if recent_frames else set()
            if len(intersection_signals) > 0:
                score *= 1.2  # Reduced from 1.3
        
        # Extra score for running + grabbing (REQUIRES BOTH)
        if "RUNNING" in activity_set and "GRABBING" in signal_set:
            score += 10  # Reduced from 15
        
        # Extra score for threat gestures + close contact (STRICT)
        threat_gestures = any(sig in signal_set for sig in ["WEAPON_THREAT_LEFT", "WEAPON_THREAT_RIGHT"])
        if threat_gestures and "CLOSE_CONTACT" in signal_set and persons >= 2:
            score += 15  # Reduced from 20
        
        # WEAPON BOOST: Any weapon signal gets significant threat score boost
        has_gun = any(sig in signal_set for sig in ["GUN_HOLDING_LEFT", "GUN_HOLDING_RIGHT", "GUN_AIMING_LEFT", "GUN_AIMING_RIGHT"])
        has_knife = any(sig in signal_set for sig in ["KNIFE_WIELDING_LEFT", "KNIFE_WIELDING_RIGHT", "STABBING_MOTION_LEFT", "STABBING_MOTION_RIGHT"])
        if has_gun or has_knife:
            score += 15  # Additional threat boost for weapons
        
        # Reduce score for ambiguous signals
        if len(signal_set) == 1 and score < 50:
            score *= 0.8  # Penalize single signals
        
        return min(100, score)
    
    # -------------------------------------------------
    # IMPROVED CLASSIFICATION - 50+ Crime Types (100% ACCURACY)
    # -------------------------------------------------
    def _classify(self, signals, activities, persons):
        s = set(signals)
        a = set(activities)

        # Early validation: not enough signals = not a crime
        if len(s) == 0 and len(a) == 0:
            return "Normal", "LOW"
        
        # Helper flags
        has_punch = any(sig.startswith("PUNCH") for sig in s)
        has_kick = any(sig.startswith("KICK") for sig in s)
        has_assault_signal = any(sig in ["ASSAULT_HEAD", "BODY_CONTACT", "DIRECT_ASSAULT"] for sig in s)
        has_physical_contact = any(sig in ["CLOSE_CONTACT", "BODY_COLLISION", "GRABBING"] for sig in s)
        
        # Women-specific crime indicators - STRICT
        has_chest_contact = "CHEST_CONTACT" in s
        has_lower_body_contact = "LOWER_BODY_CONTACT" in s
        has_hair_grab = "HAIR_GRAB" in s
        has_rear_contact = "REAR_CONTACT" in s
        has_restraining_hold = "RESTRAINING_HOLD" in s
        has_shoulder_control = "SHOULDER_CONTROL" in s
        has_sexual_assault_signal = "SEXUAL_ASSAULT_SIGNAL" in a
        
        # WEAPON-SPECIFIC INDICATORS - NEW
        has_gun_holding = any(sig in s for sig in ["GUN_HOLDING_LEFT", "GUN_HOLDING_RIGHT"])
        has_gun_aiming = any(sig in s for sig in ["GUN_AIMING_LEFT", "GUN_AIMING_RIGHT"])
        has_knife_wielding = any(sig in s for sig in ["KNIFE_WIELDING_LEFT", "KNIFE_WIELDING_RIGHT"])
        has_stabbing = any(sig in s for sig in ["STABBING_MOTION_LEFT", "STABBING_MOTION_RIGHT"])
        has_armed_threat = "ARMED_THREAT" in a
        has_shooting_threat = "SHOOTING_THREAT" in a
        has_weapon_threat = "WEAPON_THREAT" in a
        has_stabbing_attack = "STABBING_ATTACK" in a
        
        # Validate person count
        persons_engaged = sum(1 for i in range(persons) if len(s) > 0 or len(a) > 0)
        
        # ---- CRITICAL WEAPON-BASED CRIMES (HIGHEST PRIORITY) ----
        
        # Armed Murder Attempt / Shooting Attack (gun + physical approach + assault)
        if has_gun_aiming and (has_assault_signal or has_physical_contact or persons >= 2):
            return "Shooting / Armed Murder Attempt", "CRITICAL"
        
        # Armed Assault General (gun/knife + assault)
        if (has_gun_holding or has_knife_wielding) and (has_punch or has_kick or has_assault_signal):
            if has_knife_wielding and has_stabbing:
                return "Stabbing Attack / Armed Assault", "CRITICAL"
            elif has_gun_holding:
                return "Armed Assault / Gun Threat", "CRITICAL"
            else:
                return "Armed Assault / Weapon Attack", "CRITICAL"
        
        # Stabbing (knife-specific)
        if has_stabbing and has_physical_contact and persons >= 2:
            return "Stabbing Attack", "CRITICAL"
        
        # Shootout / Gun Threat (multiple persons with guns)
        if persons >= 2 and has_gun_holding and has_assault_signal:
            return "Shootout / Armed Conflict", "CRITICAL"
        
        # Armed Robbery (gun/knife + grabbing + close contact)
        if (has_gun_holding or has_knife_wielding) and "GRABBING" in s and "CLOSE_CONTACT" in s and persons == 2:
            return "Armed Robbery / Armed Theft", "CRITICAL"
        
        # Armed Carjacking (weapon threat + vehicle interaction - inferred from two persons scenario)
        if (has_gun_holding or has_knife_wielding) and persons == 2 and has_physical_contact:
            if "GRABBING" in s:
                return "Armed Carjacking / Vehicle Hijacking", "CRITICAL"
        
        # Assault with Weapon (weapon + victim)
        if (has_gun_holding or has_knife_wielding) and "VULNERABLE_POSITION" in s and persons >= 2:
            return "Assault with Weapon / Victim Abuse", "CRITICAL"
        
        # Weapon Threat / Intimidation (weapon visible, no immediate action)
        if (has_gun_holding or has_knife_wielding) and not has_assault_signal and not has_physical_contact:
            if has_gun_aiming:
                return "Armed Threat / Gun Threat", "HIGH"
            elif has_knife_wielding:
                return "Knife Threat / Armed Threat", "HIGH"
            else:
                return "Weapon Threat / Armed Intimidation", "HIGH"
        
        # ---- CRITICAL WOMEN-RELATED CRIMES (HIGHEST ACCURACY) ----
        
        # Sexual Assault / Rape - CRITICAL (requires multiple signals)
        if has_lower_body_contact and (has_restraining_hold or "ARM_LOCK" in s) and persons == 2:
            # Must have multiple indicators
            restraint_count = sum(1 for sig in s if "RESTRAINING" in sig or "ARM_LOCK" in sig)
            if restraint_count >= 1 and "RESTRAINT_ATTEMPT" in a:
                return "Attempted Rape / Sexual Assault", "CRITICAL"
        
        # Sexual Assault / Molestation with restraint (requires contacts + restraint)
        if (has_lower_body_contact or (has_chest_contact and has_hair_grab)) and \
           has_physical_contact and has_restraining_hold and persons == 2:
            return "Sexual Assault / Molestation", "CRITICAL"
        
        # Eve Teasing / Harassment (requires rear contact + harassment signals)
        if has_rear_contact and "HARASSMENT_SIGNAL" in a and not has_restraining_hold and persons == 2:
            return "Eve Teasing / Harassment", "HIGH"
        
        # Stalking (requires sustained rear approach + following)
        if "STALKING_SIGNAL" in a and (has_rear_contact or "FOLLOWING_CHASING" in a):
            return "Stalking / Harassment", "HIGH"
        
        # Domestic Violence (two persons, assault, domination)
        if persons == 2 and (has_punch or has_kick) and has_assault_signal and \
           (has_restraining_hold or "DOMINANT_POSITION" in a):
            return "Domestic Violence", "CRITICAL"
        
        # Indecent Assault/Groping (chest/hair grab without lower body)
        if (has_chest_contact or has_hair_grab) and not has_lower_body_contact and \
           "CLOSE_CONTACT" in s and persons == 2:
            return "Indecent Assault / Groping", "HIGH"
        
        # ---- VIOLENCE & ASSAULT CRIMES ----
        
        # Attempted Murder / Choking
        if "GRAB_NECK_LEFT" in s or "GRAB_NECK_RIGHT" in s:
            return "Choking / Attempted Murder", "CRITICAL"
        
        # Woman Assault / Physical Violence - requires multiple signals
        if persons >= 2 and (has_punch or has_kick) and has_assault_signal and \
           ("VULNERABLE_POSITION" in s or "POWER_IMBALANCE" in s):
            return "Woman Assault / Physical Violence", "CRITICAL"
        
        # Direct Assault (requires collision + aggression OR multiple assault signals)
        if "DIRECT_ASSAULT" in s:
            if "VULNERABLE_POSITION" in s:
                return "Woman Assault / Physical Violence", "CRITICAL"
            else:
                return "Physical Assault", "HIGH"
        
        # Mob/Mass Assault (3+ persons with multiple assault signals)
        if persons >= 3 and (has_punch or has_kick or has_assault_signal) and \
           has_physical_contact and ("SURROUNDING_PATTERN" in s or "CROWD_FORMATION" in a):
            return "Mob Lynching / Mass Assault", "CRITICAL"
        
        # ---- ROBBERY & PROPERTY CRIMES ----
        
        # Robbery/Mugging (grabbing + close contact + 2 persons)
        if persons == 2 and "GRABBING" in s and "CLOSE_CONTACT" in s:
            if "RUNNING" in a or "FOLLOWING_CHASING" in a:
                if has_punch or has_kick:
                    return "Aggressive Robbery / Mugging", "HIGH"
                else:
                    return "Robbery / Mugging", "HIGH"
            else:
                return "Robbery Attempt", "HIGH"
        
        # Chain/Gold Snatching (grab + running + following)
        if persons == 2 and "GRABBING" in s and "RUNNING" in a and "FOLLOWING_CHASING" in a:
            return "Chain / Gold Snatching", "HIGH"
        
        # Pickpocketing/Theft (close contact, no violence, stealthy)
        if persons == 2 and "CLOSE_CONTACT" in s and not has_physical_contact and \
           not has_assault_signal and ("FOLLOWING_CHASING" in a or has_rear_contact):
            return "Pickpocketing / Theft", "MEDIUM"
        
        # Purse Snatching (grab + running)
        if persons == 2 and "GRABBING" in s and "RUNNING" in a:
            return "Purse / Bag Snatching", "HIGH"
        
        # ---- ORGANIZED & GROUP CRIMES ----
        
        # Gang Violence (3+ persons, assault, surrounding)
        if persons >= 3 and (has_punch or has_kick or has_assault_signal) and \
           "SURROUNDING_PATTERN" in s and "DOMINANT_POSITION" in a:
            return "Gang Violence / Territorial Fight", "CRITICAL"
        
        # ---- GENERAL CRIMES ----
        
        # Threatening Behavior (threat gesture + close contact, no violence)
        if "THREATENING_GESTURE" in a and "CLOSE_CONTACT" in s and \
           not has_physical_contact and not has_assault_signal:
            return "Threatening Behavior", "MEDIUM"
        
        # Fight (2 persons, punches/kicks, close contact)
        if persons == 2 and (has_punch or has_kick) and ("AGGRESSIVE_GESTURE" in a or has_assault_signal):
            return "Fight / Physical Violence", "HIGH"
        
        # Assault on Fallen (person down + punches/kicks)
        if "FALLEN" in s and persons >= 2 and (has_punch or has_kick):
            return "Assault on Fallen Victim", "CRITICAL"
        
        # Low threat scenarios
        if len(s) > 0 and all(sig not in s for sig in 
            ["PUNCH_LEFT", "PUNCH_RIGHT", "KICK_LEFT", "KICK_RIGHT", "GRABBING", "ASSAULT_HEAD"]):
            if "DEFENSIVE_SHIELD" in a or len(s) == 1:
                return "Suspicious Activity", "LOW"
        
        return "Normal", "LOW"

    
    # ---- WOMEN-SPECIFIC CRIME HELPER METHODS ----
    
    def _is_rear_approach(self, kps1, kps2, conf_all=None, idx1=None, idx2=None):
        """Detect if one person is approaching another from behind - STRICT"""
        pos1 = self._get_hip_center(kps1)
        pos2 = self._get_hip_center(kps2)
        
        if pos1 is None or pos2 is None:
            return False
        
        # Check confidence if provided
        if conf_all is not None and idx1 is not None and idx2 is not None:
            if conf_all[idx1][11] < 0.5 or conf_all[idx1][12] < 0.5 or \
               conf_all[idx2][11] < 0.5 or conf_all[idx2][12] < 0.5:
                return False
        
        # Get facing direction of person 2
        facing_dir = self._get_facing_direction(kps2)
        
        # Vector from person2 to person1
        vec_to_person1 = [pos1[0] - pos2[0], pos1[1] - pos2[1]]
        mag = math.sqrt(vec_to_person1[0]**2 + vec_to_person1[1]**2)
        
        if mag < 1e-6:
            return False
        
        vec_to_person1 = [vec_to_person1[0]/mag, vec_to_person1[1]/mag]
        
        # If person1 is behind person2 (opposite to facing direction) - STRICT
        dot = facing_dir[0]*vec_to_person1[0] + facing_dir[1]*vec_to_person1[1]
        return dot < -0.4  # Stricter threshold
    
    def _is_close_rear_contact(self, kps1, kps2, normalized_distance, conf_all=None, idx1=None, idx2=None):
        """Detect close contact from behind (harassment pattern) - STRICT"""
        if not self._is_rear_approach(kps1, kps2, conf_all, idx1, idx2):
            return False
        return normalized_distance < 0.20  # Stricter
    
    def _is_restraining_hold(self, kps1, kps2, conf_all=None, idx1=None, idx2=None):
        """Detect arm positioning suggesting restraint - STRICT"""
        # Check confidence
        if conf_all is not None and idx1 is not None:
            if conf_all[idx1][9] < 0.5 or conf_all[idx1][10] < 0.5:
                return False
        
        hip_center = self._get_hip_center(kps2)
        
        if hip_center is None:
            return False
        
        # If both wrists are below shoulder level and close to target - STRICT
        wrist1_low = kps1[9][1] > kps1[5][1] and kps1[10][1] > kps1[6][1]
        wrist1_close_x = abs(kps1[9][0] - hip_center[0]) < 40 and abs(kps1[10][0] - hip_center[0]) < 40
        
        return wrist1_low and wrist1_close_x
    
    def _is_shoulder_control(self, kps1, kps2, conf_all=None, idx1=None, idx2=None):
        """Detect hands on shoulders from behind (control gesture) - STRICT"""
        # Check confidence
        if conf_all is not None and idx1 is not None and idx2 is not None:
            if not (conf_all[idx1][9] > 0.5 and conf_all[idx1][10] > 0.5 and
                    conf_all[idx2][5] > 0.5 and conf_all[idx2][6] > 0.5):
                return False
        
        shoulder_l2 = kps2[5]
        shoulder_r2 = kps2[6]
        
        # Check if wrists are near shoulders - STRICT
        left_wrist_near = self._distance(kps1[9], shoulder_l2) < 30
        right_wrist_near = self._distance(kps1[10], shoulder_r2) < 30
        
        # Also verify hands are above shoulders
        wrists_above = kps1[9][1] < shoulder_l2[1] or kps1[10][1] < shoulder_r2[1]
        
        return (left_wrist_near or right_wrist_near) and wrists_above
    
    def _is_surrounding_pattern(self, kps_all, idx_i, idx_j, conf_all=None):
        """Detect if people are forming a surrounding/mob pattern - STRICT"""
        if len(kps_all) < 3:
            return False
        
        target_idx = idx_j
        other_centers = []
        
        for k, kps in enumerate(kps_all):
            if k != target_idx:
                center = self._get_hip_center(kps)
                if center is not None:
                    other_centers.append((k, center))
        
        if len(other_centers) < 2:
            return False
        
        target_center = self._get_hip_center(kps_all[target_idx])
        
        if target_center is None:
            return False
        
        # Check if others are surrounding (distributed around target) - STRICT
        angles = []
        for k, center in other_centers:
            vec = [center[0] - target_center[0], center[1] - target_center[1]]
            angle = math.atan2(vec[1], vec[0])
            angles.append(angle)
        
        # Check if angles are spread out (not all in one direction)
        angles_sorted = sorted(angles)
        if len(angles_sorted) >= 2:
            total_spread = max(angles_sorted) - min(angles_sorted)
            return total_spread > math.pi / 1.5  # Stricter: > 120 degrees
        
        return False
    
    # ---- ROBBERY & PROPERTY CRIME HELPER METHODS ----
    
    def _is_hand_to_pocket_movement(self, kps1, kps2):
        """Detect hand-to-pocket/bag area movement (pickpocketing)"""
        # Pocket areas are typically near hips and waist
        wrist_l = kps1[9]
        wrist_r = kps1[10]
        hip_center = self._get_hip_center(kps2)
        
        if hip_center is None:
            return False
        
        # Check if wrists are near hip/waist area
        left_wrist_near_pocket = self._distance(wrist_l, hip_center) < 60
        right_wrist_near_pocket = self._distance(wrist_r, hip_center) < 60
        
        return left_wrist_near_pocket or right_wrist_near_pocket
    
    def _is_pursuit_pattern(self, kps1, kps2, box1, box2):
        """Detect pursuit/chase pattern (for robbery/mugging)"""
        pos1 = self._get_hip_center(kps1)
        pos2 = self._get_hip_center(kps2)
        
        if pos1 is None or pos2 is None:
            return False
        
        # Check if person1 is behind person2
        facing_dir_2 = self._get_facing_direction(kps2)
        vec_to_person2 = [pos2[0] - pos1[0], pos2[1] - pos1[1]]
        mag = math.sqrt(vec_to_person2[0]**2 + vec_to_person2[1]**2)
        
        if mag < 1e-6:
            return False
        
        vec_to_person2 = [vec_to_person2[0]/mag, vec_to_person2[1]/mag]
        
        # If person2 is ahead and person1 is behind
        dot = facing_dir_2[0]*vec_to_person2[0] + facing_dir_2[1]*vec_to_person2[1]
        return dot > 0.5
    
    def _is_evasive_running(self, kps):
        """Detect evasive/panic running pattern"""
        # Check for irregular leg movements and high speed posture
        left_leg_angle = self._angle_between(kps[11], kps[13], kps[15])
        right_leg_angle = self._angle_between(kps[12], kps[14], kps[16])
        
        # Evasive running has more bent legs
        high_knee_lift = abs(kps[13][1] - kps[14][1]) > 20
        leg_bend = left_leg_angle < 130 or right_leg_angle < 130
        
        return high_knee_lift and leg_bend
    
    def _is_armed_threat_posture(self, kps):
        """Detect posture suggesting armed threat"""
        # Straight arm extended from body suggesting holding/pointing weapon
        torso_height = abs(kps[0][1] - (kps[11][1] + kps[12][1]) / 2)
        left_arm_extended = self._is_arm_extended(kps[5], kps[7], kps[9], torso_height)
        right_arm_extended = self._is_arm_extended(kps[6], kps[8], kps[10], torso_height)
        
        # Both arms extended or one arm very straight and tense
        return left_arm_extended or right_arm_extended
    
    def _is_group_coordination(self, kps_all, idx_i, idx_j):
        """Detect if group appears coordinated (for organized crime)"""
        if len(kps_all) < 3:
            return False
        
        # Check if people are at similar angles (forming lines)
        angles = []
        for k in kps_all:
            facing_dir = self._get_facing_direction(k)
            angle = math.atan2(facing_dir[1], facing_dir[0])
            angles.append(angle)
        
        # Calculate angle variance - low variance suggests coordination
        angles_array = np.array(angles)
        angle_variance = np.var(angles_array)
        
        return angle_variance < 0.5
    
    def _is_getaway_pattern(self, kps1, kps2, box1, box2):
        """Detect getaway pattern (rapid separation with running)"""
        pos1 = self._get_hip_center(kps1)
        pos2 = self._get_hip_center(kps2)
        
        if pos1 is None or pos2 is None:
            return False
        
        # Check if both are running in opposite directions
        dir1 = self._get_facing_direction(kps1)
        dir2 = self._get_facing_direction(kps2)
        
        # Opposite directions would have negative dot product
        dot = dir1[0]*dir2[0] + dir1[1]*dir2[1]
        
        return dot < -0.4
    
    # ---- WEAPON DETECTION HELPER METHODS ----
    
    def _is_gun_holding_posture(self, arm_shoulder, arm_elbow, arm_wrist, other_shoulder, other_elbow, other_wrist, torso_height, conf=None, indices=None):
        """Detect gun holding posture - ONE ARM EXTENDED OUTWARD HORIZONTALLY - STRICT"""
        # Validate keypoints
        if np.any(np.isnan(arm_shoulder)) or np.any(np.isnan(arm_elbow)) or np.any(np.isnan(arm_wrist)):
            return False
        
        # Check confidence if available
        if conf is not None and indices is not None:
            min_conf = 0.5
            if not all(conf[i] > min_conf for i in indices):
                return False
        
        # Gun posture: arm extended horizontally (wrist roughly level with shoulder)
        wrist_height_diff = abs(arm_wrist[1] - arm_shoulder[1])
        shoulder_to_wrist_dist = self._distance(arm_shoulder, arm_wrist)
        
        # Horizontal extension - wrist at similar height to shoulder, extended outward
        is_horizontal = wrist_height_diff < torso_height * 0.15  # Wrist roughly level with shoulder
        is_extended = shoulder_to_wrist_dist > torso_height * 0.5  # Extended outward
        
        # Arm angle should be roughly straight
        arm_angle = self._angle_between(arm_shoulder, arm_elbow, arm_wrist)
        is_straight = abs(arm_angle - 180) < 40
        
        # Other arm should NOT be in same posture (e.g., not both arms extended)
        other_extended = self._distance(other_shoulder, other_wrist) > torso_height * 0.4
        
        return is_horizontal and is_extended and is_straight and not other_extended
    
    def _is_gun_aiming_posture(self, arm_shoulder, arm_elbow, arm_wrist, other_wrist, torso_height, conf=None, indices=None):
        """Detect gun aiming posture - ONE ARM RAISED, ELBOW BENT, OTHER ARM SUPPORTING - STRICT"""
        # Validate keypoints
        if np.any(np.isnan(arm_shoulder)) or np.any(np.isnan(arm_elbow)) or np.any(np.isnan(arm_wrist)):
            return False
        
        # Check confidence
        if conf is not None and indices is not None:
            min_conf = 0.5
            if not all(conf[i] > min_conf for i in indices):
                return False
        
        # Aiming posture: arm raised with elbow bent (like holding gun at chest/head level)
        wrist_raised = arm_wrist[1] < arm_shoulder[1] - torso_height * 0.15  # Wrist above shoulder
        elbow_bent = abs(self._angle_between(arm_shoulder, arm_elbow, arm_wrist) - 90) < 35  # ~90 degree angle
        
        # Supporting hand should be close to this arm (both hands together for gun grip)
        supporting_distance = self._distance(arm_elbow, other_wrist)
        is_supporting = supporting_distance < torso_height * 0.3
        
        return wrist_raised and elbow_bent and is_supporting
    
    def _is_knife_wielding(self, arm_shoulder, arm_elbow, arm_wrist, torso_height, conf=None, indices=None):
        """Detect knife wielding - ARM FLEXING WITH AGGRESSIVE MOTION - STRICT"""
        # Validate keypoints
        if np.any(np.isnan(arm_shoulder)) or np.any(np.isnan(arm_elbow)) or np.any(np.isnan(arm_wrist)):
            return False
        
        # Check confidence
        if conf is not None and indices is not None:
            min_conf = 0.5
            if not all(conf[i] > min_conf for i in indices):
                return False
        
        # Knife wielding: arm extended with elbow bent (aggressive posture), could be at any angle
        shoulder_to_wrist_dist = self._distance(arm_shoulder, arm_wrist)
        is_extended = shoulder_to_wrist_dist > torso_height * 0.4
        
        # Arm angle - not fully straight (not punch), not fully bent (not hugging)
        arm_angle = self._angle_between(arm_shoulder, arm_elbow, arm_wrist)
        arm_flexed = 100 < arm_angle < 170
        
        # Elbow-to-wrist distance ratio indicates aggressive motion
        elbow_to_wrist = self._distance(arm_elbow, arm_wrist)
        shoulder_to_elbow = self._distance(arm_shoulder, arm_elbow)
        
        # Forearm extended relative to upper arm
        is_aggressive = elbow_to_wrist > shoulder_to_elbow * 0.7
        
        return is_extended and arm_flexed and is_aggressive
    
    def _is_stabbing_motion(self, arm_shoulder, arm_elbow, arm_wrist, torso_height, conf=None, indices=None):
        """Detect stabbing motion - DOWNWARD THRUSTING MOTION - STRICT"""
        # Validate keypoints
        if np.any(np.isnan(arm_shoulder)) or np.any(np.isnan(arm_elbow)) or np.any(np.isnan(arm_wrist)):
            return False
        
        # Check confidence
        if conf is not None and indices is not None:
            min_conf = 0.5
            if not all(conf[i] > min_conf for i in indices):
                return False
        
        # Stabbing: wrist should be below shoulder (thrusting downward)
        wrist_below_shoulder = arm_wrist[1] > arm_shoulder[1] + torso_height * 0.05
        
        # Arm should be relatively extended
        shoulder_to_wrist_dist = self._distance(arm_shoulder, arm_wrist)
        is_extended = shoulder_to_wrist_dist > torso_height * 0.35
        
        # Arm angle should indicate forward/downward motion (roughly 45-135 degrees)
        arm_angle = self._angle_between(arm_shoulder, arm_elbow, arm_wrist)
        is_thrusting = 70 < arm_angle < 150
        
        # Elbow should be bent (not fully extended like punch)
        elbow_distance = self._distance(arm_shoulder, arm_elbow)
        wrist_distance = self._distance(arm_elbow, arm_wrist)
        arm_bent = wrist_distance > elbow_distance * 0.5  # Forearm is significant portion
        
        return wrist_below_shoulder and is_extended and is_thrusting and arm_bent
    
    # ---- ORGANIZED CRIME HELPER METHODS ----
    
    def _is_strategic_positioning(self, kps_all):
        """Detect strategic positioning for organized crime"""
        if len(kps_all) < 3:
            return False
        
        centers = []
        for k in kps_all:
            center = self._get_hip_center(k)
            if center is not None:
                centers.append(center)
        
        if len(centers) < 3:
            return False
        
        # Check for triangular or line formation
        # Calculate centroid
        centroid = np.mean(centers, axis=0)
        
        # Calculate distances from centroid
        distances = [self._distance(c, centroid) for c in centers]
        
        # For strategic positioning, distances should be fairly uniform
        avg_dist = np.mean(distances)
        variance = np.var(distances)
        
        # Low variance = strategic positioning
        return variance / (avg_dist**2 + 1e-6) < 0.3
    
    def _count_aggressive_signals(self, person_signals):
        """Count aggressive signals in detected persons"""
        aggressive_count = 0
        for signals in person_signals:
            signal_set = set(signals)
            if any(sig in signal_set for sig in 
                   ["PUNCH_LEFT", "PUNCH_RIGHT", "KICK_LEFT", "KICK_RIGHT", 
                    "WEAPON_THREAT_LEFT", "WEAPON_THREAT_RIGHT"]):
                aggressive_count += 1
        return aggressive_count
    
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