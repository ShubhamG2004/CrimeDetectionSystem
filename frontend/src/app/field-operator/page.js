"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import FieldOperatorSidebar from "@/components/FieldOperatorSidebar";

export default function FieldOperatorDashboard() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

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

      const buildCounters = (items) => {
        const counters = {
          total: items.length,
          pending: 0,
          approved: 0,
          rejected: 0,
        };

        items.forEach((item) => {
          const status = item?.status || "pending";
          if (status === "approved") counters.approved += 1;
          else if (status === "rejected") counters.rejected += 1;
          else counters.pending += 1;
        });

        return counters;
      };

      try {
        // Refresh token before Firestore calls, especially after role changes.
        await user.getIdToken(true);

        const snap = await getDocs(
          query(collection(db, "cameras"), where("addedBy", "==", user.uid))
        );

        const cameras = snap.docs.map((docSnap) => docSnap.data());
        setSummary(buildCounters(cameras));
        setError("");
      } catch (error) {
        console.error("Failed to load field operator summary:", error);
        const isPermissionDenied = (error?.code || "").includes("permission-denied");

        if (isPermissionDenied) {
          try {
            // Fallback via backend Admin SDK path when client Firestore rules deny reads.
            const token = await user.getIdToken();
            const res = await fetch("http://localhost:5000/api/cameras", {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!res.ok) {
              throw new Error(`HTTP_${res.status}`);
            }

            const allCameras = await res.json();
            const myCameras = Array.isArray(allCameras)
              ? allCameras.filter((camera) => camera?.addedBy === user.uid)
              : [];

            setSummary(buildCounters(myCameras));
            setError("");
            return;
          } catch (fallbackError) {
            console.error("Fallback summary load failed:", fallbackError);
          }
        }

        setError("Unable to load dashboard data right now. Please try again.");
      }
    });

    return () => unsub();
  }, [router]);

  return (
    <div className="app-shell flex">
      <FieldOperatorSidebar />

      <div className="flex-1">
        <Navbar title="Field Operator Dashboard" />

        {error && (
          <div className="px-6 pt-6">
            <div className="app-card p-4 text-rose-700">{error}</div>
          </div>
        )}

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="app-card p-5">
            <p className="text-sm text-slate-500">Total Submissions</p>
            <h3 className="text-2xl font-semibold text-slate-900 mt-1">{summary.total}</h3>
          </div>
          <div className="app-card p-5 border-l-4 border-amber-400">
            <p className="text-sm text-slate-500">Pending</p>
            <h3 className="text-2xl font-semibold text-amber-700 mt-1">{summary.pending}</h3>
          </div>
          <div className="app-card p-5 border-l-4 border-emerald-500">
            <p className="text-sm text-slate-500">Approved</p>
            <h3 className="text-2xl font-semibold text-emerald-700 mt-1">{summary.approved}</h3>
          </div>
          <div className="app-card p-5 border-l-4 border-rose-500">
            <p className="text-sm text-slate-500">Rejected</p>
            <h3 className="text-2xl font-semibold text-rose-700 mt-1">{summary.rejected}</h3>
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="app-card p-5">
            <h4 className="text-lg font-semibold text-slate-900">Next Actions</h4>
            <p className="text-slate-600 mt-2">Register new cameras from the field and track approval status from My Cameras.</p>
            <div className="mt-4 flex gap-3">
              <a href="/field-operator/add-camera" className="app-button">Add Camera</a>
              <a href="/field-operator/my-cameras" className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">My Cameras</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
