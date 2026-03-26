const { db, admin } = require("../config/firebase");
const { ALERT_STATUS } = require("../services/alert.service");

const COLLECTION = "alerts";

const normalizeStatus = (status) => String(status || "").toLowerCase();

exports.listAlerts = async (req, res) => {
  try {
    const { status, stationId, limit } = req.query;
    let query = db.collection(COLLECTION).orderBy("createdAt", "desc");

    if (status) {
      query = query.where("status", "==", normalizeStatus(status));
    }

    if (stationId) {
      query = query.where("stationId", "==", stationId);
    }

    const docs = await query.limit(Number(limit || 100)).get();
    const data = docs.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("listAlerts error:", err.message);
    res.status(500).json({ success: false, message: "Failed to load alerts" });
  }
};

exports.getAlert = async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: "Alert not found" });
    }
    res.status(200).json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (err) {
    console.error("getAlert error:", err.message);
    res.status(500).json({ success: false, message: "Failed to load alert" });
  }
};

exports.updateAlertStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const normalized = normalizeStatus(status);
    const allowedStatuses = Object.values(ALERT_STATUS);

    if (!normalized || !allowedStatuses.includes(normalized)) {
      return res.status(400).json({
        success: false,
        message: "Status must be one of pending, acknowledged, resolved",
      });
    }

    const alertRef = db.collection(COLLECTION).doc(req.params.id);
    const existing = await alertRef.get();

    if (!existing.exists) {
      return res.status(404).json({ success: false, message: "Alert not found" });
    }

    const historyEntry = {
      status: normalized,
      notes: notes || null,
      changedBy: req.user?.uid || "system",
      changedAt: admin.firestore.Timestamp.now(),
    };

    const updatePayload = {
      status: normalized,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      statusHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
    };

    if (notes) {
      updatePayload.notes = notes;
    }

    await alertRef.update(updatePayload);
    const updatedDoc = await alertRef.get();

    res.status(200).json({
      success: true,
      data: { id: updatedDoc.id, ...updatedDoc.data() },
    });
  } catch (err) {
    console.error("updateAlertStatus error:", err.message);
    res.status(500).json({ success: false, message: "Failed to update alert" });
  }
};

exports.acknowledgeAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const alertRef = db.collection(COLLECTION).doc(id);
    const snapshot = await alertRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ success: false, message: "Alert not found" });
    }

    const historyEntry = {
      status: ALERT_STATUS.ACKNOWLEDGED,
      notes: req.body?.notes || null,
      changedBy: req.user?.uid || "ack-endpoint",
      changedAt: admin.firestore.Timestamp.now(),
    };

    await alertRef.update({
      status: ALERT_STATUS.ACKNOWLEDGED,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      statusHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
    });

    res.status(200).json({ success: true, message: "Alert acknowledged" });
  } catch (err) {
    console.error("acknowledgeAlert error:", err.message);
    res.status(500).json({ success: false, message: "Failed to acknowledge alert" });
  }
};

exports.handleAlertWebhook = async (req, res) => {
  try {
    const bodyContent = (req.body?.Body || "").toString().trim();

    if (bodyContent.toLowerCase().includes("ack")) {
      console.log("ACK received from police");
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("handleAlertWebhook error:", err.message);
    res.status(500).send("Error");
  }
};
