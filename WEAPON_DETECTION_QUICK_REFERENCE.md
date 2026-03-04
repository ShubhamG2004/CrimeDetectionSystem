# Quick Reference: Weapon Detection & Crime Classification

## 🔴 CRITICAL ALERTS (Immediate Response)

### Gun-Based Crimes

#### 1️⃣ SHOOTING / ARMED MURDER ATTEMPT [HIGHEST PRIORITY]
```
🔴 CRITICAL THREAT
├─ Primary Signal: GUN_AIMING_LEFT/RIGHT
├─ Activity: SHOOTING_THREAT
├─ Threat Score: 80-100
├─ Confidence: 95%+
├─ Response: EMERGENCY DISPATCH
└─ Key Indicator: Arm raised with bent elbow, supporting hand close
```

#### 2️⃣ ARMED ASSAULT / GUN THREAT
```
🔴 CRITICAL THREAT
├─ Primary Signal: GUN_HOLDING_LEFT/RIGHT + PUNCH/KICK
├─ Activity: ARMED_THREAT + AGGRESSIVE_GESTURE
├─ Threat Score: 70-90
├─ Confidence: 93%+
├─ Response: PRIORITY DISPATCH
└─ Key Indicator: Arm extended horizontally + aggression
```

#### 3️⃣ ARMED THREAT / GUN THREAT
```
🟠 HIGH THREAT
├─ Primary Signal: GUN_HOLDING_LEFT/RIGHT (no assault)
├─ Activity: ARMED_THREAT
├─ Threat Score: 50-70
├─ Confidence: 87%+
├─ Response: ALERT + MONITORING
└─ Key Indicator: Horizontal arm extension, no attack behavior
```

#### 4️⃣ SHOOTOUT / ARMED CONFLICT
```
🔴 CRITICAL THREAT
├─ Persons: 2+
├─ Signals: GUN_HOLDING + ASSAULT_SIGNALS
├─ Activity: ARMED_THREAT + PHYSICAL_ASSAULT
├─ Threat Score: 85-100
├─ Confidence: 91%+
├─ Response: EMERGENCY + EVACUATION
└─ Key Indicator: Multiple persons with guns + physical contact
```

#### 5️⃣ ARMED ROBBERY / ARMED THEFT
```
🔴 CRITICAL THREAT
├─ Persons: 2
├─ Signals: GUN_HOLDING + GRABBING + CLOSE_CONTACT
├─ Activity: ARMED_THREAT + RESTRAINING_MOTION
├─ Threat Score: 75-95
├─ Confidence: 90%+
├─ Response: PRIORITY DISPATCH
└─ Key Indicator: Weapon + grabbing motion
```

---

### Knife-Based Crimes

#### 6️⃣ STABBING ATTACK / ARMED ASSAULT [HIGHEST PRIORITY]
```
🔴 CRITICAL THREAT
├─ Primary Signal: STABBING_MOTION_LEFT/RIGHT
├─ Activity: STABBING_ATTACK
├─ Threat Score: 85-100
├─ Confidence: 94%+
├─ Response: EMERGENCY DISPATCH
└─ Key Indicator: Downward thrusting motion with extended forearm
```

#### 7️⃣ KNIFE THREAT / ARMED THREAT
```
🟠 HIGH THREAT
├─ Primary Signal: KNIFE_WIELDING_LEFT/RIGHT (no assault)
├─ Activity: WEAPON_THREAT
├─ Threat Score: 55-75
├─ Confidence: 86%+
├─ Response: ALERT + MONITORING
└─ Key Indicator: Aggressive arm flexing, no immediate attack
```

#### 8️⃣ ARMED CARJACKING / VEHICLE HIJACKING
```
🔴 CRITICAL THREAT
├─ Persons: 2
├─ Signals: KNIFE_WIELDING + GRABBING
├─ Activity: WEAPON_THREAT + RESTRAINING_MOTION
├─ Threat Score: 80-95
├─ Confidence: 89%+
├─ Response: PRIORITY DISPATCH
└─ Key Indicator: Vehicle context + weapon + grabbing
```

---

## 🟠 HIGH ALERTS (Quick Response)

### Other Weapon Crimes

#### 9️⃣ ASSAULT WITH WEAPON / VICTIM ABUSE
```
🔴 CRITICAL THREAT
├─ Signals: GUN/KNIFE + VULNERABLE_POSITION
├─ Activity: ARMED_THREAT + DOMINANT_POSITION
├─ Threat Score: 75-95
├─ Confidence: 88%+
├─ Response: IMMEDIATE DISPATCH
└─ Key Indicator: Weapon + victim down/helpless
```

