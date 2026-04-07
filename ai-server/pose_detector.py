"""
pose_detector.py v4 — Crime detection using pose estimation
Fixes for portrait false positives, fish market false positives, and fallen victim under-detection
"""

import cv2
import math
import numpy as np
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Optional, List, Tuple, Dict, Set
from datetime import datetime
from ultralytics import YOLO


# ─────────────────────────────────────────────────────────────────────────────
#  Portrait / headshot detection helper
# ─────────────────────────────────────────────────────────────────────────────

def _is_portrait_or_headshot(kps: np.ndarray, conf=None) -> bool:
    """
    Returns True when the detected 'person' is actually a portrait/headshot
    with no visible lower body — prevents false positives from face frames.

    Criteria (any one sufficient):
      a) Hip keypoints both at (0,0) or conf < 0.15 → no lower body
      b) All of hips, knees, ankles have conf < 0.15
      c) Torso height < 35px (keypoints too close together = partial body)
    """
    # Lower body keypoints: left_hip=11, right_hip=12, left_knee=13,
    # right_knee=14, left_ankle=15, right_ankle=16
    lower_body_idx = [11, 12, 13, 14, 15, 16]

    if conf is not None:
        lower_confs = [float(conf[i]) for i in lower_body_idx if i < len(conf)]
        if lower_confs and max(lower_confs) < 0.15:
            return True  # no lower body visible at all

    # Check if hip positions are essentially (0,0) = not detected
    lh, rh = kps[11], kps[12]
    if (lh[0] < 2 and lh[1] < 2) or (rh[0] < 2 and rh[1] < 2):
        return True

    # Check torso height — too small = partial body / portrait
    nose = kps[0]
    hip_mid_y = (lh[1] + rh[1]) / 2
    torso_h = abs(nose[1] - hip_mid_y)
    if torso_h < 35:
        return True

    return False


# ─────────────────────────────────────────────────────────────────────────────
#  Food-prep context detector (suppress knife signals)
# ─────────────────────────────────────────────────────────────────────────────

def _is_food_prep_context(kps: np.ndarray, conf=None) -> bool:
    """
    Returns True when a single person's pose matches typical food-prep activity:
    - Person is leaning forward (torso not fully vertical)
    - Both wrists are below hip level (working on a surface)
    - Elbows are bent (not extended in a threatening gesture)
    This prevents cleaver/knife signals from firing on butchers/cooks.
    """
    if conf is not None:
        # Need at least wrists and hips to be visible
        needed = [9, 10, 11, 12]  # wrists + hips
        if any(float(conf[i]) < 0.2 for i in needed if i < len(conf)):
            return False

    lw, rw = kps[9], kps[10]
    lh, rh = kps[11], kps[12]
    hip_y = (lh[1] + rh[1]) / 2

    # Both wrists below or at hip level = working on a surface
    both_wrists_low = lw[1] > hip_y * 0.85 and rw[1] > hip_y * 0.85

    # Torso forward lean: shoulder midpoint y close to hip midpoint y
    ls, rs = kps[5], kps[6]
    sh_mid_y = (ls[1] + rs[1]) / 2
    torso_h = abs(sh_mid_y - hip_y)
    leaning = torso_h < 60  # shoulders close to hips vertically = bent over

    return both_wrists_low and leaning


# ─────────────────────────────────────────────────────────────────────────────
#  Lying-down person detector (wide bbox = person on ground)
# ─────────────────────────────────────────────────────────────────────────────

def _bbox_is_lying_down(box: np.ndarray) -> bool:
    """
    A person lying on the ground has a bounding box that is wider than tall.
    aspect_ratio = width / height > 1.4 strongly suggests prone position.
    """
    x1, y1, x2, y2 = box
    w = x2 - x1
    h = y2 - y1
    if h < 1:
        return False
    return (w / h) > 1.3


# ─────────────────────────────────────────────────────────────────────────────
#  PoseCrimeDetector
# ─────────────────────────────────────────────────────────────────────────────

