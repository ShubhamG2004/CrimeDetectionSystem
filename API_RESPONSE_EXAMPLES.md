# API Response Examples - Weapon Detection

## 📡 AI Server Response Format

### Standard Response Structure
```json
{
  "success": true,
  "type": "Crime type string",
  "confidence": 0.95,
  "threat_level": "CRITICAL/HIGH/MEDIUM/LOW",
  "persons_detected": 2,
  "signals": ["Signal1", "Signal2", "..."],
  "activities": ["Activity1", "Activity2", "..."],
  "threat_score": 95,
  "crime_detected": 1,
  "location": "Camera location",
  "timestamp": "2024-03-04T14:30:00Z",
  "analysis_timestamp": "2024-03-04T14:30:00.150Z",
  "response_time_ms": 175
}
```

---

## 🔴 CRITICAL: Weapon Detection Examples

### Example 1: SHOOTING / ARMED MURDER ATTEMPT (Gun Aiming)
```json
{
  "success": true,
  "type": "Shooting / Armed Murder Attempt",
  "confidence": 0.96,
  "threat_level": "CRITICAL",
  "persons_detected": 2,
  "signals": [
    "GUN_AIMING_RIGHT",
    "CLOSE_CONTACT",
    "ASSAULT_HEAD"
  ],
  "activities": [
    "SHOOTING_THREAT",
    "PHYSICAL_ASSAULT",
    "PHYSICAL_PROXIMITY"
  ],
  "threat_score": 99,
  "crime_detected": 1,
  "location": "Main Street, Downtown",
  "camera_id": "CAM_001",
  "timestamp": "2024-03-04T14:30:25Z",
  "analysis_timestamp": "2024-03-04T14:30:25.145Z",
  "response_time_ms": 168,
  "raw_confidence": 0.96,
  "system_status": "operational"
}
```

**Backend Processing:**
```javascript
// src/routes/detect.routes.js
const response = await axios.post('http://localhost:8000/detect-image', formData, {
  headers: formData.getHeaders(),
  timeout: 30000
});

// Emit Socket.IO event with weapon alert
io.emit('crime-detected', {
  type: response.data.type,  // "Shooting / Armed Murder Attempt"
  threatLevel: response.data.threat_level,  // "CRITICAL"
  signals: response.data.signals,
  location: location,
  timestamp: new Date(),
  alertLevel: 1  // IMMEDIATE
});

// Save to Firestore with weapon indicators
await db.collection('incidents').add({
  crimeType: response.data.type,
  weaponType: 'gun',  // NEW
  weaponSignals: response.data.signals.filter(s => s.includes('GUN')),
  threatScore: response.data.threat_score,
  confidence: response.data.confidence,
  // ... other fields
});
```

---

### Example 2: STABBING ATTACK / ARMED ASSAULT (Knife)
```json
{
  "success": true,
  "type": "Stabbing Attack / Armed Assault",
  "confidence": 0.94,
  "threat_level": "CRITICAL",
  "persons_detected": 2,
  "signals": [
    "STABBING_MOTION_LEFT",
    "BODY_CONTACT",
    "CLOSE_CONTACT",
    "DIRECT_ASSAULT"
  ],
  "activities": [
    "STABBING_ATTACK",
    "PHYSICAL_ASSAULT",
    "PHYSICAL_CONTACT"
  ],
  "threat_score": 98,
  "crime_detected": 1,
  "location": "Park Avenue, Zone-B",
  "camera_id": "CAM_005",
  "timestamp": "2024-03-04T14:35:10Z",
  "analysis_timestamp": "2024-03-04T14:35:10.162Z",
  "response_time_ms": 172,
  "raw_confidence": 0.94,
  "system_status": "operational"
}
```

---

