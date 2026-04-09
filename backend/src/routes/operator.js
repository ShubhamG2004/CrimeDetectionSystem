const crypto = require("crypto");
const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const os = require("os");
const router = express.Router();
const { admin } = require("../config/firebase");
const { verifyToken } = require("../middleware/auth");
const cache = require("../config/cache");
const cloudinary = require("../config/cloudinary");

const serializeTimestamp = (value) => {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

const serializeIncident = (doc) => {
  const data = doc.data() || {};

  return {
    id: doc.id,
    ...data,
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
};

const dedupeIncidents = (incidents) => {
  const seen = new Set();
  const unique = [];

  incidents.forEach((incident) => {
    if (seen.has(incident.id)) {
      return;
    }

    seen.add(incident.id);
    unique.push(incident);
  });

  return unique;
};

const toRoutePath = (value, fallback) => {
  const raw = String(value || fallback || "").trim();
  if (!raw) return fallback;
  return raw.startsWith("/") ? raw : `/${raw}`;
};

const normalizeDeviceHost = (value) => {
  if (!value) return "";
  return String(value)
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
};

const toHttpUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `http://${raw}`;
};

const getLocalIpv4Address = () => {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      const family = typeof net.family === "string" ? net.family : String(net.family);
      if (family === "IPv4" && !net.internal && net.address && !net.address.startsWith("169.254.")) {
        return net.address;
      }
    }
  }
  return null;
};

const resolveBackendBaseUrl = (req) => {
  const explicitPublicUrl = String(process.env.BACKEND_PUBLIC_URL || "").trim();
  if (explicitPublicUrl) {
    return explicitPublicUrl.replace(/\/+$/, "");
  }

  const protocol = req.protocol || "http";
  const hostHeader = String(req.get("host") || "").trim();
  const fallbackHost = hostHeader || "localhost:5000";
  const [hostname, port = "5000"] = fallbackHost.split(":");
  const normalizedHost = String(hostname || "").toLowerCase();
  const isLocalHost =
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1";

  if (!isLocalHost) {
    return `${protocol}://${fallbackHost}`;
  }

  const localIp = getLocalIpv4Address();
  if (!localIp) {
    return `${protocol}://${fallbackHost}`;
  }

  return `${protocol}://${localIp}:${port}`;
};

const buildCaptureCandidates = (cameraData = {}) => {
  const candidates = [];

  const configuredCapture = cameraData?.esp32?.captureUrl || cameraData?.esp32CaptureUrl;
  const configuredStream = cameraData?.esp32?.streamUrl || cameraData?.esp32StreamUrl;
  const ipAddress = cameraData?.esp32?.ipAddress;

  const pushCandidate = (url) => {
    const normalized = toHttpUrl(url);
    if (!normalized) return;
    candidates.push(normalized);
  };

  pushCandidate(configuredCapture);

  if (configuredStream) {
    const streamUrl = toHttpUrl(configuredStream);
    pushCandidate(streamUrl.replace(/\/stream\/?$/i, "/capture"));
    pushCandidate(streamUrl.replace(/\/stream\/?$/i, "/snapshot"));
    pushCandidate(streamUrl.replace(/\/stream\/?$/i, "/jpg"));
  }

  if (ipAddress) {
    const host = normalizeDeviceHost(ipAddress);
    pushCandidate(`http://${host}/capture`);
    pushCandidate(`http://${host}/snapshot`);
    pushCandidate(`http://${host}/jpg`);
  }

  return [...new Set(candidates)];
};

const buildStreamCandidates = (cameraData = {}) => {
  const candidates = [];
  const configuredStream = cameraData?.esp32?.streamUrl || cameraData?.esp32StreamUrl;
  const ipAddress = cameraData?.esp32?.ipAddress;

  const pushCandidate = (url) => {
    const normalized = toHttpUrl(url);
    if (!normalized) return;
    candidates.push(normalized);
  };

  pushCandidate(configuredStream);

  if (ipAddress) {
    const host = normalizeDeviceHost(ipAddress);
    pushCandidate(`http://${host}/stream`);
  }

  return [...new Set(candidates)];
};