class PoseCrimeDetector:
    def __init__(self, model_path: str = "yolov8n-pose.pt"):
        """
        Initialize the pose-based crime detector
        
        Args:
            model_path: Path to YOLO pose model
        """
        self.model = YOLO(model_path)
        self.frame_history: List[Set[str]] = []
        self.max_history = 5

    def analyze(self, image: np.ndarray) -> dict:
        """
        Analyze a single image for crime-related pose signals
        
        Args:
            image: RGB image as numpy array
            
        Returns:
            Dictionary with detection results
        """
        results = self.model(image, conf=0.4, iou=0.45, verbose=False)[0]
        if results.keypoints is None or len(results.keypoints) == 0:
            return self._empty_result()

        kps_all = results.keypoints.xy.cpu().numpy()
        conf_all = (results.keypoints.conf.cpu().numpy()
                    if results.keypoints.conf is not None else None)
        boxes = results.boxes.xyxy.cpu().numpy() if results.boxes is not None else None
        persons = len(kps_all)

        signals, activities, person_signals = [], [], []

        for idx, kps in enumerate(kps_all):
            kps_conf = conf_all[idx] if conf_all is not None else None
            p_sig, p_act = self._analyze_person(kps, kps_conf)
            person_signals.append(p_sig)
            signals.extend(p_sig)
            activities.extend(p_act)

        if persons >= 2:
            inter_sig, inter_act = self._analyze_interactions(
                kps_all, boxes, person_signals
            )
            signals.extend(inter_sig)
            activities.extend(inter_act)

        self._update_history(signals)
        signals.extend(self._temporal_analysis())

        threat_score = self._calculate_threat_score(signals, activities, persons)
        crime_type, threat_level = self._classify(signals, activities, persons)

        return {
            "persons_detected": persons,
            "signals": list(set(signals)),
            "activities": list(set(activities)),
            "threat_score": min(100, threat_score),
            "crime_detected": threat_score >= 35,
            "crime_type": crime_type,
            "threat_level": threat_level,
            "confidence": min(100, threat_score),
        }

    # ── per-person analysis ───────────────────────────────────────────────────
    def _analyze_person(self, k: np.ndarray, conf=None) -> Tuple[List[str], List[str]]:
        """
        Analyze a single person's pose for threatening signals
        
        Args:
            k: Keypoints array (17x2)
            conf: Confidence scores for keypoints
            
        Returns:
            Tuple of (signals, activities)
        """
        s, acts = [], []

        # FIX 1: Portrait / headshot guard — skip entirely
        if _is_portrait_or_headshot(k, conf):
            return s, acts

        # Keypoint quality gate
        min_conf, min_pts = 0.35, 7
        if conf is not None and int(np.sum(conf > min_conf)) < min_pts:
            return s, acts

        nose = k[0]
        ls, rs = k[5], k[6]
        le, re = k[7], k[8]
        lw, rw = k[9], k[10]
        lh, rh = k[11], k[12]
        lk, rk = k[13], k[14]
        la, ra = k[15], k[16]

        torso_h = abs(nose[1] - (lh[1] + rh[1]) / 2)
        sh_width = abs(ls[0] - rs[0])

        # FIX 1: Hard size minimums — portrait frames have tiny torso height
        if torso_h < 40 or sh_width < 20:
            return s, acts

        # FIX 2: Food-prep context — suppress knife/stabbing signals
        is_food_prep = _is_food_prep_context(k, conf)

        # Arms
        l_ext = self._is_arm_extended(ls, le, lw, torso_h)
        r_ext = self._is_arm_extended(rs, re, rw, torso_h)

        if l_ext and lw[1] < le[1] - torso_h * 0.08:
            s.append("PUNCH_LEFT")
            acts.append("AGGRESSIVE_GESTURE")
        if r_ext and rw[1] < re[1] - torso_h * 0.08:
            s.append("PUNCH_RIGHT")
            acts.append("AGGRESSIVE_GESTURE")

        if self._is_leg_raised(lh, lk, la, torso_h):
            s.append("KICK_LEFT")
            acts.append("KICKING_MOTION")
        if self._is_leg_raised(rh, rk, ra, torso_h):
            s.append("KICK_RIGHT")
            acts.append("KICKING_MOTION")

        if l_ext and abs(lw[0] - ls[0]) > sh_width * 1.4:
            s.append("WEAPON_THREAT_LEFT")
            acts.append("THREATENING_GESTURE")
        if r_ext and abs(rw[0] - rs[0]) > sh_width * 1.4:
            s.append("WEAPON_THREAT_RIGHT")
            acts.append("THREATENING_GESTURE")

        # Gun aiming: extended + horizontal
        for wrist, shoulder, sig in [(lw, ls, "GUN_AIMING_LEFT"), (rw, rs, "GUN_AIMING_RIGHT")]:
            dy = abs(wrist[1] - shoulder[1])
            dx = abs(wrist[0] - shoulder[0])
            if dx > torso_h * 0.55 and dy < torso_h * 0.38:
                s.append(sig)
                acts.append("SHOOTING_THREAT")

        # Gun holding
        for wrist, hip, sig in [(lw, lh, "GUN_HOLDING_LEFT"), (rw, rh, "GUN_HOLDING_RIGHT")]:
            if self._distance(wrist, hip) < torso_h * 0.55:
                s.append(sig)
                acts.append("ARMED_THREAT")

        # FIX 2: Knife / stabbing — skip in food-prep context
        if not is_food_prep:
            for wrist, shoulder, sig in [
                (lw, ls, "KNIFE_WIELDING_LEFT"),
                (rw, rs, "KNIFE_WIELDING_RIGHT")
            ]:
                if (shoulder[1] - torso_h * 0.6 < wrist[1] < shoulder[1] + torso_h * 0.3
                        and self._distance(shoulder, wrist) > torso_h * 0.45):
                    s.append(sig)
                    acts.append("STABBING_ATTACK")

            # FIX 2: Stabbing motion — only fire when person is standing
            # (not crouching/leaning over a surface)
            if not self._is_crouching(k):
                for wrist, elbow, sig in [
                    (lw, le, "STABBING_MOTION_LEFT"),
                    (rw, re, "STABBING_MOTION_RIGHT")
                ]:
                    if wrist[1] > elbow[1] + torso_h * 0.15:
                        s.append(sig)
                        acts.append("STABBING_ATTACK")

        # Neck grab
        neck_y = nose[1] + torso_h * 0.18
        if self._distance(lw, [nose[0], neck_y]) < torso_h * 0.32:
            s.append("GRAB_NECK_LEFT")
            acts.append("CHOKING_MOTION")
        if self._distance(rw, [nose[0], neck_y]) < torso_h * 0.32:
            s.append("GRAB_NECK_RIGHT")
            acts.append("CHOKING_MOTION")

        if self._distance(lw, ls) < torso_h * 0.25:
            s.append("SHOULDER_CONTROL")
            acts.append("PHYSICAL_CONTROL")
        if self._distance(rw, rs) < torso_h * 0.25:
            s.append("SHOULDER_CONTROL")
            acts.append("PHYSICAL_CONTROL")

        if self._distance(lw, re) < torso_h * 0.28:
            s.append("ARM_LOCK")
            acts.append("RESTRAINT_ATTEMPT")
        if self._distance(rw, le) < torso_h * 0.28:
            s.append("ARM_LOCK")
            acts.append("RESTRAINT_ATTEMPT")

        # Body state
        vert = self._calculate_body_verticality(k)
        if vert < 0.3:
            s.append("FALLEN")
            acts.append("PRONE_POSITION")
        elif vert < 0.45:
            s.append("VULNERABLE_POSITION")
            acts.append("DEFENSIVE_POSTURE")

        if self._is_running(k):
            acts.append("RUNNING")
        if self._is_crouching(k):
            acts.append("CROUCHING")

        if lw[1] < ls[1] - torso_h * 0.15 and rw[1] < rs[1] - torso_h * 0.15:
            acts.append("HANDS_UP")

        return s, acts

    # ── interactions ─────────────────────────────────────────────────────────
    def _analyze_interactions(self, kps_all: np.ndarray, boxes: np.ndarray, 
                              person_signals: List[List[str]]) -> Tuple[List[str], List[str]]:
        """
        Analyze interactions between multiple people
        
        Args:
            kps_all: All keypoints arrays
            boxes: Bounding boxes for all persons
            person_signals: Signals per person
            
        Returns:
            Tuple of (signals, activities)
        """
        s, acts = [], []
        n = len(kps_all)

        for i in range(n):
            for j in range(i + 1, n):
                hip_i = self._get_hip_center(kps_all[i])
                hip_j = self._get_hip_center(kps_all[j])
                dist = self._distance(hip_i, hip_j)
                diag = self._calculate_frame_diagonal(boxes[i], boxes[j])
                nd = dist / max(diag, 1.0)

                if nd < 0.30:
                    s.append("CLOSE_CONTACT")
                    acts.append("PHYSICAL_PROXIMITY")
                if nd < 0.15:
                    s.append("BODY_COLLISION")
                    acts.append("PHYSICAL_CONTACT")

                for wi in [9, 10]:
                    for hi_ in [0, 1, 2, 3, 4]:
                        if self._distance(kps_all[i][wi], kps_all[j][hi_]) < 35:
                            s.append("ASSAULT_HEAD")
                            acts.append("PHYSICAL_ASSAULT")
                            break

                if self._is_grabbing(kps_all[i], kps_all[j]):
                    s.append("GRABBING")
                    acts.append("RESTRAINING_MOTION")

                grab_count = sum(
                    1 for wi in [9, 10] for bi in [5, 6, 11, 12]
                    if self._distance(kps_all[i][wi], kps_all[j][bi]) < 35
                )
                if grab_count >= 2:
                    s.append("RESTRAINING_HOLD")
                    acts.append("RESTRAINT_ATTEMPT")

                if self._is_following(kps_all[i], kps_all[j], boxes[i], boxes[j]):
                    acts.append("FOLLOWING_CHASING")

                if n >= 3 and self._is_circle_formation([kps_all[i], kps_all[j]], kps_all):
                    acts.append("CROWD_FORMATION")

                vdiff = abs(hip_i[1] - hip_j[1])
                if vdiff > 28:
                    s.append("POWER_IMBALANCE")
                    acts.append("DOMINANT_POSITION")

                # Dominant over fallen
                if vdiff > 80:
                    hi_p = i if hip_i[1] < hip_j[1] else j
                    lo_p = j if hi_p == i else i
                    lo_s = person_signals[lo_p] if lo_p < len(person_signals) else []
                    if "FALLEN" in lo_s or "VULNERABLE_POSITION" in lo_s:
                        s.append("DOMINANT_OVER_FALLEN")
                        acts.append("PHYSICAL_ASSAULT")

                # FIX 3: Dominant over fallen using bbox aspect ratio
                # even if keypoint-based FALLEN didn't fire
                if boxes is not None and i < len(boxes) and j < len(boxes):
                    box_i_wide = _bbox_is_lying_down(boxes[i])
                    box_j_wide = _bbox_is_lying_down(boxes[j])
                    if box_i_wide and not box_j_wide and hip_j[1] < hip_i[1]:
                        s.append("DOMINANT_OVER_FALLEN")
                        acts.append("PHYSICAL_ASSAULT")
                    elif box_j_wide and not box_i_wide and hip_i[1] < hip_j[1]:
                        s.append("DOMINANT_OVER_FALLEN")
                        acts.append("PHYSICAL_ASSAULT")

                if ("CLOSE_CONTACT" in s and (
                        "AGGRESSIVE_GESTURE" in acts or "KICKING_MOTION" in acts
                        or "BODY_COLLISION" in s or "PHYSICAL_ASSAULT" in acts)):
                    s.append("DIRECT_ASSAULT")
                    acts.append("PHYSICAL_ASSAULT")

        return s, acts

    # ── helpers ───────────────────────────────────────────────────────────────
    def _is_arm_extended(self, sh: np.ndarray, el: np.ndarray, 
                         wr: np.ndarray, th: float) -> bool:
        ang = self._angle_between(sh, el, wr)
        return abs(ang - 180) < 35 and self._distance(sh, wr) > th * 0.65

    def _is_leg_raised(self, hip: np.ndarray, knee: np.ndarray, 
                       ankle: np.ndarray, th: float) -> bool:
        return (knee[1] < hip[1] - th * 0.08
                or ankle[1] < knee[1] - th * 0.08
                or 115 < self._angle_between(hip, knee, ankle) < 165)

    def _calculate_body_verticality(self, k: np.ndarray) -> float:
        sm = [(k[5][0] + k[6][0]) / 2, (k[5][1] + k[6][1]) / 2]
        hm = [(k[11][0] + k[12][0]) / 2, (k[11][1] + k[12][1]) / 2]
        vec = [hm[0] - sm[0], hm[1] - sm[1]]
        mag = math.sqrt(vec[0]**2 + vec[1]**2)
        return (vec[1] / mag + 1) / 2 if mag > 1e-6 else 0.5

    def _is_running(self, k: np.ndarray) -> bool:
        return ((self._angle_between(k[11], k[13], k[15]) < 125
                 or self._angle_between(k[12], k[14], k[16]) < 125)
                and abs(k[13][1] - k[14][1]) > 18)

    def _is_crouching(self, k: np.ndarray) -> bool:
        ha = (k[11][1] + k[12][1]) / 2
        return ((k[13][1] + k[14][1]) / 2 / max(ha, 1)) > 1.18

    def _get_hip_center(self, k: np.ndarray) -> List[float]:
        return [(k[11][0] + k[12][0]) / 2, (k[11][1] + k[12][1]) / 2]

    def _calculate_frame_diagonal(self, b1: np.ndarray, b2: np.ndarray) -> float:
        pts = np.vstack([b1, b2])
        mn = pts[:, :2].min(0)
        mx = pts[:, 2:].max(0)
        return math.sqrt((mx[0] - mn[0])**2 + (mx[1] - mn[1])**2) or 1.0

    def _is_grabbing(self, k1: np.ndarray, k2: np.ndarray) -> bool:
        return any(self._distance(k1[w], k2[b]) < 30
                   for w in [9, 10] for b in [5, 6, 11, 12])

    def _is_following(self, k1: np.ndarray, k2: np.ndarray, 
                      b1: np.ndarray, b2: np.ndarray) -> bool:
        d = self._get_facing_direction(k1)
        p1 = self._get_hip_center(k1)
        p2 = self._get_hip_center(k2)
        v = [p2[0] - p1[0], p2[1] - p1[1]]
        m = math.sqrt(v[0]**2 + v[1]**2)
        if m < 1e-6:
            return False
        v = [v[0] / m, v[1] / m]
        return d[0] * v[0] + d[1] * v[1] > 0.68

    def _get_facing_direction(self, k: np.ndarray) -> List[float]:
        sm = [(k[5][0] + k[6][0]) / 2, (k[5][1] + k[6][1]) / 2]
        v = [k[0][0] - sm[0], k[0][1] - sm[1]]
        m = math.sqrt(v[0]**2 + v[1]**2)
        return [v[0] / m, v[1] / m] if m > 1e-6 else [0, 1]

    def _is_circle_formation(self, ref: List[np.ndarray], all_k: np.ndarray) -> bool:
        if len(all_k) < 3:
            return False
        cs = [self._get_hip_center(k) for k in all_k]
        ac = np.mean(cs, axis=0)
        ds = [self._distance(c, ac) for c in cs]
        return (np.std(ds) / max(np.mean(ds), 1)) < 0.32

    def _update_history(self, signals: List[str]) -> None:
        self.frame_history.append(set(signals))
        if len(self.frame_history) > self.max_history:
            self.frame_history.pop(0)

    def _temporal_analysis(self) -> List[str]:
        if len(self.frame_history) < 2:
            return []
        return list(set.intersection(*self.frame_history))

    def _calculate_threat_score(self, signals: List[str], activities: List[str], 
                                persons: int) -> float:
        SW = {
            "GRAB_NECK_LEFT": 32, "GRAB_NECK_RIGHT": 32, "WEAPON_THREAT_LEFT": 25,
            "WEAPON_THREAT_RIGHT": 25, "GUN_AIMING_LEFT": 55, "GUN_AIMING_RIGHT": 55,
            "GUN_HOLDING_LEFT": 45, "GUN_HOLDING_RIGHT": 45, "KNIFE_WIELDING_LEFT": 42,
            "KNIFE_WIELDING_RIGHT": 42, "STABBING_MOTION_LEFT": 48, "STABBING_MOTION_RIGHT": 48,
            "ASSAULT_HEAD": 35, "DIRECT_ASSAULT": 40, "GRABBING": 25, "RESTRAINING_HOLD": 40,
            "PUNCH_LEFT": 20, "PUNCH_RIGHT": 20, "KICK_LEFT": 20, "KICK_RIGHT": 20,
            "FALLEN": 15, "CLOSE_CONTACT": 15, "BODY_COLLISION": 30, "POWER_IMBALANCE": 25,
            "VULNERABLE_POSITION": 30, "DOMINANT_OVER_FALLEN": 48, "SHOULDER_CONTROL": 28,
            "ARM_LOCK": 32,
        }
        AW = {
            "PHYSICAL_ASSAULT": 25, "CHOKING_MOTION": 30, "THREATENING_GESTURE": 20,
            "RESTRAINING_MOTION": 25, "AGGRESSIVE_GESTURE": 15, "KICKING_MOTION": 15,
            "FOLLOWING_CHASING": 20, "CROWD_FORMATION": 15, "DEFENSIVE_POSTURE": 25,
            "DOMINANT_POSITION": 25, "RESTRAINT_ATTEMPT": 35, "PHYSICAL_CONTROL": 28,
            "STABBING_ATTACK": 50, "ARMED_THREAT": 48, "SHOOTING_THREAT": 55, "PRONE_POSITION": 18,
        }
        score = sum(SW.get(s, 5) for s in set(signals))
        score += sum(AW.get(a, 5) for a in set(activities))
        
        if persons >= 3:
            score *= 1.4
        elif persons == 2:
            score *= 1.2
            
        if (len(self.frame_history) >= 2 and len(set.intersection(*self.frame_history)) > 0):
            score *= 1.2
            
        if len(set(signals)) == 1 and score < 50:
            score *= 0.8
            
        return min(100.0, score)

    def _classify(self, signals: List[str], activities: List[str], 
                  persons: int) -> Tuple[str, str]:
        s, a = set(signals), set(activities)
        
        if "DOMINANT_OVER_FALLEN" in s:
            return "Assault on Fallen Victim", "CRITICAL"
        if "DIRECT_ASSAULT" in s and "VULNERABLE_POSITION" in s:
            return "Physical Violence / Assault", "CRITICAL"
        if "GRAB_NECK_LEFT" in s or "GRAB_NECK_RIGHT" in s:
            return "Choking / Attempted Murder", "CRITICAL"
        if "GUN_AIMING_LEFT" in s or "GUN_AIMING_RIGHT" in s:
            return "Active Shooting Threat", "CRITICAL"
        if "RESTRAINING_HOLD" in s and persons >= 2:
            return "Restraint / Assault", "CRITICAL"
        if "FALLEN" in s and persons >= 2 and (
                any(x.startswith("PUNCH") for x in s)
                or any(x.startswith("KICK") for x in s)):
            return "Assault on Fallen Victim", "CRITICAL"
        if ("GUN_HOLDING_LEFT" in s or "GUN_HOLDING_RIGHT" in s) and persons >= 2:
            return "Armed Threat", "CRITICAL"
        if ("KNIFE_WIELDING_LEFT" in s or "KNIFE_WIELDING_RIGHT" in s
                or "STABBING_MOTION_LEFT" in s or "STABBING_MOTION_RIGHT" in s):
            return "Armed Assault / Stabbing", "CRITICAL"
        if "DIRECT_ASSAULT" in s:
            return "Physical Assault", "HIGH"
        if persons >= 3 and ("PHYSICAL_ASSAULT" in a or "CROWD_FORMATION" in a):
            return "Crowd Violence", "HIGH"
        if persons == 2 and (
                any(x.startswith("PUNCH") for x in s)
                or any(x.startswith("KICK") for x in s)):
            return "Fight / Physical Violence", "HIGH"
        if "ASSAULT_HEAD" in s:
            return "Physical Assault", "HIGH"
        if "CLOSE_CONTACT" in s and persons >= 2 and "RUNNING" in a:
            return "Robbery / Mugging", "HIGH"
        if "GRABBING" in s and "FOLLOWING_CHASING" in a:
            return "Robbery / Mugging", "HIGH"
        if "WEAPON_THREAT_LEFT" in s or "WEAPON_THREAT_RIGHT" in s:
            return "Threatening with Weapon", "HIGH"
        if "ARM_LOCK" in s and persons >= 2:
            return "Physical Restraint", "HIGH"
        if "THREATENING_GESTURE" in a and "CLOSE_CONTACT" in s:
            return "Threatening Behavior", "MEDIUM"
        if len(s) > 0 or len(a) > 0:
            return "Suspicious Activity", "LOW"
        return "Normal", "LOW"

    def _distance(self, a, b) -> float:
        return math.sqrt((a[0] - b[0])**2 + (a[1] - b[1])**2)

    def _angle_between(self, p1, p2, p3) -> float:
        a, b, c = np.array(p1), np.array(p2), np.array(p3)
        ba, bc = a - b, c - b
        d = np.linalg.norm(ba) * np.linalg.norm(bc)
        return float(np.degrees(np.arccos(np.clip(np.dot(ba, bc) / d, -1, 1)))) if d > 1e-6 else 180.0

    def _empty_result(self) -> dict:
        return {
            "persons_detected": 0,
            "signals": [],
            "activities": [],
            "threat_score": 0,
            "crime_detected": False,
            "crime_type": "Normal",
            "threat_level": "LOW",
            "confidence": 0,
        }


