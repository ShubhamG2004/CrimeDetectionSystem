"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";


export default function AdminDashboard() {
  const router = useRouter();
  const checkedRef = useRef(false);

  useEffect(() => {
    // ✅ ensure this effect runs only once
    if (checkedRef.current) return;
    checkedRef.current = true;

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const role = localStorage.getItem("role");
      if (role !== ROLES.ADMIN) {
        router.replace("/dashboard");
      }
    });

    return () => unsub();
  }, [router]); // ✅ dependency array NEVER changes

  return (
    <div className="app-shell flex">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="🛠️ Admin Control Dashboard" />

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <a
            href="/dashboard/admin/live-monitoring"
            className="app-card p-6 transition hover:shadow-md"
          >
            <h3 className="font-semibold text-lg text-slate-900">👮 Live Monitoring</h3>
            <p className="text-sm text-slate-600">
              View real-time crime alerts
            </p>
          </a>

          <a
            href="/analytics"
            className="app-card p-6 transition hover:shadow-md"
          >
            <h3 className="font-semibold text-lg text-slate-900">📊 Analytics</h3>
            <p className="text-sm text-slate-600">
              Crime trends & statistics
            </p>
          </a>

          <a
            href="/dashboard/admin/cameras"
            className="app-card p-6 transition hover:shadow-md"
          >
            <h3 className="font-semibold text-lg text-slate-900">🎥 Camera Management</h3>
            <p className="text-sm text-slate-600">
              Review pending submissions and approve active cameras
            </p>
          </a>

          <a
            href="/dashboard/admin/field-operators"
            className="app-card p-6 transition hover:shadow-md"
          >
            <h3 className="font-semibold text-lg text-slate-900">🧑‍🔧 Field Operators</h3>
            <p className="text-sm text-slate-600">
              Create and manage camera installation staff
            </p>
          </a>
        </div>
      </div>
    </div>
  );
}
