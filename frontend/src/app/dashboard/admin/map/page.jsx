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
      if (!user) {
        setLoading(false);
        return;
      }

      const tokenResult = await user.getIdTokenResult(true);
      const role = tokenResult.claims.role;

      const incidentSnap = await getDocs(collection(db, "incidents"));
      const allIncidents = incidentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      if (role === "admin") {
        setIncidents(allIncidents);
        setLoading(false);
        return;
      }

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

      const cameraSnaps = await Promise.all(
        cameraIds.map((id) => getDoc(doc(db, "cameras", id)))
      );

      const cameras = cameraSnaps
        .filter((snap) => snap.exists())
        .map((snap) => snap.data());

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
    <div className="flex h-screen overflow-hidden">
      
      {/* Sidebar - Static */}
      <div className="w-64 bg-white shadow-md overflow-hidden">
        <AdminSidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        
        {/* Navbar */}
        <div className="sticky top-0 z-10 bg-white shadow">
          <Navbar title="🌍 Incident Map" />
        </div>

        {/* Page Content - Static */}
        <div className="flex-1 p-6 bg-gray-100">
          <IncidentMap incidents={incidents} />
        </div>

      </div>
    </div>
  );
}