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

const hasTwilioConfig =
  Boolean(process.env.TWILIO_ACCOUNT_SID) &&
  Boolean(process.env.TWILIO_AUTH_TOKEN) &&
  Boolean(process.env.TWILIO_FROM_NUMBER);

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
  statusHistory: [
    {
      status: ALERT_STATUS.PENDING,
      changedBy: "system",
      reason: "auto-alert",
      changedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  ],
});

const sendSmsAlert = async ({ alertDoc, stationMeta }) => {
  if (!smsClient) {
    return {
      channel: "sms",
      status: "skipped",
      reason: "Twilio is not configured",
    };
  }
  if (!stationMeta?.contactNumber) {
    return {
      channel: "sms",
      status: "skipped",
      reason: "Station contact number unavailable",
    };
  }

  const message =
    `CRITICAL ALERT: ${alertDoc.crime_type} detected at ${alertDoc.location?.name || alertDoc.camera?.name}` +
    ` | Threat: ${alertDoc.threat_level} (${alertDoc.threat_score}) | Incident ${alertDoc.incidentId}`;

  try {
    await smsClient.messages.create({
      body: message,
      from: process.env.TWILIO_FROM_NUMBER,
      to: stationMeta.contactNumber,
    });
    return {
      channel: "sms",
      status: "delivered",
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("SMS alert failed:", err.message);
    return {
      channel: "sms",
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
  const storedAlert = { id: docRef.id, ...alertPayload };
  const deliveryLog = await dispatchDeliveries({ alertDoc: storedAlert, stationMeta });

  await docRef.update({
    deliveryLog,
    lastNotificationAt: deliveryLog.length
      ? admin.firestore.FieldValue.serverTimestamp()
      : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const enrichedAlert = { ...storedAlert, deliveryLog };

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