const extractJpegFromMjpegStream = (stream, timeoutMs = 12000) =>
  new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const startMarker = Buffer.from([0xff, 0xd8]);
    const endMarker = Buffer.from([0xff, 0xd9]);

    const cleanup = () => {
      stream.removeAllListeners("data");
      stream.removeAllListeners("error");
      stream.removeAllListeners("end");
      stream.removeAllListeners("close");
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while reading MJPEG stream"));
    }, timeoutMs);

    stream.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      const start = buffer.indexOf(startMarker);
      if (start === -1) {
        if (buffer.length > 1024 * 1024) {
          buffer = buffer.slice(-256 * 1024);
        }
        return;
      }

      const end = buffer.indexOf(endMarker, start + 2);
      if (end === -1) return;

      clearTimeout(timer);
      cleanup();
      resolve(buffer.slice(start, end + 2));
    });

    stream.on("error", (err) => {
      clearTimeout(timer);
      cleanup();
      reject(err);
    });

    stream.on("end", () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error("MJPEG stream ended before a frame was captured"));
    });

    stream.on("close", () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error("MJPEG stream closed before a frame was captured"));
    });
  });

const calculateThreatScore = ({ confidence = 0, threat_level = "LOW" }) => {
  let score = Math.round(Number(confidence || 0) * 100);

  switch (String(threat_level || "").toUpperCase()) {
    case "CRITICAL":
      score += 40;
      break;
    case "HIGH":
      score += 25;
      break;
    case "MEDIUM":
      score += 15;
      break;
    default:
      break;
  }

  return Math.min(100, score);
};

/**
 * ======================================================
 * 🎥 Get cameras assigned to logged-in operator
 * Source: operators collection ONLY
 * ======================================================
 */
router.get("/cameras", verifyToken, async (req, res) => {
  try {
    console.log("🔑 req.user:", req.user);

    const uid = req.user?.uid;
    const cacheKey = `operator:cameras:${uid || "unknown"}`;

    const cachedCameras = await cache.get(cacheKey);
    if (cachedCameras) {
      return res.json(cachedCameras);
    }

    console.log("👤 Operator UID:", uid);

    const operatorSnap = await admin
      .firestore()
      .collection("operators")
      .doc(uid)
      .get();

    console.log("📄 Operator exists:", operatorSnap.exists);

    if (!operatorSnap.exists) {
      console.log("❌ No operator document");
      return res.json([]);
    }

    const operator = operatorSnap.data();
    console.log("📄 Operator data:", operator);

    if (operator.status !== "active") {
      console.log("❌ Operator inactive");
      return res.json([]);
    }

    const cameraIds = Array.isArray(operator.cameras)
      ? operator.cameras
      : [];

    console.log("🎥 Camera IDs:", cameraIds);

    const cameraDocs = await Promise.all(
      cameraIds.map((id) =>
        admin.firestore().collection("cameras").doc(id).get()
      )
    );

    console.log(
      "📸 Camera docs exist:",
      cameraDocs.map((d) => d.exists)
    );

    const cameras = cameraDocs
      .filter((doc) => doc.exists)
      .map((doc) => ({
        cameraId: doc.id,
        ...doc.data(),
      }));

    console.log("✅ Cameras returned:", cameras);

    await cache.set(cacheKey, cameras, 120);

    return res.json(cameras);
  } catch (err) {
    console.error("❌ OPERATOR CAMERAS ERROR:", err);
    const errorText = String(err?.message || "").toLowerCase();
    const isQuotaError = err?.code === 8 || errorText.includes("resource_exhausted") || errorText.includes("quota");

    if (isQuotaError) {
      return res.status(503).json({
        success: false,
        cameras: [],
        message: "Incident service is temporarily unavailable (Firestore quota exceeded)",
      });
    }

    return res.status(500).json({
      success: false,
      cameras: [],
      message: "Failed to fetch assigned cameras",
    });
  }
});

