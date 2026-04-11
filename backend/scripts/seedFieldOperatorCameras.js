const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
  : path.join(__dirname, "..", "firebase-admin.json");

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
  });
}

const db = admin.firestore();

const fieldOperatorId = "dXOwsXqUwHMAwgATWVU5UCH3XWO2";

const cameraRows = [
  ["PUNE-FS-001", "Shivajinagar North Gate Cam", "Shivajinagar Junction", 18.5313, 73.8469],
  ["PUNE-FS-001", "Shivajinagar Market Cam", "Shivajinagar Market Lane", 18.5299, 73.8484],
  ["PUNE-FS-002", "Koregaon Lane-5 Cam", "Koregaon Park Lane 5", 18.5368, 73.8924],
  ["PUNE-FS-002", "Koregaon Riverfront Cam", "Koregaon Riverfront Road", 18.5355, 73.8937],
  ["PUNE-FS-003", "Kothrud Depot Cam", "Kothrud Depot Circle", 18.508, 73.8069],
  ["PUNE-FS-003", "Kothrud Signal Cam", "Kothrud Main Signal", 18.5068, 73.8084],
  ["PUNE-FS-004", "Hadapsar Junction Cam", "Hadapsar Main Junction", 18.5095, 73.9251],
  ["PUNE-FS-004", "Hadapsar Market Cam", "Hadapsar Market Road", 18.5081, 73.9269],
  ["PUNE-FS-005", "Baner Main Road Cam", "Baner Main Road", 18.5597, 73.786],
  ["PUNE-FS-005", "Baner Link Cam", "Baner Link Street", 18.5584, 73.7875],
  ["PUNE-FS-006", "Aundh ITI Cam", "Aundh ITI Circle", 18.561, 73.8062],
  ["PUNE-FS-006", "Aundh DP Road Cam", "Aundh DP Road", 18.5596, 73.8078],
  ["PUNE-FS-007", "Viman Nagar Chowk Cam", "Viman Nagar Chowk", 18.5686, 73.9135],
  ["PUNE-FS-007", "Viman Nagar Mall Cam", "Viman Nagar Mall Road", 18.5672, 73.9151],
  ["PUNE-FS-008", "Sinhagad Bridge Cam", "Sinhagad Bridge Point", 18.4733, 73.8539],
  ["PUNE-FS-008", "Sinhagad Colony Cam", "Sinhagad Colony Road", 18.4719, 73.8556],
  ["PUNE-FS-009", "Wagholi Highway Cam", "Wagholi Highway Segment", 18.581, 73.9848],
  ["PUNE-FS-009", "Wagholi Bus Stop Cam", "Wagholi Bus Stop", 18.5797, 73.9863],
  ["PUNE-FS-010", "Hinjawadi Phase-1 Cam", "Hinjawadi Phase 1 Circle", 18.5923, 73.7381],
  ["PUNE-FS-010", "Hinjawadi Circle Cam", "Hinjawadi Main Circle", 18.5908, 73.7396],
];

const stationCodes = [
  "PUNE-FS-001",
  "PUNE-FS-002",
  "PUNE-FS-003",
  "PUNE-FS-004",
  "PUNE-FS-005",
  "PUNE-FS-006",
  "PUNE-FS-007",
  "PUNE-FS-008",
  "PUNE-FS-009",
  "PUNE-FS-010",
];

async function run() {
  const fieldOperatorSnap = await db.collection("field_operator").doc(fieldOperatorId).get();
  if (!fieldOperatorSnap.exists) {
    throw new Error("Field operator not found");
  }

  const fieldOperator = fieldOperatorSnap.data() || {};
  const fieldOperatorName = fieldOperator.name || fieldOperator.email || "Unknown";

  const stationSnap = await db
    .collection("policeStations")
    .where("stationCode", "in", stationCodes)
    .get();

  const stationByCode = new Map();
  stationSnap.forEach((docSnap) => {
    stationByCode.set(docSnap.data().stationCode, { id: docSnap.id, ...docSnap.data() });
  });

  if (stationByCode.size !== stationCodes.length) {
    throw new Error(`Expected ${stationCodes.length} stations, found ${stationByCode.size}`);
  }

  let created = 0;

  for (const [stationCode, cameraName, location, latitude, longitude] of cameraRows) {
    const station = stationByCode.get(stationCode);
    const cameraRef = db.collection("cameras").doc();

    const payload = {
      cameraId: cameraRef.id,
      cameraName,
      location,
      latitude,
      longitude,
      policeStationId: station.id,
      policeStationName: station.stationName || null,
      description: "Sample test camera",
      fieldOperatorId,
      fieldOperatorName,
      addedBy: fieldOperatorId,
      addedByName: fieldOperatorName,
      status: "pending",
      approvedBy: null,
      approvedByName: null,
      approvedAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      name: cameraName,
      area: location,
      active: false,
      assignedStationId: station.id,
      assignedStation: {
        id: station.id,
        stationName: station.stationName || null,
        contactNumber: station.contactNumber || null,
        alertEmail: station.alertEmail || null,
        emergencyNumber: station.emergencyNumber || null,
        officerInCharge: station.officerInCharge || null,
        jurisdictionRadius: station.jurisdictionRadius || null,
        location: station.location || null,
      },
    };

    await cameraRef.set(payload);
    created += 1;
    console.log(`CREATED ${stationCode} ${cameraRef.id} ${cameraName}`);
  }

  console.log(`TOTAL_CREATED=${created}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("FAILED", error.message);
    process.exit(1);
  });
