"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

export default function ApprovedCamerasPage() {
  const router = useRouter();
  const checkedRef = useRef(false);

  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.replace("/login");
      if (localStorage.getItem("role") !== ROLES.ADMIN) return router.replace("/dashboard");

      try {
        const snap = await getDocs(
          query(collection(db, "cameras"), where("status", "==", "approved"))
        );

        setCameras(
          snap.docs
            .map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data(),
            }))
            .sort((a, b) => {
              const aMs = a.approvedAt?.toMillis?.() || 0;
              const bMs = b.approvedAt?.toMillis?.() || 0;
              return bMs - aMs;
            })
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  return (
    <div className="app-shell flex">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="Approved Cameras" />

        <div className="p-6 space-y-4">
          <div className="app-card p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Active Camera Fleet</h2>
              <p className="text-slate-600 text-sm mt-1">These cameras are approved and ready for monitoring workflows.</p>
            </div>
            <a href="/dashboard/admin/cameras/pending" className="app-button">
              Review Pending
            </a>
          </div>

          <div className="app-card overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 text-slate-700 text-sm">
                <tr>
                  <th className="p-3 text-left">Camera Name</th>
                  <th className="p-3 text-left">Location</th>
                  <th className="p-3 text-left">Field Operator</th>
                  <th className="p-3 text-center">Latitude</th>
                  <th className="p-3 text-center">Longitude</th>
                  <th className="p-3 text-center">Approved By</th>
                </tr>
              </thead>

              <tbody className="text-slate-800 text-sm">
                {!loading && cameras.map((cam) => (
                  <tr key={cam.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="p-3 font-medium">{cam.cameraName || cam.name}</td>
                    <td className="p-3">{cam.location || cam.area || "-"}</td>
                    <td className="p-3">{cam.fieldOperatorName || "Unknown"}</td>
                    <td className="p-3 text-center">{cam.latitude ?? "-"}</td>
                    <td className="p-3 text-center">{cam.longitude ?? "-"}</td>
                    <td className="p-3 text-center">{cam.approvedByName || cam.approvedBy || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {loading && <p className="p-6 text-center text-slate-600 font-medium">Loading approved cameras...</p>}
            {!loading && cameras.length === 0 && (
              <p className="p-6 text-center text-slate-600 font-medium">No approved cameras found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