/**
 * ======================================================
 * 🚨 Get incidents assigned to logged-in operator
 * Source: admin Firestore query scoped by camera IDs
 * ======================================================
 */
router.get("/incidents", verifyToken, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const cacheKey = `operator:incidents:${uid || "unknown"}`;

    const cachedIncidents = await cache.get(cacheKey);
    if (cachedIncidents) {
      return res.status(200).json(cachedIncidents);
    }

    if (!uid) {
      return res.status(401).json({
        success: false,
        incidents: [],
        total: 0,
        message: "Unauthorized request",
      });
    }

    const operatorSnap = await admin
      .firestore()
      .collection("operators")
      .doc(uid)
      .get();

    if (!operatorSnap.exists) {
      return res.status(403).json({
        success: false,
        message: "Operator profile not found",
      });
    }

    const operator = operatorSnap.data() || {};
    if (operator.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Operator account is inactive",
      });
    }

    const cameraIds = Array.isArray(operator.cameras) ? operator.cameras.filter(Boolean) : [];

    if (!cameraIds.length) {
      return res.status(200).json({ success: true, incidents: [] });
    }

    const chunks = [];
    for (let index = 0; index < cameraIds.length; index += 10) {
      chunks.push(cameraIds.slice(index, index + 10));
    }

    const topLevelSnapshots = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          return await admin
            .firestore()
            .collection("incidents")
            .where("cameraId", "in", chunk)
            .get();
        } catch (topLevelQueryError) {
          console.warn(
            "⚠️ Top-level incident cameraId query failed for a chunk; continuing with remaining chunks:",
            topLevelQueryError.message
          );
          return { docs: [] };
        }
      })
    );

    let nestedSnapshots = [];
    try {
      nestedSnapshots = await Promise.all(
        chunks.map((chunk) =>
          admin
            .firestore()
            .collection("incidents")
            .where("location.cameraId", "in", chunk)
            .get()
        )
      );
    } catch (nestedQueryError) {
      console.warn(
        "⚠️ Nested incident cameraId query failed; continuing with top-level cameraId results:",
        nestedQueryError.message
      );
    }

    const incidents = dedupeIncidents([
      ...topLevelSnapshots.flatMap((snapshot) => snapshot.docs.map(serializeIncident)),
      ...nestedSnapshots.flatMap((snapshot) => snapshot.docs.map(serializeIncident)),
    ])
      .sort((a, b) => {
        const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bMs - aMs;
      });

    const payload = {
      success: true,
      incidents,
      total: incidents.length,
    };

    await cache.set(cacheKey, payload, 120);

    return res.status(200).json(payload);
  } catch (err) {
    console.error("❌ OPERATOR INCIDENTS ERROR:", err);
    const errorText = String(err?.message || "").toLowerCase();
    const isQuotaError = err?.code === 8 || errorText.includes("resource_exhausted") || errorText.includes("quota");

    if (isQuotaError) {
      return res.status(503).json({
        success: false,
        incidents: [],
        total: 0,
        message: "Incident service is temporarily unavailable (Firestore quota exceeded)",
      });
    }

    return res.status(500).json({
      success: false,
      incidents: [],
      total: 0,
      message: "Failed to fetch incidents",
    });
  }
});

/**
 * ======================================================
 * 📷 Capture ESP32 frame and run AI detection (operator only)
 * ======================================================
 */
