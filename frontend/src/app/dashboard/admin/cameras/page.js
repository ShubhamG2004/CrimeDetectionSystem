"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

export default function CameraApprovalOverview() {
  const router = useRouter();
  const checkedRef = useRef(false);

  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.replace("/login");
      if (localStorage.getItem("role") !== ROLES.ADMIN) {
        return router.replace("/dashboard");
      }

      try {
        const snap = await getDocs(collection(db, "cameras"));
        setCameras(
          snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const counters = cameras.reduce(
    (acc, cam) => {
      const status = cam.status || "approved";
      if (status === "pending") acc.pending += 1;
      else if (status === "rejected") acc.rejected += 1;
      else acc.approved += 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0 }
  );

  const approvedCameras = cameras.filter(
    (cam) => (cam.status || "approved") === "approved"
  );

  return (
    <div className="app-shell flex">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="Camera Approval Management" />

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="app-card p-5 border-l-4 border-amber-400">
              <p className="text-sm text-slate-500">Pending Approval</p>
              <h3 className="text-2xl font-semibold text-amber-700 mt-1">{counters.pending}</h3>
            </div>

            <div className="app-card p-5 border-l-4 border-emerald-500">
              <p className="text-sm text-slate-500">Approved</p>
              <h3 className="text-2xl font-semibold text-emerald-700 mt-1">{counters.approved}</h3>
            </div>

            <div className="app-card p-5 border-l-4 border-rose-500">
              <p className="text-sm text-slate-500">Rejected</p>
              <h3 className="text-2xl font-semibold text-rose-700 mt-1">{counters.rejected}</h3>
            </div>
          </div>

          <div className="app-card p-5 flex flex-wrap gap-3">
            <a href="/dashboard/admin/cameras/pending" className="app-button">
              Review Pending Cameras
            </a>
            <a
              href="/dashboard/admin/cameras/approved"
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              View Approved Cameras
            </a>
          </div>

          <div className="overflow-x-auto app-card">
            <table className="w-full">
              <thead className="bg-slate-100 text-slate-700 text-sm">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Location</th>
                  <th className="p-3 text-left">Field Operator</th>
                  <th className="p-3 text-center">Lat</th>
                  <th className="p-3 text-center">Lng</th>
                </tr>
              </thead>

              <tbody className="text-slate-800 text-sm">
                {!loading && approvedCameras.map((cam) => (
                  <tr
                    key={cam.cameraId || cam.id}
                    className="border-t border-slate-100 hover:bg-slate-50/70"
                  >
                    <td className="p-3 font-medium">
                      {cam.cameraName || cam.name}
                    </td>
                    <td className="p-3">{cam.location || cam.area || "-"}</td>
                    <td className="p-3">{cam.fieldOperatorName || cam.addedByName || "Unknown"}</td>
                    <td className="p-3 text-center">{cam.latitude ?? "-"}</td>
                    <td className="p-3 text-center">{cam.longitude ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {loading && (
              <p className="p-6 text-center text-slate-600 font-medium">
                Loading cameras...
              </p>
            )}

            {!loading && approvedCameras.length === 0 && (
              <p className="p-6 text-center text-slate-600 font-medium">
                No approved cameras found
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