#### 🔟 WEAPON THREAT / ARMED INTIMIDATION
```
🟠 HIGH THREAT
├─ Signals: Any weapon visible
├─ Activity: ARMED_THREAT (no assault)
├─ Threat Score: 50-70
├─ Confidence: 85%+
├─ Response: MONITORING + ALERT
└─ Key Indicator: Weapon display without immediate action
```

---

## 📊 Signal Reference Chart

### Gun Holding Postures

| Signal | Position | Angle | Confidence | Threat |
|--------|----------|-------|-----------|--------|
| `GUN_HOLDING_LEFT` | Arm horizontal (left) | 140-220° | 90%+ | CRITICAL |
| `GUN_HOLDING_RIGHT` | Arm horizontal (right) | 140-220° | 90%+ | CRITICAL |
| `GUN_AIMING_LEFT` | Arm raised, bent elbow (left) | ~90° | 95%+ | CRITICAL |
| `GUN_AIMING_RIGHT` | Arm raised, bent elbow (right) | ~90° | 95%+ | CRITICAL |

### Knife Wielding Postures

| Signal | Motion | Angle | Confidence | Threat |
|--------|--------|-------|-----------|--------|
| `KNIFE_WIELDING_LEFT` | Aggressive flex (left) | 100-170° | 88%+ | CRITICAL |
| `KNIFE_WIELDING_RIGHT` | Aggressive flex (right) | 100-170° | 88%+ | CRITICAL |
| `STABBING_MOTION_LEFT` | Downward thrust (left) | 70-150° | 94%+ | CRITICAL |
| `STABBING_MOTION_RIGHT` | Downward thrust (right) | 70-150° | 94%+ | CRITICAL |

---

## 🎯 Crime Type Decision Tree

```
START: Weapon Detected?
│
├─ YES, Gun?
│  ├─ Aiming? → "Shooting / Armed Murder" [CRITICAL]
│  ├─ Holding + Assault? → "Armed Assault / Gun Threat" [CRITICAL]
│  ├─ Holding + Robbery? → "Armed Robbery" [CRITICAL]
│  └─ Holding (no action)? → "Armed Threat / Gun Threat" [HIGH]
│
├─ YES, Knife?
│  ├─ Stabbing? → "Stabbing Attack / Armed Assault" [CRITICAL]
│  ├─ Wielding + Assault? → "Armed Assault / Weapon Attack" [CRITICAL]
│  ├─ Wielding + Robbery? → "Armed Robbery / Armed Theft" [CRITICAL]
│  └─ Wielding (no action)? → "Knife Threat / Armed Threat" [HIGH]
│
└─ NO Weapon?
   ├─ Assault signals? → See violence crime chart
   ├─ Robbery signals? → See robbery crime chart
   └─ No signals? → "Normal" [LOW]
```

---

## 🔍 Accuracy & Confidence Guide

### Weapon Detection Confidence Levels

```
Confidence Range    | Interpretation | Action
────────────────────┼────────────────┼──────────────────
95-100%            | Certain        | IMMEDIATE DISPATCH
90-95%             | Very High      | PRIORITY DISPATCH
85-90%             | High           | ALERT + VERIFY
80-85%             | Good           | MONITOR
<80%               | Low            | REVIEW MANUALLY
```

### False Positive Prevention

#### Avoid False Positives For:
- Person reaching high (raising luggage, waving) → NOT `GUN_AIMING`
- Person pushing/shoving → NOT `STABBING_MOTION`
- Person scratching neck → NOT `CHOKING`
- Arms crossed → NOT weapon threat

✅ System validates:
- Exact angle ranges (±tolerance)
- Keypoint confidence >0.5
- Multi-frame consistency (70% over 5 frames)
- Supporting hand positioning
- Arm extension ratios

---

## 📈 Threat Score Calculation

### Quick Scoring Guide

```
Base Safety Score: 0 points

Add points for each signal/activity detected:
├─ Weapon signals:        40-50 points
├─ Assault signals:       20-40 points
├─ Robbery signals:       15-35 points
├─ Weapon boost:          +15 points (automatic)
└─ Multi-person boost:    +10-20 points

Multipliers:
├─ 2 persons:             ×1.2
├─ 3+ persons:            ×1.4
└─ Sustained threat:      ×1.2

Final Score (0-100):
├─ 0-25:   LOW
├─ 26-50:  MEDIUM
├─ 51-75:  HIGH
└─ 76-100: CRITICAL ⚠️
```