router.post("/capture-detect/:cameraId", verifyToken, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = req.user?.role;
    const cameraId = String(req.params?.cameraId || "").trim();

    if (!uid || role !== "operator") {
      return res.status(403).json({
        success: false,
        message: "Only operators can capture frames",
      });
    }

    if (!cameraId) {
      return res.status(400).json({
        success: false,
        message: "cameraId is required",
      });
    }

    const operatorSnap = await admin.firestore().collection("operators").doc(uid).get();
    if (!operatorSnap.exists) {
      return res.status(403).json({
        success: false,
        message: "Operator profile not found",
      });
    }

    const operatorData = operatorSnap.data() || {};
    const assignedCameras = Array.isArray(operatorData.cameras)
      ? operatorData.cameras.filter(Boolean)
      : [];

    if (!assignedCameras.includes(cameraId)) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this camera",
      });
    }

    const cameraSnap = await admin.firestore().collection("cameras").doc(cameraId).get();
    if (!cameraSnap.exists) {
      return res.status(404).json({
        success: false,
        message: "Camera not found",
      });
    }

    const cameraData = cameraSnap.data() || {};
    const captureCandidates = buildCaptureCandidates(cameraData);
    const streamCandidates = buildStreamCandidates(cameraData);

    if (!captureCandidates.length) {
      return res.status(400).json({
        success: false,
        message: "ESP32 capture URL is not configured for this camera",
      });
    }

    let captureResponse = null;
    let captureError = null;
    let usedCaptureUrl = "";
    const attemptedUrls = [];

    for (const candidateUrl of captureCandidates) {
      attemptedUrls.push(candidateUrl);
      try {
        const response = await axios.get(candidateUrl, {
          responseType: "arraybuffer",
          timeout: 15000,
          headers: {
            Accept: "image/jpeg,image/*,*/*",
            Connection: "close",
          },
          validateStatus: (status) => status >= 200 && status < 300,
        });

        captureResponse = response;
        usedCaptureUrl = candidateUrl;
        break;
      } catch (err) {
        captureError = err;
      }
    }

    if (!captureResponse) {
      for (const streamUrl of streamCandidates) {
        attemptedUrls.push(`${streamUrl}#mjpeg`);
        try {
          const streamRes = await axios.get(streamUrl, {
            responseType: "stream",
            timeout: 15000,
            headers: {
              Accept: "multipart/x-mixed-replace,image/jpeg,*/*",
              Connection: "close",
            },
            validateStatus: (status) => status >= 200 && status < 300,
          });

          const frameBuffer = await extractJpegFromMjpegStream(streamRes.data, 12000);
          captureResponse = {
            data: frameBuffer,
            headers: {
              "content-type": "image/jpeg",
            },
          };
          usedCaptureUrl = `${streamUrl}#mjpeg`;
          break;
        } catch (err) {
          captureError = err;
        }
      }
    }

    if (!captureResponse) {
      return res.status(502).json({
        success: false,
        message: "Failed to fetch frame from ESP32 device",
        detail: captureError?.message || "All capture URL attempts failed",
        attemptedUrls,
      });
    }

    const imageBuffer = Buffer.from(captureResponse.data || []);
    if (!imageBuffer.length) {
      return res.status(502).json({
        success: false,
        message: "Captured frame is empty",
      });
    }

    const contentType = captureResponse.headers?.["content-type"] || "image/jpeg";

    const formData = new FormData();
    formData.append("image", imageBuffer, {
      filename: "capture.jpg",
      contentType,
    });

    let aiPayload = {
      type: "UNKNOWN",
      confidence: 0,
      threat_level: "LOW",
      persons_detected: 0,
      activities: [],
      signals: [],
      crime_detected: false,
    };
    let aiError = null;

    try {
      const aiRes = await axios.post("http://127.0.0.1:8000/detect-image", formData, {
        headers: formData.getHeaders(),
        timeout: 30000,
      });
      aiPayload = {
        ...aiPayload,
        ...(aiRes.data || {}),
      };
    } catch (aiErr) {
      aiError = aiErr.message;
      console.warn("⚠️ AI detection failed for captured frame:", aiError);
    }

    const {
      type = "UNKNOWN",
      confidence = 0,
      threat_level = "LOW",
      persons_detected = 0,
      activities = [],
      signals = [],
      crime_detected = false,
    } = aiPayload;

    const threat_score = calculateThreatScore({ confidence, threat_level });
    const location = {
      cameraId,
      name: cameraData.area || cameraData.location || cameraData.name || "Unknown",
      lat: cameraData.latitude !== undefined ? Number(cameraData.latitude) : null,
      lng: cameraData.longitude !== undefined ? Number(cameraData.longitude) : null,
    };

    const imageBase64 = `data:${contentType};base64,${imageBuffer.toString("base64")}`;
    const uploadRes = await cloudinary.uploader.upload(imageBase64, {
      folder: "crime-detection/incidents",
    });

    const incidentData = {
      crime_type: type,
      confidence: Number(confidence) || 0,
      threat_level,
      threat_score,
      cameraId,
      persons_detected: Number(persons_detected) || 0,
      activities: Array.isArray(activities) ? activities : [],
      signals: Array.isArray(signals) ? signals : [],
      crime_detected: Boolean(crime_detected),
      location,
      imageUrl: uploadRes.secure_url,
      source: "operator-capture-detection",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const incidentRef = await admin.firestore().collection("incidents").add(incidentData);
    await cache.delByPrefix("operator:incidents:");

    return res.status(200).json({
      success: true,
      incidentId: incidentRef.id,
      data: {
        imageUrl: uploadRes.secure_url,
        crime_type: type,
        confidence,
        threat_level,
        persons_detected,
        activities,
        signals,
        crime_detected,
        threat_score,
        location,
        source: "operator-capture-detection",
        createdAt: new Date().toISOString(),
        ai_error: aiError,
        capture_url: usedCaptureUrl,
      },
    });
  } catch (err) {
    console.error("❌ CAPTURE DETECT ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to capture and detect frame",
    });
  }
});

