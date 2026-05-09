"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ROLES } from "@/lib/roles";
import IncidentMap from "@/components/IncidentMap";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
    <div className="app-shell">
      <AdminSidebar />

      <div>
        <Navbar title="Incident Map" />

        <div className="p-6 bg-slate-50">
          <IncidentMap incidents={incidents} />
        </div>
      </div>
    </div>
  );
}