### Example 3: ARMED ROBBERY / ARMED THEFT
```json
{
  "success": true,
  "type": "Armed Robbery / Armed Theft",
  "confidence": 0.90,
  "threat_level": "CRITICAL",
  "persons_detected": 2,
  "signals": [
    "GUN_HOLDING_LEFT",
    "GRABBING",
    "CLOSE_CONTACT",
    "BODY_COLLISION"
  ],
  "activities": [
    "ARMED_THREAT",
    "RESTRAINING_MOTION",
    "PHYSICAL_PROXIMITY"
  ],
  "threat_score": 92,
  "crime_detected": 1,
  "location": "Shopping Mall, Entry-A",
  "camera_id": "CAM_012",
  "timestamp": "2024-03-04T14:40:45Z",
  "analysis_timestamp": "2024-03-04T14:40:45.155Z",
  "response_time_ms": 175,
  "raw_confidence": 0.90,
  "system_status": "operational"
}
```

---

### Example 4: ARMED THREAT / GUN THREAT (No Assault)
```json
{
  "success": true,
  "type": "Armed Threat / Gun Threat",
  "confidence": 0.87,
  "threat_level": "HIGH",
  "persons_detected": 1,
  "signals": [
    "GUN_HOLDING_RIGHT"
  ],
  "activities": [
    "ARMED_THREAT"
  ],
  "threat_score": 65,
  "crime_detected": 1,
  "location": "Commercial District, Block-C",
  "camera_id": "CAM_008",
  "timestamp": "2024-03-04T14:45:30Z",
  "analysis_timestamp": "2024-03-04T14:45:30.148Z",
  "response_time_ms": 170,
  "raw_confidence": 0.87,
  "system_status": "operational"
}
```

---

### Example 5: ASSAULT WITH WEAPON / VICTIM ABUSE
```json
{
  "success": true,
  "type": "Assault with Weapon / Victim Abuse",
  "confidence": 0.88,
  "threat_level": "CRITICAL",
  "persons_detected": 2,
  "signals": [
    "KNIFE_WIELDING_RIGHT",
    "VULNERABLE_POSITION",
    "POWER_IMBALANCE",
    "CLOSE_CONTACT"
  ],
  "activities": [
    "ARMED_THREAT",
    "DOMINANT_POSITION",
    "PHYSICAL_ASSAULT"
  ],
  "threat_score": 89,
  "crime_detected": 1,
  "location": "Residential Area, Street-D",
  "camera_id": "CAM_015",
  "timestamp": "2024-03-04T14:50:15Z",
  "analysis_timestamp": "2024-03-04T14:50:15.158Z",
  "response_time_ms": 171,
  "raw_confidence": 0.88,
  "system_status": "operational"
}
```

---

## 🟠 HIGH ALERT Examples

### Example 6: KNIFE THREAT / ARMED THREAT (No Action)
```json
{
  "success": true,
  "type": "Knife Threat / Armed Threat",
  "confidence": 0.86,
  "threat_level": "HIGH",
  "persons_detected": 1,
  "signals": [
    "KNIFE_WIELDING_LEFT"
  ],
  "activities": [
    "WEAPON_THREAT"
  ],
  "threat_score": 62,
  "crime_detected": 1,
  "location": "Downtown Street",
  "camera_id": "CAM_003",
  "timestamp": "2024-03-04T15:00:00Z",
  "analysis_timestamp": "2024-03-04T15:00:00.151Z",
  "response_time_ms": 169,
  "raw_confidence": 0.86,
  "system_status": "operational"
}
```

---

### Example 7: SHOOTOUT / ARMED CONFLICT
```json
{
  "success": true,
  "type": "Shootout / Armed Conflict",
  "confidence": 0.91,
  "threat_level": "CRITICAL",
  "persons_detected": 3,
  "signals": [
    "GUN_HOLDING_LEFT",
    "GUN_HOLDING_RIGHT",
    "ASSAULT_HEAD",
    "BODY_COLLISION",
    "SURROUNDING_PATTERN"
  ],
  "activities": [
    "ARMED_THREAT",
    "PHYSICAL_ASSAULT",
    "GROUP_HARASSMENT"
  ],
  "threat_score": 95,
  "crime_detected": 1,
  "location": "Industrial Area, Zone-A",
  "camera_id": "CAM_020",
  "timestamp": "2024-03-04T15:05:30Z",
  "analysis_timestamp": "2024-03-04T15:05:30.162Z",
  "response_time_ms": 176,
  "raw_confidence": 0.91,
  "system_status": "operational"
}
```

