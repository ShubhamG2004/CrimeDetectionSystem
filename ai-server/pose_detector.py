from ultralytics import YOLO
import numpy as np
import math

class PoseCrimeDetector:
    def __init__(self):
        self.model = YOLO("yolov8n-pose.pt")

    def analyze(self, image):
        results = self.model(image, conf=0.4, verbose=False)[0]

        if results.keypoints is None:
            return self._empty_result()

        kps_all = results.keypoints.xy.cpu().numpy()
        boxes = results.boxes.xyxy.cpu().numpy()

        persons = len(kps_all)
        threat_score = 0
        signals = []

        for kps in kps_all:
            signals += self._analyze_person(kps)

        # ---- INTER-PERSON ANALYSIS ----
        if persons >= 2:
            signals += self._analyze_interactions(kps_all, boxes)

        # ---- SCORING ----
        threat_score = min(100, len(signals) * 15)

        crime_type, threat_level = self._classify(signals, persons)
        crime_detected = threat_score >= 45

        return {
            "persons_detected": persons,
            "signals": list(set(signals)),
            "threat_score": threat_score,
            "crime_detected": crime_detected,
            "crime_type": crime_type,
            "threat_level": threat_level,
            "confidence": threat_score
        }

    # -------------------------------------------------
    # PERSON-LEVEL ANALYSIS
    # -------------------------------------------------
    def _analyze_person(self, k):
        s = []

        nose = k[0]
        lw, rw = k[9], k[10]
        le, re = k[7], k[8]
        ls, rs = k[5], k[6]
        lh, rh = k[11], k[12]
        lk, rk = k[13], k[14]
        la, ra = k[15], k[16]

        # Punch
        if lw[1] < ls[1] or rw[1] < rs[1]:
            s.append("PUNCH")

        # Kick
        if lk[1] < lh[1] or rk[1] < rh[1]:
            s.append("KICK")

        # Weapon threat (long straight arm)
        if abs(lw[0] - ls[0]) > 90 or abs(rw[0] - rs[0]) > 90:
            s.append("WEAPON_THREAT")

        # Choking / grabbing neck
        if abs(lw[1] - nose[1]) < 25 or abs(rw[1] - nose[1]) < 25:
            s.append("GRAB_NECK")

        # Fallen person
        torso = abs(nose[1] - lh[1])
        leg = abs(lh[1] - lk[1])
        if leg < torso * 0.45:
            s.append("FALLEN")

        return s

    # -------------------------------------------------
    # INTERACTION ANALYSIS
    # -------------------------------------------------
    def _analyze_interactions(self, kps_all, boxes):
        s = []
        n = len(kps_all)

        for i in range(n):
            for j in range(i + 1, n):
                d = self._distance(
                    kps_all[i][11], kps_all[j][11]
                )

                if d < 140:
                    s.append("CLOSE_CONTACT")

                # Wrist to head (assault)
                if self._distance(kps_all[i][9], kps_all[j][0]) < 35:
                    s.append("ASSAULT")

                # Forced movement (kidnapping)
                if abs(kps_all[i][9][0] - kps_all[j][9][0]) < 20:
                    s.append("FORCED_MOVEMENT")

        return s

    # -------------------------------------------------
    # FINAL CLASSIFICATION
    # -------------------------------------------------
    def _classify(self, signals, persons):
        s = set(signals)

        if "GRAB_NECK" in s:
            return "Choking / Attempted Murder", "HIGH"

        if "WEAPON_THREAT" in s and "CLOSE_CONTACT" in s:
            return "Assault with Weapon", "HIGH"

        if "FORCED_MOVEMENT" in s:
            return "Kidnapping / Abduction", "HIGH"

        if "FALLEN" in s and persons >= 2:
            return "Assault on Fallen Victim", "HIGH"

        if persons >= 3 and ("PUNCH" in s or "KICK" in s):
            return "Crowd Violence / Riot", "HIGH"

        if "PUNCH" in s or "KICK" in s:
            return "Fight / Physical Violence", "HIGH"

        if "CLOSE_CONTACT" in s and persons == 2:
            return "Robbery / Mugging", "MEDIUM"

        return "Normal", "LOW"

    # -------------------------------------------------
    def _distance(self, a, b):
        return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)

    def _empty_result(self):
        return {
            "persons_detected": 0,
            "signals": [],
            "threat_score": 0,
            "crime_detected": False,
            "crime_type": "Normal",
            "threat_level": "LOW",
            "confidence": 0
        }
