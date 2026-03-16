"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import { doc, getDoc } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import OperatorSidebar from "@/components/OperatorSidebar";

function formatDate(value) {
  if (!value) return "-";

  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OperatorProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const role = localStorage.getItem("role");
      if (role !== ROLES.OPERATOR) {
        router.replace("/dashboard");
        return;
      }

      try {
        const snap = await getDoc(doc(db, "operators", user.uid));
        if (!snap.exists()) {
          router.replace("/dashboard/operator");
          return;
        }

        setProfile({ uid: snap.id, ...snap.data() });
      } catch (error) {
        console.error("Failed to load operator profile:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  return (
    <div className="app-shell flex">
      <OperatorSidebar />

      <div className="flex-1">
        <Navbar title="Operator Profile" />

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="app-card p-6 text-slate-600">Loading profile...</div>
          ) : !profile ? (
            <div className="app-card p-6 text-rose-700">Profile not found.</div>
          ) : (
            <>
              <div className="app-card p-6">
                <h2 className="text-xl font-semibold text-slate-900">Account Details</h2>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="mt-1 text-slate-900 font-medium">{profile.email || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Role</p>
                    <p className="mt-1 text-slate-900 font-medium">Operator</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Status</p>
                    <p className="mt-1 text-slate-900 font-medium capitalize">{profile.status || "active"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Created At</p>
                    <p className="mt-1 text-slate-900 font-medium">{formatDate(profile.createdAt)}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-slate-500">User ID</p>
                    <p className="mt-1 text-slate-900 font-medium break-all">{profile.uid}</p>
                  </div>
                </div>
              </div>

              <div className="app-card p-6">
                <h3 className="text-lg font-semibold text-slate-900">Assigned Cameras</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Total Assigned: {Array.isArray(profile.cameras) ? profile.cameras.length : 0}
                </p>

                {Array.isArray(profile.cameras) && profile.cameras.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.cameras.map((cameraId) => (
                      <span
                        key={cameraId}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        {cameraId}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">No cameras assigned yet.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