---

## 🟢 NON-CRIME Examples (Negatives/False Positive Prevention)

### Example 8: Normal Activity (High Arm Raise - NOT Gun Aiming)
```json
{
  "success": true,
  "type": "Normal",
  "confidence": 0.02,
  "threat_level": "LOW",
  "persons_detected": 1,
  "signals": [],
  "activities": [
    "HANDS_UP"
  ],
  "threat_score": 0,
  "crime_detected": 0,
  "location": "Street Corner",
  "camera_id": "CAM_002",
  "timestamp": "2024-03-04T15:10:00Z",
  "analysis_timestamp": "2024-03-04T15:10:00.145Z",
  "response_time_ms": 165,
  "raw_confidence": 0.02,
  "system_status": "operational"
}
```

**Why Not Flagged as Gun Aiming:**
- No `GUN_AIMING` signal detected
- No supporting hand positioning
- Regular arm raise pattern
- Confidence too low for threat

---

### Example 9: Person Reaching/Waving (NOT Weapon Threat)
```json
{
  "success": true,
  "type": "Suspicious Activity",
  "confidence": 0.15,
  "threat_level": "LOW",
  "persons_detected": 1,
  "signals": [],
  "activities": [
    "FOLLOWING_CHASING"
  ],
  "threat_score": 5,
  "crime_detected": 0,
  "location": "Shopping Street",
  "camera_id": "CAM_007",
  "timestamp": "2024-03-04T15:15:45Z",
  "analysis_timestamp": "2024-03-04T15:15:45.150Z",
  "response_time_ms": 168,
  "raw_confidence": 0.15,
  "system_status": "operational"
}
```

---

## 📊 Response Processing in Backend