---

## 🚨 Alert Priority Levels

### LEVEL 1: IMMEDIATE (90 seconds response)
- Shooting / Armed Murder Attempt
- Stabbing Attack
- Armed Assault (any weapon + assault)
- Assault with Weapon

### LEVEL 2: PRIORITY (5 minutes response)
- Armed Robbery
- Armed Carjacking
- Shootout / Armed Conflict
- Gang Violence

### LEVEL 3: ALERT (15 minutes response)
- Armed Threat (no action)
- Knife Threat (no action)
- Weapon Threat / Intimidation
- Suspicious Activity

---

## 💡 Operator Quick Tips

### ✅ DO:
- Respond immediately to weapon signals
- Verify signal confidence levels
- Check multiple signals for confirmation
- Look for supporting evidence in camera feeds
- Maintain officer safety protocols

### ❌ DON'T:
- Ignore signals below 85% confidence (high risk)
- Respond to MEDIUM threat level alerts alone
- Trust single signal without context
- Assume all arm extensions are weapons
- Approach armed threats without backup

---

## 📞 Signal Troubleshooting

### Issue: False `GUN_HOLDING` Detection
**Possible Causes:**
- Person reaching up/waving arm
- Horizontal arm at shoulder level
- Similar angle to gun pose

**Solution:**
- Check confidence level
- Verify no assault/robbery signals
- Look for supporting hand position
- Review video for context

### Issue: False `STABBING_MOTION` Detection
**Possible Causes:**
- Person throwing object
- Pushing/shoving motion
- Rapid arm movement

**Solution:**
- Confirm downward thrust direction
- Check for actual contact/proximity
- Verify elbow bend position
- Multi-frame consistency check

---

## 🔄 Reporting & Documentation

### Incident Report Template

```
WEAPON DETECTION INCIDENT REPORT
═════════════════════════════════════════

Detection Details:
├─ Crime Type: [Selected]
├─ Primary Signal: [Signal List]
├─ Secondary Signals: [Additional Signals]
├─ Threat Score: [0-100]
├─ Confidence: [%]
├─ Date/Time: [Timestamp]
└─ Location: [Address]

Response Details:
├─ Alert Level: [1/2/3]
├─ Action Taken: [Dispatch/Monitor/Verify]
├─ Officer Response Time: [Minutes]
├─ Outcome: [Confirmed/False Positive]
└─ Officer Notes: [Comments]

Evidence:
├─ Video Clip: [Link]
├─ Screenshots: [Count]
└─ Additional Notes: [Details]
```

---

## 📚 Reference Tables

### All New Weapon Signals

| Category | Signal | Detection Method | Confidence |
|----------|--------|------------------|-----------|
| **Gun** | GUN_HOLDING_LEFT | Horizontal arm extension | 90%+ |
| | GUN_HOLDING_RIGHT | Horizontal arm extension | 90%+ |
| | GUN_AIMING_LEFT | Raised arm + bent elbow | 95%+ |
| | GUN_AIMING_RIGHT | Raised arm + bent elbow | 95%+ |
| **Knife** | KNIFE_WIELDING_LEFT | Aggressive arm flex | 88%+ |
| | KNIFE_WIELDING_RIGHT | Aggressive arm flex | 88%+ |
| | STABBING_MOTION_LEFT | Downward thrust | 94%+ |
| | STABBING_MOTION_RIGHT | Downward thrust | 94%+ |

### All New Weapon Activities

| Activity | Trigger | Threat Level |
|----------|---------|--------------|
| SHOOTING_THREAT | Gun aiming + proximity | CRITICAL |
| STABBING_ATTACK | Stabbing motion + contact | CRITICAL |
| ARMED_THREAT | Weapon visible + action | CRITICAL |
| WEAPON_THREAT | Weapon visible, no action | HIGH |

---

## ✅ Quality Checklist

Before taking action on weapon alerts:

- [ ] Confidence level > 85%
- [ ] Signal type is correct (gun vs knife)
- [ ] Multiple signals align with crime type
- [ ] Threat score > 60
- [ ] Video visual confirmation available
- [ ] Not matching known false positive pattern
- [ ] Context supports the detection
- [ ] Officer safety considerations noted

---

**Last Updated**: March 4, 2024
**Version**: 2.0
**System Status**: ✅ OPERATIONAL

