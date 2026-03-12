const { db, admin } = require("../config/firebase");

const COLLECTION = "policeStations";

/* ─────────────────────────────────────────────────────
   Haversine distance (km) between two lat/lng points
───────────────────────────────────────────────────── */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ─────────────────────────────────────────────────────
   POST /api/admin/police-station  — Create
───────────────────────────────────────────────────── */
exports.createPoliceStation = async (req, res) => {
  try {
    const {
      stationName,
      stationCode,
      location = {},
      contactNumber,
      emergencyNumber,
      alertEmail,
      officerInCharge,
      jurisdictionRadius,
    } = req.body;

    if (!stationName || !contactNumber) {
      return res.status(400).json({
        success: false,
        message: "stationName and contactNumber are required",
      });
    }

    const data = {
      stationName: stationName.trim(),
      stationCode: stationCode?.trim() || null,
      location: {
        city: location.city?.trim() || null,
        area: location.area?.trim() || null,
        latitude:
          location.latitude !== undefined
            ? Number(location.latitude)
            : null,
        longitude:
          location.longitude !== undefined
            ? Number(location.longitude)
            : null,
      },
      contactNumber: contactNumber.trim(),
      emergencyNumber: emergencyNumber?.trim() || null,
      alertEmail: alertEmail?.trim() || null,
      officerInCharge: officerInCharge?.trim() || null,
      jurisdictionRadius:
        jurisdictionRadius !== undefined
          ? Number(jurisdictionRadius)
          : null,
      createdBy: req.user?.uid || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection(COLLECTION).add(data);

    return res.status(201).json({
      success: true,
      message: "Police Station created",
      data: { id: docRef.id, ...data },
    });
  } catch (err) {
    console.error("❌ createPoliceStation:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   GET /api/admin/police-stations  — List all
───────────────────────────────────────────────────── */
exports.listPoliceStations = async (req, res) => {
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .orderBy("createdAt", "desc")
      .get();

    const stations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ success: true, data: stations });
  } catch (err) {
    console.error("❌ listPoliceStations:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   GET /api/admin/police-station/:id  — Get one
───────────────────────────────────────────────────── */
exports.getPoliceStation = async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();

    if (!doc.exists) {
      return res
        .status(404)
        .json({ success: false, message: "Station not found" });
    }

    return res
      .status(200)
      .json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (err) {
    console.error("❌ getPoliceStation:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   PUT /api/admin/police-station/:id  — Update
───────────────────────────────────────────────────── */
exports.updatePoliceStation = async (req, res) => {
  try {
    const {
      stationName,
      stationCode,
      location = {},
      contactNumber,
      emergencyNumber,
      alertEmail,
      officerInCharge,
      jurisdictionRadius,
    } = req.body;

    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (stationName) updates.stationName = stationName.trim();
    if (stationCode !== undefined) updates.stationCode = stationCode?.trim() || null;
    if (contactNumber) updates.contactNumber = contactNumber.trim();
    if (emergencyNumber !== undefined) updates.emergencyNumber = emergencyNumber?.trim() || null;
    if (alertEmail !== undefined) updates.alertEmail = alertEmail?.trim() || null;
    if (officerInCharge !== undefined) updates.officerInCharge = officerInCharge?.trim() || null;
    if (jurisdictionRadius !== undefined)
      updates.jurisdictionRadius = Number(jurisdictionRadius);

    if (Object.keys(location).length > 0) {
      // Merge location fields individually to avoid overwriting existing subfields
      const current = await db.collection(COLLECTION).doc(req.params.id).get();
      if (!current.exists)
        return res.status(404).json({ success: false, message: "Station not found" });

      const existing = current.data().location || {};
      updates.location = {
        city:
          location.city !== undefined ? location.city.trim() : existing.city,
        area:
          location.area !== undefined ? location.area.trim() : existing.area,
        latitude:
          location.latitude !== undefined
            ? Number(location.latitude)
            : existing.latitude,
        longitude:
          location.longitude !== undefined
            ? Number(location.longitude)
            : existing.longitude,
      };
    }

    await db.collection(COLLECTION).doc(req.params.id).update(updates);

    return res.status(200).json({
      success: true,
      message: "Police Station updated",
    });
  } catch (err) {
    console.error("❌ updatePoliceStation:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   DELETE /api/admin/police-station/:id  — Delete
───────────────────────────────────────────────────── */
exports.deletePoliceStation = async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();

    if (!doc.exists) {
      return res
        .status(404)
        .json({ success: false, message: "Station not found" });
    }

    await db.collection(COLLECTION).doc(req.params.id).delete();

    return res
      .status(200)
      .json({ success: true, message: "Police Station deleted" });
  } catch (err) {
    console.error("❌ deletePoliceStation:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────
   Utility: findNearestStation(lat, lng)
   Returns the station object or null.
   Exported for use in detect.routes.js
───────────────────────────────────────────────────── */
exports.findNearestStation = async (lat, lng) => {
  if (lat == null || lng == null) return null;

  const snapshot = await db.collection(COLLECTION).get();
  if (snapshot.empty) return null;

  let nearest = null;
  let minDist = Infinity;

  snapshot.docs.forEach((doc) => {
    const s = doc.data();
    const sLat = s.location?.latitude;
    const sLng = s.location?.longitude;

    if (sLat == null || sLng == null) return;

    const dist = haversineKm(lat, lng, sLat, sLng);
    if (dist < minDist) {
      minDist = dist;
      nearest = { id: doc.id, distanceKm: Math.round(dist * 10) / 10, ...s };
    }
  });

  return nearest;
};
