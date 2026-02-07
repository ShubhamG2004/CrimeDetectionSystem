"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import IncidentMap from "@/components/IncidentMap";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminMapPage() {
  const [incidents, setIncidents] = useState(null);

  useEffect(() => {
    const fetchIncidents = async () => {
      const snap = await getDocs(collection(db, "incidents"));
      setIncidents(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    };
    fetchIncidents();
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar />
      <div className="flex-1">
        <Navbar title="🌍 Admin Incident Map" />
        <div className="p-6">
          <IncidentMap incidents={incidents} />
        </div>
      </div>
    </div>
  );
}
