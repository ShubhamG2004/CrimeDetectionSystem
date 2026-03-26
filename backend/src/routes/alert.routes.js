const express = require("express");
const {
  listAlerts,
  getAlert,
  updateAlertStatus,
  acknowledgeAlert,
  handleAlertWebhook,
} = require("../controllers/alert.controller");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

router.post("/webhook", handleAlertWebhook);
router.post("/:id/ack", acknowledgeAlert);
router.get("/", verifyToken, listAlerts);
router.get("/:id", verifyToken, getAlert);
router.patch("/:id/status", verifyToken, updateAlertStatus);

module.exports = router;