# ─────────────────────────────────────────────────────────────────────────────
#  Data class for validation results
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ValidationResult:
    crime_detected: bool
    crime_type: str
    threat_level: str
    threat_score: float
    confidence: float
    persons_detected: int
    signals: list
    activities: list
    weapons: list
    rejected_at_layer: Optional[str]
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    boxes: list = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
#  L1 — Ingest (B&W + contrast normalisation)
# ─────────────────────────────────────────────────────────────────────────────

MIN_RESOLUTION = 120
MAX_DIMENSION = 1280

def layer1_ingest(image: np.ndarray) -> Tuple[Optional[np.ndarray], Optional[str]]:
    """
    Preprocess image: resize, contrast normalization, color conversion
    
    Args:
        image: Input image as numpy array
        
    Returns:
        Tuple of (processed_image, error_message)
    """
    if image is None:
        return None, "L1: null image"
        
    h, w = image.shape[:2]
    if min(h, w) < MIN_RESOLUTION:
        return None, f"L1: {w}x{h} too small"

    if len(image.shape) == 2:
        image = cv2.equalizeHist(image)
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    elif image.shape[2] == 1:
        image = cv2.equalizeHist(image[:, :, 0])
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    else:
        ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
        ycrcb[:, :, 0] = cv2.equalizeHist(ycrcb[:, :, 0])
        image = cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)

    if max(h, w) > MAX_DIMENSION:
        sc = MAX_DIMENSION / max(h, w)
        image = cv2.resize(image, (int(w * sc), int(h * sc)), interpolation=cv2.INTER_AREA)

    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB), None


