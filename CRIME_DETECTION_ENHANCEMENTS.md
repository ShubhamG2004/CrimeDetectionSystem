# Crime Detection System - Major Enhancements

## Overview
The pose detection system has been significantly enhanced with improved accuracy and support for **20+ crime types**, including **12+ women-specific crimes** as requested.

---

## Women-Related Crimes Added (12+)

### 1. **Sexual Assault / Molestation**
- **Signals**: Lower body contact + physical proximity
- **Detection**: Wrist proximity to lower torso area
- **Threat Level**: CRITICAL

### 2. **Attempted Rape / Sexual Assault**
- **Signals**: Lower body contact + restraining hold (2 persons)
- **Detection**: Physical contact to sensitive areas + restraint patterns
- **Threat Level**: CRITICAL

### 3. **Rape / Sexual Violence**
- **Signals**: Sexual assault signal + restraint attempt + arm lock
- **Detection**: Extended physical restraint with upper body involvement
- **Threat Level**: CRITICAL

### 4. **Eve Teasing / Street Harassment**
- **Signals**: Rear contact + harassment signal
- **Detection**: Approach from behind + inappropriate contact
- **Threat Level**: HIGH

### 5. **Stalking / Harassment**
- **Signals**: Rear approach + following/chasing
- **Detection**: Consistent rear positioning + movement following target
- **Threat Level**: HIGH

### 6. **Domestic Violence**
- **Signals**: Assault signal + restraining hold + dominant position
- **Detection**: 2-person scenario with physical aggression + control
- **Threat Level**: CRITICAL

### 7. **Forced Confinement / Kidnapping**
- **Signals**: Confinement signal + restraining hold + surrounding pattern
- **Detection**: Multi-person restraint scenario
- **Threat Level**: CRITICAL

### 8. **Human Trafficking / Abduction**
- **Signals**: Group harassment + restraining hold (3+ persons)
- **Detection**: Coordinated multi-person restraint
- **Threat Level**: CRITICAL

### 9. **Dowry Violence / Domestic Abuse**
- **Signals**: Dominant position + assault signal + physical contact (2 persons)
- **Detection**: 2-person domestic scenario with clear aggressor
- **Threat Level**: HIGH

### 10. **Honor Crime / Mob Violence**
- **Signals**: Group harassment + assault signal (3+ persons)
- **Detection**: Coordinated group violence pattern
- **Threat Level**: CRITICAL

### 11. **Indecent Assault / Groping**
- **Signals**: Chest contact or hair grab without full restraint
- **Detection**: Inappropriate touching of upper body
- **Threat Level**: HIGH

### 12. **Physical Control / Restraint**
- **Signals**: Shoulder control from behind + arm lock
- **Detection**: Hands on shoulders + restricted arm movement
- **Threat Level**: HIGH

---

## Key Accuracy Improvements

### 1. **New Body-Specific Detection Signals**
```python
# Chest/breast contact detection
CHEST_CONTACT: Monitors wrist proximity to chest area
LOWER_BODY_CONTACT: Detects inappropriate lower body contact
HAIR_GRAB: Identifies hair pulling incidents
ARM_LOCK: Detects restricted arm movements
REAR_APPROACH: Identifies approaching from behind
REAR_CONTACT: Close contact from behind
```

### 2. **Enhanced Gesture Recognition**
- **Defensive Shielding**: Person protects face/body (victim indicator)
- **Shoulder Control**: Hands on shoulders from behind (control pattern)
- **Restraining Arm Lock**: Restricted arm movement (restraint indicator)
- **Surrounding Pattern**: Detection of mob formation around target

### 3. **Improved Threat Scoring System**

#### Signal Weights (Updated):
```
SEXUAL_ASSAULT-related: 40-45 points
RESTRAINING_HOLD: 38 points
MOLESTATION_SIGNAL: 38 points
CHEST_CONTACT: 35 points
GROUP_HARASSMENT: 32 points
ARM_LOCK: 32 points
REAR_CONTACT: 32 points
SHOULDER_CONTROL: 30 points
GRAB_NECK: 30 points
```

#### Activity Weights (Updated):
```
SEXUAL_ASSAULT_SIGNAL: 45 points
CONFINEMENT_SIGNAL: 40 points
MOLESTATION_SIGNAL: 38 points
RESTRAINT_ATTEMPT: 35 points
GROUP_HARASSMENT: 32 points
PHYSICAL_CONTROL: 30 points
STALKING_SIGNAL: 30 points
PHYSICAL_ASSAULT: 25 points
CHOKING_MOTION: 30 points
HARASSMENT_SIGNAL: 28 points
```

### 4. **Multi-Person Analysis Enhancements**

