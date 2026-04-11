"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
<<<<<<< HEAD
import { auth } from "@/lib/firebase";
=======
import {
  collection,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
>>>>>>> 59bb784332c94aa99401ea1f39917d25316ef8f9
import { onAuthStateChanged } from "firebase/auth";
import { ROLES } from "@/lib/roles";
import IncidentMap from "@/components/IncidentMap";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

<<<<<<< HEAD
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

=======
>>>>>>> 59bb784332c94aa99401ea1f39917d25316ef8f9
export default function AdminMapPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        setLoading(false);
        return;
      }

      const role = localStorage.getItem("role");
      if (role !== ROLES.ADMIN) {
        router.replace("/dashboard");
        setLoading(false);
        return;
      }

<<<<<<< HEAD
      try {
        const token = await user.getIdToken(true);
        const res = await fetch(`${API_BASE}/api/incidents`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || "Failed to load incidents");
        }

        setIncidents(Array.isArray(data?.data) ? data.data : []);
      } catch (error) {
        console.error("Failed to load admin incidents:", error);
        setIncidents([]);
      } finally {
        setLoading(false);
      }
=======
      const incidentSnap = await getDocs(collection(db, "incidents"));
      const allIncidents = incidentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setIncidents(allIncidents);
      setLoading(false);
>>>>>>> 59bb784332c94aa99401ea1f39917d25316ef8f9
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="p-6 text-center text-slate-600">
        Loading map...
      </div>
    );
  }

  return (
<<<<<<< HEAD
    <div className="app-shell">
      <AdminSidebar />

      <div>
        <Navbar title="Incident Map" />

        <div className="p-6 bg-slate-50">
          <IncidentMap incidents={incidents} />
        </div>
=======
    <div className="flex h-screen overflow-hidden bg-slate-50">
      
      {/* Sidebar - Static */}
      <div className="w-64 bg-white border-r border-slate-200 overflow-hidden">
        <AdminSidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        
        {/* Navbar */}
        <div className="sticky top-0 z-10 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.06)]">
          <Navbar title="Incident Map" />
        </div>

        {/* Page Content - Static */}
        <div className="flex-1 p-6 bg-slate-50">
          <IncidentMap incidents={incidents} />
        </div>

>>>>>>> 59bb784332c94aa99401ea1f39917d25316ef8f9
      </div>
    </div>
  );
}