### detect.routes.js Implementation
```javascript
async (req, res) => {
  try {
    // 1. Send to AI Server
    const formData = new FormData();
    formData.append('image', req.file.buffer, req.file.originalname);
    formData.append('location', req.body.location);
    formData.append('camera_id', req.body.camera_id);

    const response = await axios.post('http://localhost:8000/detect-image', formData, {
      headers: formData.getHeaders(),
      timeout: 30000
    });

    // 2. NEW: Check for weapons
    const hasWeapon = response.data.signals?.some(s => 
      ['GUN_HOLDING', 'GUN_AIMING', 'KNIFE_WIELDING', 'STABBING_MOTION'].some(w => s.includes(w))
    );

    const weaponType = response.data.signals?.some(s => s.includes('GUN')) ? 'gun' :
                       response.data.signals?.some(s => s.includes('KNIFE')) ? 'knife' : null;

    // 3. Determine alert priority
    const alertLevel = response.data.threat_level === 'CRITICAL' ? 1 :
                       response.data.threat_level === 'HIGH' ? 2 : 3;

    // 4. Emit Socket.IO event
    io.emit('crime-detected', {
      ...response.data,
      weaponType,  // NEW
      hasWeapon,   // NEW
      alertLevel,
      incidentId: generateId(),
      timestamp: new Date()
    });

    // 5. Save to Firestore
    await db.collection('incidents').add({
      crimeType: response.data.type,
      weaponType: weaponType,  // NEW
      weaponSignals: response.data.signals?.filter(s => 
        ['GUN', 'KNIFE', 'STABBING'].some(w => s.includes(w))
      ),  // NEW
      threatScore: response.data.threat_score,
      confidence: response.data.confidence,
      location: {
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        address: req.body.location
      },
      cameras: [req.body.camera_id],
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active',
      createdBy: req.user?.uid || 'system'
    });

    // 6. Send response
    res.json({
      success: true,
      ...response.data,
      weaponType,  // NEW
      hasWeapon,   // NEW
      alertLevel   // NEW
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

---

## 🎨 Frontend Dashboard Display

### Signal Display in React
```jsx
// components/IncidentCard.js
export default function IncidentCard({ incident }) {
  const weaponSignals = incident.signals?.filter(s => 
    ['GUN_HOLDING', 'GUN_AIMING', 'KNIFE_WIELDING', 'STABBING_MOTION'].some(w => s.includes(w))
  );

  return (
    <div className={`incident-card ${incident.threatLevel.toLowerCase()}`}>
      {/* Weapon Indicator */}
      {incident.weaponType && (
        <div className="weapon-badge">
          <span className="weapon-icon">
            {incident.weaponType === 'gun' ? '🔫' : '🔪'}
          </span>
          <span className="weapon-label">
            {incident.weaponType.toUpperCase()}
          </span>
        </div>
      )}

      {/* Threat Level */}
      <div className="threat-level">
        {incident.threatLevel}
      </div>

      {/* Crime Type */}
      <h3>{incident.type}</h3>

      {/* Signals with colors */}
      <div className="signals">
        {weaponSignals?.map(signal => (
          <span key={signal} className="signal signal-weapon">
            {signal}
          </span>
        ))}
        {incident.signals?.filter(s => !s.includes('GUN') && !s.includes('KNIFE')).map(signal => (
          <span key={signal} className="signal">
            {signal}
          </span>
        ))}
      </div>

      {/* Threat Score */}
      <div className="threat-score">
        <progress value={incident.threatScore} max="100"></progress>
        <span>{incident.threatScore}/100</span>
      </div>

      {/* Location & Time */}
      <div className="metadata">
        <p>📍 {incident.location}</p>
        <p>🕐 {new Date(incident.timestamp).toLocaleString()}</p>
        <p>📊 Confidence: {(incident.confidence * 100).toFixed(1)}%</p>
      </div>
    </div>
  );
}
```

---

## 📱 Real-time Socket.IO Events

### Emitted from Backend
```javascript
// When weapon crime detected
io.emit('weapon-crime-detected', {
  type: 'Shooting / Armed Murder Attempt',
  weaponType: 'gun',
  signals: ['GUN_AIMING_RIGHT', 'ASSAULT_HEAD', 'CLOSE_CONTACT'],
  threatScore: 99,
  confidence: 0.96,
  alertLevel: 1,  // IMMEDIATE
  location: 'Main Street, Downtown',
  timestamp: '2024-03-04T14:30:25Z',
  incidentId: 'INC_20240304_001'
});

// High-priority broadcast
io.emit('critical-alert', {
  message: '🚨 ARMED THREAT DETECTED',
  incidentId: 'INC_20240304_001',
  weaponType: 'gun',
  location: 'Main Street, Downtown'
});

// Operator notification
io.to(`operator-terminal`).emit('new-incident', {
  priority: 'CRITICAL',
  type: incident.type,
  requiresImmediateResponse: true
});
```

---

## ✅ Error Handling

### When Detection Fails
```json
{
  "success": false,
  "type": "ANALYSIS_ERROR",
  "confidence": 0.0,
  "message": "Error in analyze_image: [error details]",
  "threat_level": "LOW",
  "persons_detected": 0,
  "activities": [],
  "signals": [],
  "response_time_ms": 245
}
```

### Invalid Image
```json
{
  "success": false,
  "type": "INVALID_IMAGE",
  "confidence": 0.0,
  "message": "Could not read image file",
  "response_time_ms": 50
}
```

---

## 🔄 Batch Processing Response

```json
{
  "success": true,
  "results": [
    {
      "filename": "shooting_incident.jpg",
      "detection": { /* response object */ }
    },
    {
      "filename": "robbery_incident.jpg",
      "detection": { /* response object */ }
    }
  ],
  "total_processed": 2,
  "response_time_ms": 450
}
```

---

**API Version**: 2.0 (Weapon Detection Enabled)
**Last Updated**: March 4, 2024