#### New Helper Methods:
1. **`_is_rear_approach()`** - Detects approaching from behind
2. **`_is_close_rear_contact()`** - Detects rear contact harassment
3. **`_is_restraining_hold()`** - Identifies restraint positioning
4. **`_is_shoulder_control()`** - Detects shoulder control patterns
5. **`_is_surrounding_pattern()`** - Identifies mob formation (3+ persons)

### 5. **Confidence Enhancement**
- Lower confidence thresholds for more sensitive detection: 0.3 instead of 0.5
- Expanded arm extension detection (lower thresholds for movement)
- More tolerant leg raising detection for kicking motions
- Increased wrist-to-body proximity radius for better contact detection

---

## Complete Crime Type List (20+ Supported)

### Women-Related Crimes (12):
1. Sexual Assault / Molestation
2. Attempted Rape / Sexual Assault
3. Rape / Sexual Violence
4. Eve Teasing / Street Harassment
5. Stalking / Harassment
6. Domestic Violence
7. Forced Confinement / Kidnapping
8. Human Trafficking / Abduction
9. Dowry Violence / Domestic Abuse
10. Honor Crime / Mob Violence
11. Indecent Assault / Groping
12. Physical Control / Restraint

### General Violence Crimes (8+):
1. Physical Assault
2. Woman Assault / Physical Violence
3. Fight / Physical Violence
4. Assault with Weapon
5. Choking / Attempted Murder
6. Assault on Fallen Victim
7. Kidnapping / Abduction
8. Robbery / Mugging
9. Crowd Violence / Riot
10. Threatening Behavior
11. Suspicious Activity

---

## Technical Improvements

### 1. **Detection Accuracy Enhancements**
- Body proportions normalized using torso height
- Reduced keypoint confidence requirement (0.3 from 0.5)
- Expanded proximity detection radius
- More tolerant angle calculations (±45° range)

### 2. **Interaction Scoring**
- Multi-person multiplier: 3+ persons = 1.5x, 2 persons = 1.3x
- Sustained signal detection with frame history (5 frames)
- Temporal analysis for repeated patterns

### 3. **Threat Level Classification**
- **CRITICAL**: Most dangerous women-related crimes
- **HIGH**: Serious but less immediate crimes
- **MEDIUM**: Moderate threat level
- **LOW**: Suspicious activity requiring further investigation

---

## How the System Works

### Detection Pipeline:
1. **Single-Person Analysis**
   - Detect aggressive gestures (punch, kick, weapon threat)
   - Identify women-specific signals (chest/lower body contact, hair grab)
   - Detect vulnerable positions (fallen, crouching)

2. **Multi-Person Interaction Analysis**
   - Distance-based proximity detection
   - Rear approach identification
   - Restraint pattern detection
   - Group formation analysis

3. **Temporal Analysis**
   - Track signals across frames
   - Detect sustained patterns
   - Calculate confidence scores

4. **Threat Scoring**
   - Weight individual signals
   - Weight detected activities
   - Apply multipliers for group size
   - Apply multipliers for sustained patterns

5. **Crime Classification**
   - Match signal combinations to crime types
   - Prioritize women-related crimes
   - Assign threat levels

---

## Configuration Parameters

### Keypoint Confidence Threshold
- **Default**: 0.3 (low for broader detection)
- **Location**: Line 73 in `_analyze_person()`

### Distance Thresholds
- **Chest contact**: torso_height × 0.35
- **Lower body contact**: torso_height × 0.35
- **Hair grab**: torso_height × 0.25
- **Neck contact**: torso_height × 0.4
- **Arm lock**: 50 pixels
- **Shoulder control**: 40 pixels

### Threat Score Thresholds
- **Crime Detected**: Score ≥ 40
- **Maximum Score**: 100 (normalized)

---

## Testing Recommendations

### Test Scenarios for Women-Crimes:
1. **Rear approach** - Person walking up behind another
2. **Chest contact** - Unwanted touching of upper body
3. **Lower body contact** - Inappropriate lower body touching
4. **Hair grabbing** - Grabbing and pulling hair
5. **Restraint patterns** - Arms locked/controlled
6. **Group harassment** - 3+ people surrounding 1 person
7. **Domestic violence** - Aggressive 2-person scenarios
8. **Stalking** - Following/chasing behavior

---

## Files Modified
- `ai-server/pose_detector.py` - Complete enhancement with new detection methods

## Performance Considerations
- Increased detection sensitivity may result in more false positives initially
- Monitor confidence scores and adjust thresholds as needed
- Consider using medium YOLOv8m-pose model for better accuracy with trade-off in speed
- Frame history is limited to 5 frames for real-time responsiveness

---

## Future Enhancements
1. Weapon detection integration (knife, gun, etc.)
2. Facial expression analysis for fear/distress
3. Voice-based threat detection
4. Integration with law enforcement databases
5. Machine learning-based false positive filtering
6. Regional crime pattern analysis

---

## Version
**Crime Detection System v2.0** - Women-Safety Focused Enhancement Pack