# ─────────────────────────────────────────────────────────────────────────────
#  L2 — Pose detection
# ─────────────────────────────────────────────────────────────────────────────

MIN_KP_CONF = 0.35
MIN_VALID_KP = 7

def _is_bird_eye(boxes: Optional[np.ndarray]) -> bool:
    """Detect bird's eye view based on bounding box aspect ratios"""
    if boxes is None or len(boxes) == 0:
        return False
    w = boxes[:, 2] - boxes[:, 0]
    h = boxes[:, 3] - boxes[:, 1]
    return float(np.mean(w / np.maximum(h, 1))) > 0.85

def layer2_pose(image: np.ndarray, model) -> Tuple[Optional[dict], Optional[str]]:
    """
    Run pose detection and filter low-quality detections
    
    Args:
        image: Preprocessed RGB image
        model: YOLO pose model
        
    Returns:
        Tuple of (pose_data, error_message)
    """
    try:
        res = model(image, conf=0.25, iou=0.45, verbose=False)[0]
    except Exception as e:
        return None, f"L2: {e}"

    if res.keypoints is None or res.keypoints.xy is None:
        return None, "L2: no keypoints"

    kps_all = res.keypoints.xy.cpu().numpy()
    conf_all = res.keypoints.conf.cpu().numpy() if res.keypoints.conf is not None else None
    boxes = res.boxes.xyxy.cpu().numpy() if res.boxes is not None else None

    if len(kps_all) == 0:
        return None, "L2: no persons"

    bird_eye = _is_bird_eye(boxes)
    min_kp = 5 if bird_eye else MIN_VALID_KP

    valid_idx = [
        i for i, kps in enumerate(kps_all)
        if (int(np.sum(conf_all[i] > MIN_KP_CONF)) if conf_all is not None
            else int(np.sum(~np.isnan(kps).any(axis=1)))) >= min_kp
    ]

    return {
        "kps_all": kps_all,
        "conf_all": conf_all,
        "boxes": boxes,
        "valid_idx": valid_idx,
        "raw_persons": len(kps_all),
        "persons": max(len(kps_all), len(boxes) if boxes is not None else 0),
        "bird_eye": bird_eye,
    }, None


