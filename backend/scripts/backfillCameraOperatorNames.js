const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "..", "firebase-admin.json");
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function backfillCameraOperatorNames() {
  console.log("🔄 Starting camera operator name backfill...");

  const cameraSnap = await db.collection("cameras").get();
  console.log(`📷 Found ${cameraSnap.size} camera documents.`);

  let updated = 0;
  for (const docSnap of cameraSnap.docs) {
    const data = docSnap.data();
    const cameraId = docSnap.id;
    const operatorUid = data.fieldOperatorId || data.addedBy;

    const alreadyHasNames = data.fieldOperatorName && data.addedByName;
    if (!operatorUid && alreadyHasNames) {
      continue;
    }

    let operatorName = data.fieldOperatorName || data.addedByName || "Unknown";

    if (operatorUid && (!data.fieldOperatorName || !data.addedByName)) {
      try {
        const operatorDoc = await db.collection("field_operator").doc(operatorUid).get();
        if (operatorDoc.exists) {
          operatorName = operatorDoc.data().name || operatorDoc.data().email || operatorName;
        }
      } catch (error) {
        console.error(`⚠️ Failed to fetch operator ${operatorUid} for camera ${cameraId}:`, error);
      }
    }

    if (!alreadyHasNames || operatorName !== (data.fieldOperatorName || data.addedByName)) {
      await docSnap.ref.update({
        fieldOperatorName: operatorName,
        addedByName: operatorName,
      });
      updated += 1;
      console.log(`✅ Updated camera ${cameraId} with operator name ${operatorName}`);
    }
  }

  console.log(`🎉 Backfill complete. Updated ${updated} camera documents.`);
}

backfillCameraOperatorNames()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Backfill failed:", error);
    process.exit(1);
  });
