const express = require("express");
const router = express.Router();
const { admin } = require("../config/firebase");
const { verifyToken, requireAdmin } = require("../middleware/auth");

const COLLECTION = "support_messages";

const canCreateMessage = (role) => role === "operator" || role === "field_operator";

router.post("/", verifyToken, async (req, res) => {
  try {
    if (!canCreateMessage(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: "Only operators and field operators can send messages to admin",
      });
    }

    const { subject, message, priority = "medium", sourcePage = null } = req.body || {};

    if (!subject || !String(subject).trim() || !message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject and message are required",
      });
    }

    const normalizedPriority = ["low", "medium", "high"].includes(String(priority).toLowerCase())
      ? String(priority).toLowerCase()
      : "medium";

    const payload = {
      fromUid: req.user.uid,
      fromEmail: req.user.email || null,
      fromRole: req.user.role,
      toRole: "admin",
      subject: String(subject).trim(),
      message: String(message).trim(),
      priority: normalizedPriority,
      status: "open",
      sourcePage: sourcePage ? String(sourcePage) : null,
      resolutionNote: null,
      resolvedBy: null,
      resolvedByEmail: null,
      resolvedAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await admin.firestore().collection(COLLECTION).add(payload);
    return res.status(201).json({
      success: true,
      message: "Issue sent to admin successfully",
      id: docRef.id,
    });
  } catch (err) {
    console.error("CREATE MESSAGE ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Failed to send message" });
  }
});

router.get("/mine", verifyToken, async (req, res) => {
  try {
    const snapshot = await admin
      .firestore()
      .collection(COLLECTION)
      .where("fromUid", "==", req.user.uid)
      .orderBy("createdAt", "desc")
      .get();

    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json({ success: true, data: items });
  } catch (err) {
    console.error("LIST MY MESSAGES ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Failed to load messages" });
  }
});

router.get("/admin", verifyToken, requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || "all").toLowerCase();

    let queryRef = admin.firestore().collection(COLLECTION);
    if (status === "open" || status === "resolved") {
      queryRef = queryRef.where("status", "==", status);
    }

    const snapshot = await queryRef.orderBy("createdAt", "desc").get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return res.json({ success: true, data: items });
  } catch (err) {
    console.error("ADMIN LIST MESSAGES ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Failed to load messages" });
  }
});

router.patch("/:id/resolve", verifyToken, requireAdmin, async (req, res) => {
  try {
    const messageId = req.params.id;
    const resolutionNote = String(req.body?.resolutionNote || "").trim() || null;

    await admin
      .firestore()
      .collection(COLLECTION)
      .doc(messageId)
      .update({
        status: "resolved",
        resolutionNote,
        resolvedBy: req.user.uid,
        resolvedByEmail: req.user.email || null,
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return res.json({ success: true, message: "Issue marked as resolved" });
  } catch (err) {
    console.error("RESOLVE MESSAGE ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Failed to resolve message" });
  }
});

module.exports = router;
