"""Context-aware, rule-based reasoning layer for crime detection.

This module adds human-like reasoning on top of AI detections by combining:
- detected activities and pose signals
- detected weapons
- people count
- location context
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, Tuple


SAFE_CONTEXTS = {
    "market",
    "kitchen",
    "restaurant",
    "shop",
    "supermarket",
}

FIREARM_KEYWORDS = {
    "gun",
    "pistol",
    "handgun",
    "revolver",
    "rifle",
    "shotgun",
    "firearm",
}

KNIFE_KEYWORDS = {
    "knife",
    "kitchen_knife",
    "chef_knife",
    "butcher_knife",
    "cleaver",
    "machete",
}

AGGRESSIVE_ACTIVITIES = {
    "SHOOTING_THREAT",
    "KICKING_MOTION",
    "PHYSICAL_ASSAULT",
    "FOLLOWING_CHASING",
    "STABBING_ATTACK",
    "ARMED_THREAT",
    "CHOKING_MOTION",
    "RESTRAINING_MOTION",
    "RESTRAINT_ATTEMPT",
}

CRITICAL_ASSAULT_SIGNALS = {
    "DIRECT_ASSAULT",
    "ASSAULT_HEAD",
    "BODY_COLLISION",
    "GRAB_NECK_LEFT",
    "GRAB_NECK_RIGHT",
    "RESTRAINING_HOLD",
    "DOMINANT_OVER_FALLEN",
}

SUSPICIOUS_SINGLE_PERSON_ACTIVITIES = {
    "CROUCHING",
    "RUNNING",
    "HANDS_UP",
    "DEFENSIVE_POSTURE",
}

SUSPICIOUS_SINGLE_PERSON_SIGNALS = {
    "GUN_HOLDING_LEFT",
    "GUN_HOLDING_RIGHT",
    "WEAPON_THREAT_LEFT",
    "WEAPON_THREAT_RIGHT",
}

GROUP_SCENE_NOISE_SIGNALS = {
    "CLOSE_CONTACT",
    "BODY_COLLISION",
    "ASSAULT_HEAD",
    "GRABBING",
    "RESTRAINING_HOLD",
    "POWER_IMBALANCE",
    "VULNERABLE_POSITION",
}

GROUP_SCENE_NOISE_ACTIVITIES = {
    "PHYSICAL_PROXIMITY",
    "PHYSICAL_CONTACT",
    "PHYSICAL_CONTROL",
    "RESTRAINING_MOTION",
    "RESTRAINT_ATTEMPT",
    "FOLLOWING_CHASING",
    "KICKING_MOTION",
    "PHYSICAL_ASSAULT",
    "CHOKING_MOTION",
    "STABBING_ATTACK",
    "ARMED_THREAT",
    "SHOOTING_THREAT",
}

GROUP_SCENE_HARD_SIGNALS = {
    "FALLEN",
    "DOMINANT_OVER_FALLEN",
    "GUN_AIMING_LEFT",
    "GUN_AIMING_RIGHT",
    "GRAB_NECK_LEFT",
    "GRAB_NECK_RIGHT",
    "DIRECT_ASSAULT",
}


def _normalize_text(value: Any) -> str:
    """Normalize arbitrary values to lowercase snake-like text for matching."""
    text = str(value or "").strip().lower()
    return text.replace("-", "_").replace(" ", "_")


def _normalize_list(values: Iterable[Any]) -> set[str]:
    """Normalize list-like inputs to a unique lowercase set."""
    return {_normalize_text(v) for v in (values or []) if _normalize_text(v)}


def _extract_weapon_labels(weapons: Iterable[Any]) -> list[str]:
    """Extract weapon labels from strings or dict weapon objects."""
    labels: list[str] = []
    for weapon in weapons or []:
        if isinstance(weapon, dict):
            label = weapon.get("name") or weapon.get("label") or weapon.get("type") or ""
            if label:
                labels.append(_normalize_text(label))
        else:
            labels.append(_normalize_text(weapon))
    return [label for label in labels if label]


def _contains_keyword(labels: Iterable[str], keywords: set[str]) -> bool:
    """Return True if any keyword appears in any normalized label."""
    for label in labels:
        if any(keyword in label for keyword in keywords):
            return True
    return False


def reasoning_layer(detection: Dict[str, Any], location: str) -> Tuple[bool, str]:
    """Apply context-aware rules and return (crime_detected, crime_type)."""
    detection = detection or {}

    activities = {item.upper() for item in _normalize_list(detection.get("activities", []))}
    signals = {item.upper() for item in _normalize_list(detection.get("signals", []))}
    persons_detected = int(detection.get("persons_detected", 0) or 0)

    weapons_raw = detection.get("weapons", []) or detection.get("weapons_detected", []) or []
    weapon_labels = _extract_weapon_labels(weapons_raw)
    has_any_weapon = len(weapon_labels) > 0
    has_knife = _contains_keyword(weapon_labels, KNIFE_KEYWORDS)
    has_firearm = _contains_keyword(weapon_labels, FIREARM_KEYWORDS)

    location_context = _normalize_text(location)
    is_safe_context = location_context in SAFE_CONTEXTS
    has_critical_assault_signal = bool(signals & CRITICAL_ASSAULT_SIGNALS)
    raw_score = float(detection.get("threat_score", 0) or 0)

    # Group-scene hard evidence used by top-priority suppression rules.
    strong_crime_signals = {
        "DOMINANT_OVER_FALLEN",
        "DIRECT_ASSAULT",
        "GRAB_NECK_LEFT",
        "GRAB_NECK_RIGHT",
        "GUN_AIMING_LEFT",
        "GUN_AIMING_RIGHT",
    }

    # Rule 0a (Highest Priority): Group-scene suppression.
    # Dense social scenes often generate contact/positioning noise. If no hard
    # assault/gun-aim evidence exists (and no weapon is detected), classify as normal.
    if persons_detected >= 5:
        if not (signals & strong_crime_signals) and not has_any_weapon:
            return False, "Normal Group Activity"

    # Rule 0b: Minimum evidence guard for multi-person scenes.
    # Avoid escalating weak proximity-only cues when hard evidence is absent.
    if persons_detected >= 3:
        if not (signals & strong_crime_signals) and not has_any_weapon:
            return False, "Normal Activity"

    # Rule 1 (Highest Priority): Dominant-over-fallen pose is a direct assault cue.
    if "DOMINANT_OVER_FALLEN" in signals:
        return True, "Physical Assault (Victim on Ground)"

    # Rule 2: Any fallen-person signal should be escalated as a likely assault.
    if "FALLEN" in signals:
        return True, "Possible Assault (Person Down)"

    # Rule 3: Fallback for overlap/missed-person cases where only one person is
    # detected but posture and motion clearly indicate violence on a downed victim.
    if (
        persons_detected == 1
        and ("FALLEN" in signals or "PRONE_POSITION" in activities)
        and ("PHYSICAL_ASSAULT" in activities or "KICKING_MOTION" in activities)
    ):
        return True, "Physical Violence"

    # Rule 4: Gun aiming signals are always criminal regardless of context.
    if "GUN_AIMING_LEFT" in signals or "GUN_AIMING_RIGHT" in signals:
        return True, "Armed Threat"

    # Rule 5: Explicit shooting intent is always criminal.
    if "SHOOTING_THREAT" in activities:
        return True, "Armed Threat"

    # Rule 6: Firearm detection should never be downgraded to safe.
    if has_firearm:
        return True, "Armed Threat"

    # Rule 7: Physical assault is always crime.
    if "PHYSICAL_ASSAULT" in activities:
        return True, "Physical Violence"

    # Rule 8: Kicking-like motion alone is noisy in manual-work scenes.
    # Escalate only when corroborated by interaction signals, multiple persons,
    # or weapon evidence.
    if "KICKING_MOTION" in activities:
        if has_critical_assault_signal or persons_detected >= 2 or has_any_weapon:
            return True, "Physical Violence"

    # Rule 9: Multi-person kicking/assault indicates physical violence.
    if persons_detected >= 2 and (
        "KICKING_MOTION" in activities or "PHYSICAL_ASSAULT" in activities
    ):
        return True, "Physical Violence"

    # Rule 10: Multi-person chasing/following is suspicious only when paired
    # with other aggressive context.
    if (
        persons_detected >= 2
        and "FOLLOWING_CHASING" in activities
        and (has_critical_assault_signal or "KICKING_MOTION" in activities or has_any_weapon)
    ):
        return True, "Suspicious Activity"

    # Rule 11: Knife/tool usage in safe places is normal if no aggression is present.
    if is_safe_context and has_knife and not (activities & AGGRESSIVE_ACTIVITIES):
        return False, "Normal Activity - Tool Usage"

    # Rule 12: Low-evidence manual motion fallback (prevents fish/cooking false
    # positives when only weak limb-motion cues exist and no weapon is detected).
    if (
        not has_any_weapon
        and not has_firearm
        and not has_critical_assault_signal
        and "KICKING_MOTION" in activities
        and signals.issubset({"KICK_LEFT", "KICK_RIGHT"})
    ):
        return False, "Normal Activity - Tool Usage"

    # Rule 13: Multi-person moderate-risk fallback.
    # If the model produced some cues and a non-trivial score in a non-safe
    # context, treat as suspicious rather than fully normal.
    if (
        persons_detected >= 2
        and not is_safe_context
        and raw_score >= 12
        and (len(signals) > 0 or len(activities) > 0)
    ):
        return True, "Suspicious Activity"

    # Rule 14a: Dense posed group fallback.
    # Group photos and tight crowd shots often create overlap-driven false
    # positives. If there are many people but only crowd-noise cues, treat the
    # frame as normal unless there is hard assault evidence.
    if persons_detected >= 5:
        if not has_critical_assault_signal and not has_any_weapon:
            if signals.issubset(GROUP_SCENE_NOISE_SIGNALS) and activities.issubset(GROUP_SCENE_NOISE_ACTIVITIES):
                return False, "Normal Activity"

    # Rule 14: Single-person stealth-like postures/signals in non-safe contexts
    # are treated as suspicious instead of being marked fully safe.
    has_suspicious_single_person_activity = bool(
        activities & SUSPICIOUS_SINGLE_PERSON_ACTIVITIES
    )
    has_suspicious_single_person_signal = bool(
        signals & SUSPICIOUS_SINGLE_PERSON_SIGNALS
    )
    if (
        persons_detected == 1
        and not is_safe_context
        and (
            has_suspicious_single_person_signal
            or (has_suspicious_single_person_activity and raw_score >= 5)
        )
    ):
        return True, "Suspicious Activity"

    # Rule 15: Generic weapon logic based on person count.
    if has_any_weapon and persons_detected >= 2:
        return True, "Armed Threat"
    if has_any_weapon and persons_detected == 1:
        return False, "Potential Risk"

    # Rule 16: Default safe state when no crime pattern is matched.
    return False, "Normal Activity"