# ─────────────────────────────────────────────────────────────────────────────
#  L3 — Weapon detection
# ─────────────────────────────────────────────────────────────────────────────

WEAPON_LABELS = {
    "knife", "gun", "sword", "rifle", "handgun", "pistol",
    "bat", "baseball_bat", "rod", "stick", "machete", "cleaver", "bottle", "weapon",
}

def layer3_weapons(image: np.ndarray, weapon_model, has_aggression: bool = False) -> List[str]:
    """
    Detect weapons in the image
    
    Args:
        image: Input image
        weapon_model: YOLO object detection model
        has_aggression: Whether aggressive activity was detected (lowers threshold)
        
    Returns:
        List of detected weapon labels
    """
    if weapon_model is None:
        return []
        
    try:
        thresh = 0.22 if has_aggression else 0.30
        res = weapon_model(image, conf=thresh, verbose=False)[0]
        found = []
        
        if res.boxes is not None and hasattr(res.boxes, "cls"):
            for cls_idx, conf in zip(res.boxes.cls, res.boxes.conf):
                label = res.names[int(cls_idx)].lower()
                if float(conf) >= thresh and any(w in label for w in WEAPON_LABELS):
                    found.append(label)
                    
        return found
        
    except Exception as e:
        print(f"[L3] {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
#  L4 — Signal extraction
# ─────────────────────────────────────────────────────────────────────────────

MULTI_PERSON_ONLY_SIGNALS = {
    "STABBING_MOTION_LEFT", "STABBING_MOTION_RIGHT",
    "KNIFE_WIELDING_LEFT", "KNIFE_WIELDING_RIGHT",
    "WEAPON_THREAT_LEFT", "WEAPON_THREAT_RIGHT",
}

MULTI_PERSON_ONLY_ACTIVITIES = {
    "STABBING_ATTACK", "WEAPON_THREAT", "ARMED_THREAT", "SHOOTING_THREAT",
}

def layer4_extract_signals(pose_data: dict, detector: PoseCrimeDetector) -> Tuple[List[str], List[str]]:
    """
    Extract crime signals from pose data
    
    Args:
        pose_data: Output from layer2_pose
        detector: PoseCrimeDetector instance
        
    Returns:
        Tuple of (signals, activities)
    """
    kps_all = pose_data["kps_all"]
    conf_all = pose_data["conf_all"]
    boxes = pose_data["boxes"]
    vi = pose_data["valid_idx"]

    signals, activities, person_signals = [], [], []

    vk = kps_all[vi] if len(vi) else kps_all
    vc = conf_all[vi] if (conf_all is not None and len(vi)) else conf_all

    for i, kps in enumerate(vk):
        ps, pa = detector._analyze_person(kps, vc[i] if vc is not None else None)
        person_signals.append(ps)
        signals.extend(ps)
        activities.extend(pa)

    if len(vi) >= 2 and boxes is not None:
        vb = boxes[vi]
        is_, ia = detector._analyze_interactions(vk, vb, person_signals)
        signals.extend(is_)
        activities.extend(ia)

    # FIX 3: Check bbox aspect ratios for lying-down detection even with 1 person
    if boxes is not None and len(boxes) >= 1:
        lying_count = sum(1 for b in boxes if _bbox_is_lying_down(b))
        standing_count = len(boxes) - lying_count
        if lying_count >= 1 and standing_count >= 1:
            if "DOMINANT_OVER_FALLEN" not in signals:
                signals.append("DOMINANT_OVER_FALLEN")
                activities.append("PHYSICAL_ASSAULT")

    return signals, activities


# ─────────────────────────────────────────────────────────────────────────────
#  L5 — Contextual filter
# ─────────────────────────────────────────────────────────────────────────────

SAFE_LOCATIONS = {
    "kitchen", "restaurant", "home", "market", "fish_market",
    "supermarket", "cafeteria", "butcher", "shop", "food_stall",
}

def layer5_contextual_filter(signals: List[str], activities: List[str], persons: int, 
                            weapons: List[str], location: str = "") -> Tuple[List[str], List[str]]:
    """
    Apply contextual filtering based on location and context
    
    Args:
        signals: Detected signals
        activities: Detected activities
        persons: Number of persons detected
        weapons: Detected weapons
        location: Location string
        
    Returns:
        Tuple of (filtered_signals, filtered_activities)
    """
    ss = set(signals)
    aa = set(activities)

    if persons < 2:
        ss -= MULTI_PERSON_ONLY_SIGNALS
        aa -= MULTI_PERSON_ONLY_ACTIVITIES

    if weapons:
        for s in MULTI_PERSON_ONLY_SIGNALS:
            if s in set(signals):
                ss.add(s)
        for a in MULTI_PERSON_ONLY_ACTIVITIES:
            if a in set(activities):
                aa.add(a)

    # FIX 2: Safe location — hard suppression of knife/stab signals
    loc = (location or "").lower().replace(" ", "_")
    aggression_present = any(a in aa for a in [
        "AGGRESSIVE_GESTURE", "KICKING_MOTION", "PHYSICAL_ASSAULT",
        "CHOKING_MOTION", "SHOOTING_THREAT", "RESTRAINT_ATTEMPT",
    ])
    
    if loc in SAFE_LOCATIONS and not aggression_present:
        # Remove ALL knife/stabbing signals regardless of person count
        knife_signals = {
            "WEAPON_THREAT_LEFT", "WEAPON_THREAT_RIGHT",
            "KNIFE_WIELDING_LEFT", "KNIFE_WIELDING_RIGHT",
            "STABBING_MOTION_LEFT", "STABBING_MOTION_RIGHT",
        }
        knife_activities = {"STABBING_ATTACK", "WEAPON_THREAT", "THREATENING_GESTURE"}
        ss -= knife_signals
        aa -= knife_activities
        
        # Also remove ARMED_THREAT if it was only triggered by knife signals
        if not (ss & {"GUN_AIMING_LEFT", "GUN_AIMING_RIGHT",
                      "GUN_HOLDING_LEFT", "GUN_HOLDING_RIGHT"}):
            aa -= {"ARMED_THREAT", "SHOOTING_THREAT"}

    return list(ss), list(aa)


# ─────────────────────────────────────────────────────────────────────────────
#  L6 — Temporal consistency
# ─────────────────────────────────────────────────────────────────────────────

TEMPORAL_WINDOW = 10
TEMPORAL_LOOKBACK = 3
TEMPORAL_MIN_HITS = 2

class TemporalValidator:
    """Maintains temporal consistency across frames"""
    
    def __init__(self):
        self._history: deque = deque(maxlen=TEMPORAL_WINDOW)

    def update(self, signals: List[str]) -> None:
        """Update history with new frame signals"""
        self._history.append(frozenset(signals))

    def sustained_signals(self) -> List[str]:
        """Get signals that persist across recent frames"""
        if not self._history:
            return []
            
        # Single frame → return all signals (image upload mode)
        if len(self._history) == 1:
            return list(self._history[0])
            
        if len(self._history) < TEMPORAL_LOOKBACK:
            return list(self._history[-1])
            
        recent = list(self._history)[-TEMPORAL_LOOKBACK:]
        counts: defaultdict = defaultdict(int)
        for frame in recent:
            for sig in frame:
                counts[sig] += 1
        return [s for s, n in counts.items() if n >= TEMPORAL_MIN_HITS]

    def reset(self) -> None:
        """Reset temporal history"""
        self._history.clear()


# ─────────────────────────────────────────────────────────────────────────────
#  L7 — Threat scoring
# ─────────────────────────────────────────────────────────────────────────────

SIGNAL_WEIGHTS = {
    "GRAB_NECK_LEFT": 32, "GRAB_NECK_RIGHT": 32, "ASSAULT_HEAD": 38, "DIRECT_ASSAULT": 45,
    "BODY_COLLISION": 32, "CLOSE_CONTACT": 18, "PUNCH_LEFT": 22, "PUNCH_RIGHT": 22,
    "KICK_LEFT": 22, "KICK_RIGHT": 22, "FALLEN": 18, "GRABBING": 28, "POWER_IMBALANCE": 28,
    "VULNERABLE_POSITION": 32, "RESTRAINING_HOLD": 42, "DOMINANT_OVER_FALLEN": 52,
    "SHOULDER_CONTROL": 30, "ARM_LOCK": 35, "WEAPON_THREAT_LEFT": 28, "WEAPON_THREAT_RIGHT": 28,
    "GUN_HOLDING_LEFT": 50, "GUN_HOLDING_RIGHT": 50, "GUN_AIMING_LEFT": 60, "GUN_AIMING_RIGHT": 60,
    "KNIFE_WIELDING_LEFT": 45, "KNIFE_WIELDING_RIGHT": 45,
    "STABBING_MOTION_LEFT": 52, "STABBING_MOTION_RIGHT": 52,
}

ACTIVITY_WEIGHTS = {
    "PHYSICAL_ASSAULT": 28, "CHOKING_MOTION": 32, "THREATENING_GESTURE": 22,
    "RESTRAINING_MOTION": 28, "AGGRESSIVE_GESTURE": 18, "KICKING_MOTION": 18,
    "FOLLOWING_CHASING": 22, "CROWD_FORMATION": 18, "DEFENSIVE_POSTURE": 28,
    "DOMINANT_POSITION": 28, "RESTRAINT_ATTEMPT": 38, "PHYSICAL_CONTROL": 30,
    "STABBING_ATTACK": 55, "ARMED_THREAT": 52, "SHOOTING_THREAT": 60,
    "WEAPON_THREAT": 48, "ROBBERY_INDICATOR": 30, "PRONE_POSITION": 20,
}

WEAPON_BONUS = 35
MAX_WEAPON_BONUS = 50

def layer7_score(signals: List[str], activities: List[str], persons: int, 
                weapons: List[str], temporal_validator: TemporalValidator) -> float:
    """
    Calculate threat score based on all signals and context
    
    Args:
        signals: Detected signals
        activities: Detected activities
        persons: Number of persons
        weapons: Detected weapons
        temporal_validator: Temporal consistency validator
        
    Returns:
        Threat score (0-100)
    """
    ss = set(signals)
    aa = set(activities)
    
    score = sum(SIGNAL_WEIGHTS.get(s, 6) for s in ss)
    score += sum(ACTIVITY_WEIGHTS.get(a, 6) for a in aa)

    if persons >= 3:
        score *= 1.45
    elif persons == 2:
        score *= 1.25

    if weapons:
        score += min(len(set(weapons)) * WEAPON_BONUS, MAX_WEAPON_BONUS)

    hist = temporal_validator._history
    if len(hist) >= 2:
        recent = list(hist)[-min(len(hist), TEMPORAL_LOOKBACK):]
        sustained = set.intersection(*[set(f) for f in recent]) if recent else set()
        if sustained:
            score *= 1.25

    if len(ss) == 1 and score < 50:
        score *= 0.82

    # Additional bonuses for specific dangerous signals
    if ss & {"WEAPON_THREAT_LEFT", "WEAPON_THREAT_RIGHT"} and "CLOSE_CONTACT" in ss and persons >= 2:
        score += 18
    if ss & {"GUN_AIMING_LEFT", "GUN_AIMING_RIGHT"}:
        score += 22
    if ss & {"KNIFE_WIELDING_LEFT", "KNIFE_WIELDING_RIGHT",
              "STABBING_MOTION_LEFT", "STABBING_MOTION_RIGHT"}:
        score += 18
    if "DIRECT_ASSAULT" in ss:
        score += 22
    if "DOMINANT_OVER_FALLEN" in ss:
        score += 28
    if "GRAB_NECK_LEFT" in ss or "GRAB_NECK_RIGHT" in ss:
        score += 28

    # Single person with weapon but no aggression
    if persons == 1 and not weapons:
        if ss & {"GUN_HOLDING_LEFT", "GUN_HOLDING_RIGHT", "WEAPON_THREAT_LEFT", "WEAPON_THREAT_RIGHT"}:
            score = max(score, 32)

    return min(100.0, max(0.0, score))


# ─────────────────────────────────────────────────────────────────────────────
#  L8 — Classification gate
# ─────────────────────────────────────────────────────────────────────────────

ALERT_MIN_SCORE = 30.0

def layer8_gate(threat_score: float, crime_type: str, threat_level: str, 
                weapons: List[str], persons: int, signals: List[str] = None) -> Tuple[bool, str, str]:
    """
    Final classification gate with hard overrides
    
    Args:
        threat_score: Calculated threat score
        crime_type: Suggested crime type
        threat_level: Suggested threat level
        weapons: Detected weapons
        persons: Number of persons
        signals: Detected signals
        
    Returns:
        Tuple of (crime_detected, crime_type, threat_level)
    """
    signals = signals or []
    ss = set(signals)

    if threat_score >= 80:
        fl = "CRITICAL"
    elif threat_score >= 55:
        fl = "HIGH"
    elif threat_score >= 30:
        fl = "MEDIUM"
    else:
        fl = "LOW"

    # Hard CRITICAL overrides
    if "GUN_AIMING_LEFT" in ss or "GUN_AIMING_RIGHT" in ss:
        return True, "Active Shooting Threat", "CRITICAL"

    if weapons and persons >= 2:
        wt = ", ".join(sorted(set(weapons))).title()
        return True, f"Armed Threat — {wt} Detected", "CRITICAL"

    if "DOMINANT_OVER_FALLEN" in ss:
        return True, "Assault on Fallen Victim", "CRITICAL"
    if "GRAB_NECK_LEFT" in ss or "GRAB_NECK_RIGHT" in ss:
        return True, "Choking / Attempted Murder", "CRITICAL"
    if "RESTRAINING_HOLD" in ss and "VULNERABLE_POSITION" in ss:
        return True, "Physical Restraint", "CRITICAL"
    if "FALLEN" in ss and "GRABBING" in ss and "POWER_IMBALANCE" in ss:
        return True, "Physical Assault", "CRITICAL"
    if "FALLEN" in ss and "DOMINANT_POSITION" in set(signals):
        return True, "Assault on Fallen Victim", "CRITICAL"

    if threat_score >= ALERT_MIN_SCORE and fl in {"HIGH", "CRITICAL"}:
        return True, crime_type, fl

    if threat_score >= ALERT_MIN_SCORE:
        return False, "Suspicious Activity", fl

    return False, "Normal (Filtered)", fl


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def normalize_confidence(raw: float) -> float:
    """Normalize confidence score to 0-1 range"""
    try:
        v = float(raw) / 100.0 if float(raw) > 1.0 else float(raw)
        v = max(0.0, min(1.0, v))
        if v < 0.1:
            return round(v * 1.4, 3)
        if v > 0.85:
            return round(min(1.0, v * 0.95), 3)
        return round(v, 3)
    except Exception:
        return 0.0


# ─────────────────────────────────────────────────────────────────────────────
#  MultiLayerValidator
# ─────────────────────────────────────────────────────────────────────────────

class MultiLayerValidator:
    """Complete multi-layer validation pipeline"""
    
    def __init__(self, pose_model, weapon_model, detector: PoseCrimeDetector):
        self.pose_model = pose_model
        self.weapon_model = weapon_model
        self.detector = detector
        self.temporal = TemporalValidator()

    def validate(self, image: np.ndarray, location: str = "") -> ValidationResult:
        """
        Run complete validation pipeline on a single image
        
        Args:
            image: Input image as numpy array
            location: Location context (e.g., "kitchen", "street")
            
        Returns:
            ValidationResult with complete analysis
        """
        image, err = layer1_ingest(image)
        if err:
            return self._reject(err)

        pose_data, err = layer2_pose(image, self.pose_model)
        weapons = layer3_weapons(image, self.weapon_model, has_aggression=False)

        if err:
            return self._reject(err, weapons=weapons)

        persons = pose_data["persons"]
        signals, activities = layer4_extract_signals(pose_data, self.detector)

        has_agg = any(a in activities for a in [
            "AGGRESSIVE_GESTURE", "KICKING_MOTION", "PHYSICAL_ASSAULT",
            "CHOKING_MOTION", "STABBING_ATTACK", "SHOOTING_THREAT",
        ])
        
        if has_agg and not weapons:
            weapons = layer3_weapons(image, self.weapon_model, has_aggression=True)

        signals, activities = layer5_contextual_filter(
            signals, activities, persons, weapons, location
        )

        self.temporal.update(signals)
        signals = self.temporal.sustained_signals()

        threat_score = layer7_score(signals, activities, persons, weapons, self.temporal)
        crime_type, _ = self.detector._classify(signals, activities, persons)

        crime_detected, final_type, final_level = layer8_gate(
            threat_score, crime_type, "", weapons, persons, signals
        )

        return ValidationResult(
            crime_detected=crime_detected,
            crime_type=final_type,
            threat_level=final_level,
            threat_score=round(threat_score, 1),
            confidence=normalize_confidence(threat_score),
            persons_detected=persons,
            signals=list(set(signals)),
            activities=list(set(activities)),
            weapons=list(set(weapons)),
            rejected_at_layer=None,
            boxes=pose_data["boxes"].tolist() if pose_data.get("boxes") is not None else [],
        )

    def _reject(self, reason: str, weapons: List[str] = None) -> ValidationResult:
        """Create rejection result"""
        return ValidationResult(
            crime_detected=False,
            crime_type="Filtered",
            threat_level="LOW",
            threat_score=0.0,
            confidence=0.0,
            persons_detected=0,
            signals=[],
            activities=[],
            weapons=weapons or [],
            rejected_at_layer=reason,
            boxes=[],
        )

    def reset_temporal(self) -> None:
        """Reset temporal history"""
        self.temporal.reset()