"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import IncidentMap from "@/components/IncidentMap";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminMapPage() {
  const [incidents, setIncidents] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      // 🔐 Get REAL role from token
      const tokenResult = await user.getIdTokenResult(true);
      const role = tokenResult.claims.role;

      // 1️⃣ Fetch all incidents
      const incidentSnap = await getDocs(collection(db, "incidents"));
      const allIncidents = incidentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // 2️⃣ ADMIN → see all
      if (role === "admin") {
        setIncidents(allIncidents);
        setLoading(false);
        return;
      }

      // 3️⃣ OPERATOR → restrict by camera areas
      const operatorSnap = await getDoc(
        doc(db, "operators", user.uid)
      );

      if (!operatorSnap.exists()) {
        setIncidents([]);
        setLoading(false);
        return;
      }

      const cameraIds = operatorSnap.data().cameras || [];

      if (cameraIds.length === 0) {
        setIncidents([]);
        setLoading(false);
        return;
      }

      // 4️⃣ Fetch assigned cameras
      const cameraSnaps = await Promise.all(
        cameraIds.map((id) => getDoc(doc(db, "cameras", id)))
      );

      const cameras = cameraSnaps
        .filter((snap) => snap.exists())
        .map((snap) => snap.data());

      // 5️⃣ Distance filter (~1km)
      const filteredIncidents = allIncidents.filter((incident) => {
        if (!incident.location) return false;

        return cameras.some((cam) => {
          const latDiff = Math.abs(
            incident.location.lat - cam.latitude
          );
          const lngDiff = Math.abs(
            incident.location.lng - cam.longitude
          );

          return latDiff < 0.01 && lngDiff < 0.01;
        });
      });

      setIncidents(filteredIncidents);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-600">
        ⏳ Loading map…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar />
      <div className="flex-1">
        <Navbar title="🌍 Incident Map" />
        <div className="p-6">
          <IncidentMap incidents={incidents} />
        </div>
      </div>
    </div>
  );
}