/**
 * ======================================================
 * 🏫 Get police stations for authenticated users
 * ======================================================
 */
router.get("/police-stations", verifyToken, async (req, res) => {
  try {
    const role = req.user?.role;
    const uid = req.user?.uid;
    let snap;

    if (role === "field_operator") {
      const fieldOperatorSnap = await admin
        .firestore()
        .collection("field_operator")
        .doc(uid)
        .get();

      if (!fieldOperatorSnap.exists) {
        return res.status(200).json([]);
      }

      const fieldOperator = fieldOperatorSnap.data() || {};
      const creatorAdminUid = fieldOperator.createdBy;

      if (!creatorAdminUid) {
        return res.status(200).json([]);
      }

      snap = await admin
        .firestore()
        .collection("policeStations")
        .where("createdBy", "==", creatorAdminUid)
        .get();
    } else {
      snap = await admin.firestore().collection("policeStations").get();
    }

    const stations = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json(stations);
  } catch (err) {
    console.error("❌ POLICE STATIONS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch police stations",
    });
  }
});

/**
 * ======================================================
 * � GET MY CAMERAS (FIELD OPERATOR)
 * Fetch all cameras submitted by the logged-in field operator
 * ======================================================
 */
router.get("/my-cameras", verifyToken, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = req.user?.role;

    // Verify user is a field operator
    if (role !== "field_operator") {
      return res.status(403).json({
        success: false,
        message: "Only field operators can view their cameras",
      });
    }

    const snap = await admin
      .firestore()
      .collection("cameras")
      .where("addedBy", "==", uid)
      .get();

    const cameras = snap.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => {
        const aMs = a.createdAt?.toMillis?.() || 0;
        const bMs = b.createdAt?.toMillis?.() || 0;
        return bMs - aMs;
      });

    return res.status(200).json({
      success: true,
      cameras,
      total: cameras.length,
    });
  } catch (err) {
    console.error("❌ GET MY CAMERAS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cameras",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

/**
 * ======================================================
 * ✅ GET APPROVED CAMERAS (FIELD OPERATOR)
 * Return only approved cameras owned by current field operator
 * ======================================================
 */
router.get("/approved-cameras", verifyToken, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = req.user?.role;

    if (role !== "field_operator") {
      return res.status(403).json({
        success: false,
        message: "Only field operators can view approved cameras",
      });
    }

    const snap = await admin
      .firestore()
      .collection("cameras")
      .where("addedBy", "==", uid)
      .where("status", "==", "approved")
      .get();

    const cameras = snap.docs
      .map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          ...data,
          esp32Configured: Boolean(data?.esp32?.configured),
          esp32StreamUrl: data?.esp32?.streamUrl || data?.esp32StreamUrl || null,
          esp32CaptureUrl: data?.esp32?.captureUrl || data?.esp32CaptureUrl || null,
          lastConfiguredAt: serializeTimestamp(data?.esp32?.updatedAt),
        };
      })
      .sort((a, b) => {
        const aMs = a.approvedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const bMs = b.approvedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return bMs - aMs;
      });

    return res.status(200).json({
      success: true,
      cameras,
      total: cameras.length,
    });
  } catch (err) {
    console.error("❌ GET APPROVED CAMERAS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch approved cameras",
    });
  }
});

