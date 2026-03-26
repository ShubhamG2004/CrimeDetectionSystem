const nodemailer = require("nodemailer");
const twilio = require("twilio");
const { db, admin } = require("../config/firebase");
const { findNearestStation } = require("../controllers/policeStation.controller");

const ALERT_COLLECTION = "alerts";
const ALERT_STATUS = {
  PENDING: "pending",
  ACKNOWLEDGED: "acknowledged",
  RESOLVED: "resolved",
};
const HIGH_RISK_LEVELS = new Set(["HIGH", "CRITICAL"]);
const SCORE_THRESHOLD = Number(process.env.ALERT_SCORE_THRESHOLD || 70);

const TWILIO_CHANNEL = (process.env.TWILIO_CHANNEL || "whatsapp").toLowerCase();
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
const TWILIO_TEST_NUMBER = process.env.TWILIO_TEST_NUMBER || "+917057652014";
const MAX_RETRIES = 3;
const RETRY_DELAY = 3 * 60 * 1000; // 3 minutes

const hasTwilioConfig =
  Boolean(process.env.TWILIO_ACCOUNT_SID) &&
  Boolean(process.env.TWILIO_AUTH_TOKEN) &&
  Boolean(TWILIO_FROM_NUMBER);

const smsClient = hasTwilioConfig
  ? twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
  : null;

const hasMailConfig =
  Boolean(process.env.ALERT_SMTP_HOST) &&
  Boolean(process.env.ALERT_SMTP_USER) &&
  Boolean(process.env.ALERT_SMTP_PASS);

const mailTransport = hasMailConfig
  ? nodemailer.createTransport({
      host: process.env.ALERT_SMTP_HOST,
      port: Number(process.env.ALERT_SMTP_PORT || 587),
      secure: process.env.ALERT_SMTP_SECURE === "true",
      auth: {
        user: process.env.ALERT_SMTP_USER,
        pass: process.env.ALERT_SMTP_PASS,
      },
    })
  : null;

const shouldTriggerAlert = ({ threat_level = "LOW", threat_score = 0 }) => {
  const normalizedLevel = String(threat_level).toUpperCase();
  if (HIGH_RISK_LEVELS.has(normalizedLevel)) {
    return true;
  }
  return Number(threat_score) >= SCORE_THRESHOLD;
};

const buildCameraMeta = ({ cameraId, cameraData = {}, location = {} }) => ({
  id: cameraId,
  name: cameraData.name || location.name || "Unknown Camera",
  area: cameraData.area || location.name || "Unknown Area",
  assignedStationId: cameraData.assignedStation?.id || null,
  addedBy: cameraData.addedBy || null,
});

const buildStationMeta = (station) => {
  if (!station) return null;
  return {
    id: station.id || null,
    stationName: station.stationName || station.name || "Unknown Station",
    contactNumber: station.contactNumber || station.phone || null,
    emergencyNumber: station.emergencyNumber || null,
    alertEmail: station.alertEmail || null,
    officerInCharge: station.officerInCharge || null,
    jurisdictionRadius: station.jurisdictionRadius || null,
    location: station.location || null,
  };
};

const resolveStationTarget = async ({ cameraData, location, nearestStation }) => {
  if (cameraData?.assignedStation?.id) {
    return cameraData.assignedStation;
  }
  if (nearestStation) {
    return nearestStation;
  }
  if (location?.lat != null && location?.lng != null) {
    try {
      return await findNearestStation(location.lat, location.lng);
    } catch (err) {
      console.warn("Failed to resolve nearest station:", err.message);
      return null;
    }
  }
  return null;
};

