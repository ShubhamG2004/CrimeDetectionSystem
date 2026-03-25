"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import FieldOperatorSidebar from "@/components/FieldOperatorSidebar";

function getStatusClass(status) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

export default function MyCamerasPage() {
  const router = useRouter();

  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const role = localStorage.getItem("role");
      if (role !== ROLES.FIELD_OPERATOR) {
        router.replace("/dashboard");
        return;
      }

      try {
        const token = await user.getIdToken();
        const response = await fetch(
          "http://localhost:5000/api/operator/my-cameras",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch cameras`);
        }

        const data = await response.json();
        setCameras(data.cameras || []);
      } catch (error) {
        console.error("Failed to fetch cameras:", error);
        setCameras([]);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    cameras.forEach((camera) => {
      if (camera.status === "approved") approved += 1;
      else if (camera.status === "rejected") rejected += 1;
      else pending += 1;
    });

    return { pending, approved, rejected };
  }, [cameras]);

  return (
    <div className="app-shell flex">
      <FieldOperatorSidebar />

      <div className="flex-1">
        <Navbar title="My Camera Submissions" />

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="app-card p-4 border-l-4 border-amber-400">
              <p className="text-sm text-slate-500">Pending</p>
              <p className="text-2xl font-semibold text-amber-700">{counts.pending}</p>
            </div>
            <div className="app-card p-4 border-l-4 border-emerald-500">
              <p className="text-sm text-slate-500">Approved</p>
              <p className="text-2xl font-semibold text-emerald-700">{counts.approved}</p>
            </div>
            <div className="app-card p-4 border-l-4 border-rose-500">
              <p className="text-sm text-slate-500">Rejected</p>
              <p className="text-2xl font-semibold text-rose-700">{counts.rejected}</p>
            </div>
          </div>

          <div className="app-card overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 text-slate-700 text-sm">
                <tr>
                  <th className="p-3 text-left">Camera Name</th>
                  <th className="p-3 text-left">Location</th>
                  <th className="p-3 text-left">Police Station</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 text-sm">
                {!loading && cameras.map((cam) => (
                  <tr key={cam.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="p-3 font-medium">{cam.cameraName || cam.name}</td>
                    <td className="p-3">{cam.location || cam.area}</td>
                    <td className="p-3">{cam.policeStationName || "-"}</td>
                    <td className="p-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusClass(cam.status)}`}>
                        {(cam.status || "pending").toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {loading && (
              <p className="p-6 text-center text-slate-500">Loading cameras...</p>
            )}
            {!loading && cameras.length === 0 && (
              <p className="p-6 text-center text-slate-500">No cameras submitted yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
