const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const normalizeSeverity = (value) => (value || "").toLowerCase();

const resolveSeverity = (incident) => {
  const explicit = normalizeSeverity(incident.severity);
  if (explicit) return explicit;

  const threatLevel = normalizeSeverity(incident.threat_level);
  if (threatLevel === "critical") return "critical";
  if (threatLevel === "high" || threatLevel === "medium") return "warning";
  if (threatLevel === "low") return "info";
  return "";
};

const getTimeMs = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const shouldEscalate = (incident) => {
  const createdAtMs = getTimeMs(incident.createdAt || incident.timestamp);
  if (!createdAtMs) return false;

  const ageMin = (Date.now() - createdAtMs) / 60000;
  return (
    resolveSeverity(incident) === "warning" &&
    (ageMin > 10 ||
      Number(incident.confidence || 0) > 0.85 ||
      Number(incident.confirmations || 0) >= 2)
  );
};

exports.autoEscalateIncident = functions.firestore
  .document("incidents/{incidentId}")
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null;

    const incident = change.after.data();
    const severity = resolveSeverity(incident);

    if (severity !== "warning") return null;
    if (incident.escalatedAt) return null;

    if (!shouldEscalate(incident)) return null;

    return change.after.ref.update({
      severity: "critical",
      escalatedAt: admin.firestore.FieldValue.serverTimestamp(),
      escalationReason: "AUTO_RULE",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
