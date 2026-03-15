"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ROLES } from "@/lib/roles";
import IncidentMap from "@/components/IncidentMap";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

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

      const incidentSnap = await getDocs(collection(db, "incidents"));
      const allIncidents = incidentSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setIncidents(allIncidents);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

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