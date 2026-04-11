const { admin } = require("../config/firebase");

async function logOperatorActivity({
  operatorUid,
  operatorEmail,
  action,
  description,
  cameraId = null,
  ipAddress = null,
  metadata = {},
}) {
  try {
    await admin.firestore().collection("operator_logs").add({
      operatorUid,
      operatorEmail,
      action,
      description,
      cameraId,
      ipAddress,
      metadata,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("⚠️ Failed to log operator activity:", err.message);
  }
}

module.exports = { logOperatorActivity };
