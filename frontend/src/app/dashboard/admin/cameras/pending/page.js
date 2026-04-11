"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function PendingCamerasPage() {
  const router = useRouter();
  const checkedRef = useRef(false);

  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");

  const fetchPendingCameras = async () => {
    if (!auth.currentUser) return;

    const token = await auth.currentUser.getIdToken(true);
    const res = await fetch(`${API_BASE}/api/cameras`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to fetch cameras");
    }

    const camerasData = (Array.isArray(data) ? data : [])
      .map((camera) => ({
        id: camera.cameraId,
        ...camera,
      }))
      .filter((camera) => (camera.status || "pending") === "pending")
      .sort((a, b) => {
        const aMs = a.createdAt?.toMillis?.() || 0;
        const bMs = b.createdAt?.toMillis?.() || 0;
        return bMs - aMs;
      });

    setCameras(camerasData);
    console.log("Camera Data:", camerasData);
    setLoading(false);
  };

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.replace("/login");
      if (localStorage.getItem("role") !== ROLES.ADMIN) return router.replace("/dashboard");

      try {
        await fetchPendingCameras();
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const updateCameraStatus = async (camera, nextStatus) => {
    const cameraId = camera.id;
    if (!auth.currentUser) return;

    try {
      setActionLoadingId(cameraId);
      const updates = {
        status: nextStatus,
      };

      const token = await auth.currentUser.getIdToken(true);
      const res = await fetch(`${API_BASE}/api/cameras/${cameraId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to update camera status");
      }

      await fetchPendingCameras();
    } catch (error) {
      console.error("Failed to update camera status:", error);
      alert(error?.message || "Could not update camera status. Please retry.");
    } finally {
      setActionLoadingId("");
    }
  };

  return (
    <div className="app-shell flex">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="Pending Camera Approvals" />

        <div className="p-6 space-y-4">
          <div className="app-card p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Pending Submissions</h2>
              <p className="text-slate-600 text-sm mt-1">Review field-operator camera requests and approve or reject.</p>
            </div>
            <a
              href="/dashboard/admin/cameras/approved"
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              View Approved
            </a>
          </div>

          <div className="app-card overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 text-slate-700 text-sm">
                <tr>
                  <th className="p-3 text-left">Camera Name</th>
                  <th className="p-3 text-left">Location</th>
                  <th className="p-3 text-center">Field Operator</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="text-slate-800 text-sm">
                {!loading && cameras.map((cam) => (
                  <tr key={cam.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="p-3 font-medium">
                      {cam.cameraName || cam.name || "-"}
                    </td>
                    <td className="p-3">
                      {cam.location || "-"}
                    </td>
                    <td className="p-3 text-center">
                      {cam.fieldOperatorName || cam.addedByName || "Unknown"}
                    </td>
                    <td className="p-3 text-center space-x-2">
                      <button
                        onClick={() => updateCameraStatus(cam, "approved")}
                        disabled={actionLoadingId === cam.id}
                        className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateCameraStatus(cam, "rejected")}
                        disabled={actionLoadingId === cam.id}
                        className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {loading && <p className="p-6 text-center text-slate-600 font-medium">Loading pending cameras...</p>}
            {!loading && cameras.length === 0 && (
              <p className="p-6 text-center text-slate-600 font-medium">No pending cameras.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