/**
 * ======================================================
 * 🔌 ASSIGN ESP32 CONFIG (FIELD OPERATOR)
 * Bind approved camera to ESP32 host + generate device token
 * ======================================================
 */
router.post("/assign-esp32", verifyToken, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = req.user?.role;

    if (role !== "field_operator") {
      return res.status(403).json({
        success: false,
        message: "Only field operators can assign ESP32 config",
      });
    }

    const {
      cameraId,
      esp32Ip,
      streamPath = "/stream",
      capturePath = "/capture",
      uploadIntervalSec = 10,
    } = req.body || {};

    if (!cameraId || !esp32Ip) {
      return res.status(400).json({
        success: false,
        message: "cameraId and esp32Ip are required",
      });
    }

    const cameraRef = admin.firestore().collection("cameras").doc(String(cameraId));
    const cameraSnap = await cameraRef.get();

    if (!cameraSnap.exists) {
      return res.status(404).json({
        success: false,
        message: "Camera not found",
      });
    }

    const cameraData = cameraSnap.data() || {};
    if (cameraData.addedBy !== uid) {
      return res.status(403).json({
        success: false,
        message: "You can only configure cameras submitted by your account",
      });
    }

    if (cameraData.status !== "approved" || cameraData.active === false) {
      return res.status(400).json({
        success: false,
        message: "Camera must be approved and active before ESP32 assignment",
      });
    }

    const host = normalizeDeviceHost(esp32Ip);
    if (!host) {
      return res.status(400).json({
        success: false,
        message: "Invalid esp32Ip value",
      });
    }

    const normalizedStreamPath = toRoutePath(streamPath, "/stream");
    const normalizedCapturePath = toRoutePath(capturePath, "/capture");

    const streamUrl = `http://${host}${normalizedStreamPath}`;
    const captureUrl = `http://${host}${normalizedCapturePath}`;

    const numericInterval = Number(uploadIntervalSec);
    const intervalSec = Number.isFinite(numericInterval)
      ? Math.max(2, Math.min(120, Math.floor(numericInterval)))
      : 10;

    const existingToken = cameraData?.esp32?.deviceToken || cameraData?.deviceToken;
    const deviceToken = existingToken || crypto.randomBytes(24).toString("hex");

    const backendBaseUrl = resolveBackendBaseUrl(req);
    const uploadUrl = `${backendBaseUrl}/api/detect/esp32-image`;

    await cameraRef.update({
      esp32: {
        configured: true,
        ipAddress: host,
        streamUrl,
        captureUrl,
        streamPath: normalizedStreamPath,
        capturePath: normalizedCapturePath,
        uploadIntervalSec: intervalSec,
        deviceToken,
        updatedBy: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      esp32StreamUrl: streamUrl,
      esp32CaptureUrl: captureUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "ESP32 camera configuration saved",
      camera: {
        cameraId: cameraSnap.id,
        cameraName: cameraData.cameraName || cameraData.name || "Unnamed Camera",
        location: cameraData.location || cameraData.area || "Unknown",
      },
      esp32: {
        ipAddress: host,
        streamUrl,
        captureUrl,
        uploadIntervalSec: intervalSec,
      },
      uploadConfig: {
        uploadUrl,
        cameraId: cameraSnap.id,
        deviceToken,
        imageFieldName: "image",
      },
      arduinoConfig: {
        CAMERA_ID: cameraSnap.id,
        BACKEND_UPLOAD_URL: uploadUrl,
        DEVICE_TOKEN: deviceToken,
        UPLOAD_INTERVAL_MS: intervalSec * 1000,
      },
    });
  } catch (err) {
    console.error("❌ ASSIGN ESP32 ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to assign ESP32 config",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

/**
 * ======================================================
 * �📷 SUBMIT CAMERA (FIELD OPERATOR)
 * Field operators submit cameras for admin approval
 * ======================================================
 */
router.post("/submit-camera", verifyToken, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const role = req.user?.role;

    // Verify user is a field operator
    if (role !== "field_operator") {
      return res.status(403).json({
        success: false,
        message: "Only field operators can submit cameras",
      });
    }

    const {
      cameraName,
      location,
      latitude,
      longitude,
      policeStationId,
      policeStationName,
      description,
    } = req.body;

    // Validate required fields
    if (
      !cameraName ||
      !location ||
      latitude === undefined ||
      longitude === undefined ||
      !policeStationId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "cameraName, location, latitude, longitude, and policeStationId are required",
      });
    }

    // Validate coordinates
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must be valid numbers",
      });
    }

    // Verify police station exists and belongs to field operator's creator
    const policeStationSnap = await admin
      .firestore()
      .collection("policeStations")
      .doc(policeStationId)
      .get();

    if (!policeStationSnap.exists) {
      return res.status(404).json({
        success: false,
        message: "Police station not found",
      });
    }

    const fieldOperatorSnap = await admin
      .firestore()
      .collection("field_operator")
      .doc(uid)
      .get();

    if (!fieldOperatorSnap.exists) {
      return res.status(403).json({
        success: false,
        message: "Field operator record not found",
      });
    }

    const creatorAdminUid = fieldOperatorSnap.data()?.createdBy;
    const stationCreator = policeStationSnap.data()?.createdBy;

    if (creatorAdminUid !== stationCreator) {
      return res.status(403).json({
        success: false,
        message:
          "You can only submit cameras to police stations from your admin",
      });
    }

    // Create camera document
    const cameraRef = admin.firestore().collection("cameras").doc();

    const cameraPayload = {
      cameraId: cameraRef.id,
      cameraName: cameraName.trim(),
      location: location.trim(),
      latitude: lat,
      longitude: lng,
      policeStationId,
      policeStationName: policeStationName || policeStationSnap.data()?.stationName,
      description: description ? description.trim() : "",
      fieldOperatorId: uid,
      fieldOperatorName: fieldOperatorSnap.data().name || fieldOperatorSnap.data().email || "Unknown",
      addedBy: uid,
      addedByName: fieldOperatorSnap.data().name || fieldOperatorSnap.data().email || "Unknown",
      status: "pending",
      approvedBy: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),

      // Backward-compatible fields
      name: cameraName.trim(),
      area: location.trim(),
      active: false,
    };

    await cameraRef.set(cameraPayload);

    // Log the activity
    await admin.firestore().collection("operatorLogs").doc().set({
      operatorUid: uid,
      operatorEmail: req.user.email,
      action: "CAMERA_SUBMITTED",
      description: `Field operator submitted camera: ${cameraName}`,
      cameraId: cameraRef.id,
      metadata: {
        location,
        policeStationId,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      success: true,
      message: "Camera submitted successfully. Waiting for admin approval.",
      cameraId: cameraRef.id,
    });
  } catch (err) {
    console.error("❌ SUBMIT CAMERA ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to submit camera",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

module.exports = router;