const createAlertPayload = ({
  incidentId,
  incidentData,
  cameraMeta,
  stationMeta,
  location,
}) => ({
  incidentId,
  status: ALERT_STATUS.PENDING,
  camera: cameraMeta,
  station: stationMeta,
  cameraId: cameraMeta.id,
  stationId: stationMeta?.id || null,
  crime_type: incidentData.crime_type,
  threat_level: incidentData.threat_level,
  threat_score: incidentData.threat_score,
  confidence: incidentData.confidence,
  persons_detected: incidentData.persons_detected,
  source: incidentData.source,
  imageUrl: incidentData.imageUrl,
  location,
  aiTimestamp: incidentData.aiTimestamp || null,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
  lastNotificationAt: null,
  deliveryLog: [],
  statusHistory: [],
  retryCount: 0,
});

const formatTwilioAddress = (number) => {
  if (!number) return null;

  let clean = number.replace("whatsapp:", "").trim();

  if (!clean.startsWith("+")) {
    clean = "+91" + clean;
  }

  return `whatsapp:${clean}`;
};

const sendSmsAlert = async ({ alertDoc, stationMeta }) => {
  if (!smsClient) {
    return {
      channel: TWILIO_CHANNEL,
      status: "skipped",
      reason: "Twilio is not configured",
    };
  }

  const toNumber = stationMeta?.contactNumber || TWILIO_TEST_NUMBER;
  const formattedTo = formatTwilioAddress(toNumber);
  const formattedFrom = formatTwilioAddress(TWILIO_FROM_NUMBER);

  if (!formattedTo || !formattedFrom) {
    return {
      channel: TWILIO_CHANNEL,
      status: "skipped",
      reason: "Messaging addresses unavailable",
    };
  }

  const locationLabel = alertDoc.location?.name || alertDoc.camera?.name || "Unknown Location";
  const messageBody =
    "\uD83D\uDEA8 CRIME ALERT \uD83D\uDEA8\n\n" +
    `Location: ${locationLabel}\n` +
    `Camera: ${alertDoc.camera?.id || "N/A"}\n` +
    `Crime: ${alertDoc.crime_type || "Unknown"}\n` +
    `Threat: ${alertDoc.threat_level || "LOW"} (score ${alertDoc.threat_score || 0})\n` +
    `Time: ${new Date().toLocaleString()}\n\n` +
    "Take immediate action.";

  console.log("Sending WhatsApp Alert...");
  console.log("FROM:", formattedFrom);
  console.log("TO:", formattedTo);

  try {
    await smsClient.messages.create({
      from: formattedFrom,
      to: formattedTo,
      body: messageBody,
    });
    console.log("✅ WhatsApp message sent");
    return {
      channel: TWILIO_CHANNEL,
      status: "delivered",
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("❌ WhatsApp send failed:", err.message);
    return {
      channel: TWILIO_CHANNEL,
      status: "failed",
      error: err.message,
    };
  }
};

const sendEmailAlert = async ({ alertDoc, stationMeta }) => {
  if (!mailTransport) {
    return {
      channel: "email",
      status: "skipped",
      reason: "Email transport is not configured",
    };
  }
  const recipient = stationMeta?.alertEmail || process.env.ALERT_FALLBACK_EMAIL;
  if (!recipient) {
    return {
      channel: "email",
      status: "skipped",
      reason: "No alert email configured",
    };
  }

  const subject = `[CRIME ALERT] ${alertDoc.crime_type} at ${alertDoc.location?.name || alertDoc.camera?.name}`;
  const body = `A ${alertDoc.threat_level} incident was detected by camera ${alertDoc.camera?.name} (${alertDoc.camera?.area}).\n\n` +
    `- Incident ID: ${alertDoc.incidentId}\n` +
    `- Camera ID: ${alertDoc.camera?.id}\n` +
    `- Location: ${alertDoc.location?.name || "Unknown"}\n` +
    `- Crime: ${alertDoc.crime_type}\n` +
    `- Confidence: ${(Number(alertDoc.confidence) * 100).toFixed(1)}%\n` +
    `- Threat Level: ${alertDoc.threat_level} (score ${alertDoc.threat_score})\n` +
    `- Detected at: ${new Date().toISOString()}\n\n` +
    `Image evidence: ${alertDoc.imageUrl || "N/A"}\n` +
    `Dashboard: ${process.env.POLICE_DASHBOARD_URL || "http://localhost:3000/dashboard"}`;

  try {
    await mailTransport.sendMail({
      from: process.env.ALERT_EMAIL_FROM || process.env.ALERT_SMTP_USER,
      to: recipient,
      subject,
      text: body,
    });
    return {
      channel: "email",
      status: "delivered",
      timestamp: new Date().toISOString(),
      recipient,
    };
  } catch (err) {
    console.error("Email alert failed:", err.message);
    return {
      channel: "email",
      status: "failed",
      error: err.message,
    };
  }
};

const dispatchDeliveries = async ({ alertDoc, stationMeta }) => {
  const logs = [];
  logs.push(await sendSmsAlert({ alertDoc, stationMeta }));
  logs.push(await sendEmailAlert({ alertDoc, stationMeta }));
  return logs;
};

const scheduleRetry = (alertId) => {
  setTimeout(async () => {
    try {
      const docRef = db.collection(ALERT_COLLECTION).doc(alertId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return;
      }

      const alert = doc.data();

      if (alert.status === ALERT_STATUS.ACKNOWLEDGED) {
        console.log("✅ Alert already acknowledged. No retry needed.");
        return;
      }

      const retryCount = alert.retryCount || 0;

      if (retryCount >= MAX_RETRIES) {
        console.log("❌ Max retries reached. Stopping.");
        return;
      }

      console.log(`🔁 Retrying alert (${retryCount + 1})...`);

      const deliveryLog = await dispatchDeliveries({
        alertDoc: { id: alertId, ...alert },
        stationMeta: alert.station,
      });

      const updatePayload = {
        retryCount: retryCount + 1,
        lastNotificationAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (deliveryLog?.length) {
        updatePayload.deliveryLog = admin.firestore.FieldValue.arrayUnion(
          ...deliveryLog
        );
      }

      await docRef.update(updatePayload);

      scheduleRetry(alertId);
    } catch (err) {
      console.error("Retry failed:", err.message);
    }
  }, RETRY_DELAY);
};

const triggerStationAlert = async ({
  incidentId,
  incidentData,
  cameraData,
  cameraId,
  location,
  nearestStation = null,
  io = null,
}) => {
  const stationMeta = await resolveStationTarget({
    cameraData,
    location,
    nearestStation,
  });

  if (!stationMeta) {
    console.warn("No station found for critical incident", {
      incidentId,
      cameraId,
    });
    return null;
  }

  const cameraMeta = buildCameraMeta({ cameraId, cameraData, location });
  const alertPayload = createAlertPayload({
    incidentId,
    incidentData,
    cameraMeta,
    stationMeta,
    location,
  });

  const docRef = await db.collection(ALERT_COLLECTION).add(alertPayload);
  const baseAlert = { id: docRef.id, ...alertPayload };
  const deliveryLog = await dispatchDeliveries({ alertDoc: baseAlert, stationMeta });

  if (io) {
    deliveryLog.push({
      channel: "dashboard",
      status: "emitted",
      timestamp: new Date().toISOString(),
    });
  }

  const pendingEntry = {
    status: ALERT_STATUS.PENDING,
    changedBy: "system",
    reason: "auto-alert",
    changedAt: admin.firestore.Timestamp.now(),
  };

  await docRef.update({
    statusHistory: [pendingEntry],
    deliveryLog,
    lastNotificationAt: deliveryLog.length
      ? admin.firestore.FieldValue.serverTimestamp()
      : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  scheduleRetry(docRef.id);

  const enrichedAlert = {
    ...baseAlert,
    deliveryLog,
    statusHistory: [pendingEntry],
  };

  if (io) {
    io.emit("alert:created", enrichedAlert);
  }

  return enrichedAlert;
};

module.exports = {
  ALERT_STATUS,
  shouldTriggerAlert,
  triggerStationAlert,
};
