# Crime Detection System
## Camera Approval Workflow Specification

## Objective

Update the current system so that Admin no longer directly adds cameras.

Instead implement a 3-step approval workflow:

Field Operator -> Submit Camera -> Admin Approves -> Camera Activated

This improves security and mimics real-world police surveillance systems.

## Roles in the System

The system now has 3 user roles.

### 1. Admin

Admin responsibilities:

- Create Police Stations
- Approve or Reject Cameras
- Manage Field Operators
- Monitor cameras
- Access analytics

Admin dashboard:

- /dashboard/admin

Admin features:

- View Pending Cameras
- Approve Cameras
- Reject Cameras
- View Active Cameras
- Manage Police Stations
- Manage Operators

### 2. Field Operator (Camera Installer)

Field Operator is responsible for physically installing cameras and registering them.

Better name than "camera adder".

Recommended role name:

- field_operator

Responsibilities:

- Login
- Add camera
- Submit camera for approval
- View their submitted cameras

Field operator dashboard:

- /field-operator

Pages:

- /field-operator/add-camera
- /field-operator/my-cameras

### 3. System Camera

Cameras become active only after admin approval.

Statuses:

- pending
- approved
- rejected

## Camera Approval Workflow

System flow:

Field Operator Login
        ↓
Add Camera Details
        ↓
Camera saved in Firebase
status = pending
        ↓
Admin Dashboard
        ↓
Admin Reviews Camera
        ↓
Approve OR Reject
        ↓
status = approved
        ↓
Camera becomes active

## Firestore Database Structure

Use Firebase Firestore.

### Collection: users

users

Example document:

users/{userId}

Example data:

```json
{
  "name": "Rahul Patil",
  "email": "rahul@crime.ai",
  "role": "field_operator",
  "createdAt": "timestamp"
}
```

Possible roles:

- admin
- field_operator
- operator

### Collection: policeStations

policeStations

Example document:

```json
{
  "name": "Shivajinagar Police Station",
  "city": "Pune",
  "latitude": 18.5314,
  "longitude": 73.8446,
  "createdBy": "admin_uid"
}
```

### Collection: cameras

cameras

Example document:

```json
{
  "cameraName": "Main Road Camera 01",
  "location": "Station Road",
  "latitude": 18.5204,
  "longitude": 73.8567,
  "ipAddress": "192.168.1.100",
  "policeStationId": "station_01",
  "addedBy": "operator_uid",
  "status": "pending",
  "createdAt": "timestamp",
  "approvedBy": null
}
```

Camera statuses:

- pending
- approved
- rejected

## Firestore Security Rules Concept

Only field_operator can create cameras.

Admin can approve.

Example logic:

- field_operator -> create camera
- admin -> update camera status

## Frontend Structure (Next.js App Router)

Current project:

frontend/src/app

Updated structure:

```text
frontend/src/app/
|
|-- login/
|
|-- field-operator/
|   |-- add-camera/
|   |   |-- page.js
|   |
|   |-- my-cameras/
|   |   |-- page.js
|   |
|   |-- page.js
|
|-- dashboard/
|   |-- admin/
|       |
|       |-- cameras/
|       |   |-- pending/
|       |   |   |-- page.js
|       |   |
|       |   |-- approved/
|       |   |   |-- page.js
|       |   |
|       |   |-- page.js
|       |
|       |-- police-stations/
|       |
|       |-- operators/
|       |
|       |-- page.js
|
|-- detect-image/
|-- analytics/
|-- page.js
```

## Field Operator Add Camera Page

Route:

- /field-operator/add-camera

Form fields:

- Camera Name
- IP Address
- Location Name
- Latitude
- Longitude
- Police Station
- Description

On submit:

Save to Firestore:

- collection: cameras

with status:

- status = "pending"

Example camera submission code:

```javascript
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

await addDoc(collection(db, "cameras"), {
  cameraName,
  ipAddress,
  location,
  latitude,
  longitude,
  policeStationId,
  addedBy: user.uid,
  status: "pending",
  createdAt: new Date()
});
```

## Admin Camera Approval Page

Route:

- /dashboard/admin/cameras/pending

Fetch cameras:

- status == "pending"

Display table:

- Camera Name
- Location
- Police Station
- Added By
- Approve Button
- Reject Button

### Approve Camera

Update document:

- status = approved
- approvedBy = admin_id

Example:

```javascript
import { updateDoc, doc } from "firebase/firestore";

await updateDoc(doc(db, "cameras", cameraId), {
  status: "approved",
  approvedBy: admin.uid
});
```

### Reject Camera

- status = rejected

## Login System

Use Firebase Authentication.

After login:

Fetch user role from:

- users collection

Redirect based on role.

Example:

```javascript
if (role === "admin") {
  router.push("/dashboard/admin");
}

if (role === "field_operator") {
  router.push("/field-operator");
}
```

## Map-Based Camera Placement (Advanced Feature)

Instead of typing latitude and longitude manually.

Use:

- Leaflet.js
- Google Maps API
- Mapbox

Operator drops pin.

Coordinates automatically filled.

## Integration with AI Server

Only approved cameras should send stream to AI detection server.

Check:

- status == approved

before enabling monitoring.

## Logging (Optional but recommended)

Collection:

- operatorLogs

Example:

```json
{
  "operatorId": "uid",
  "action": "camera_added",
  "cameraId": "camera123",
  "timestamp": "..."
}
```

## n8n Integration

When camera becomes approved, trigger workflow:

Camera Approved
      ↓
Register Stream
      ↓
Start AI Monitoring
      ↓
Enable Alerts

## UI Recommendation

Use cards or table for cameras.

Status colors:

- pending -> yellow
- approved -> green
- rejected -> red

## Final Expected System

Admin
   ↓
Creates Police Station
   ↓
Creates Field Operators
   ↓
Field Operator Login
   ↓
Adds Camera
   ↓
Camera status = pending
   ↓
Admin Approves
   ↓
Camera status = approved
   ↓
AI Crime Detection starts

## Important Rule

Admin cannot directly add cameras anymore.

Only:

- Field Operator -> Add Camera
- Admin -> Approve Camera

## Optional Future Upgrades

- Advanced System Upgrade
- Smart Camera Registration
- Live Camera Health Monitoring
- AI Camera Calibration
- Auto Crime Alert Routing to nearest police station
- Map based crime heatmap
- Real-time CCTV streaming dashboard

These will make your Crime Detection System look like a real police surveillance platform and highly impressive for placements or a GitHub portfolio.
