"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import { doc, getDoc } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import FieldOperatorSidebar from "@/components/FieldOperatorSidebar";

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

export default function FieldOperatorProfilePage() {
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
      if (role !== ROLES.FIELD_OPERATOR) {
        router.replace("/dashboard");
        return;
      }

      const fallbackCreatedAt = user?.metadata?.creationTime
        ? new Date(user.metadata.creationTime)
        : null;

      try {
        let snap;
        let usedFallback = false;

        try {
          snap = await getDoc(doc(db, "field_operator", user.uid));
        } catch (fieldOpErr) {
          // Backward-compatibility while some environments still enforce old users-based rules.
          if (fieldOpErr?.code === "permission-denied") {
            snap = await getDoc(doc(db, "users", user.uid));
            usedFallback = true;
          } else {
            throw fieldOpErr;
          }
        }

        if (!snap.exists() && !usedFallback) {
          // If not migrated yet, read legacy profile location.
          snap = await getDoc(doc(db, "users", user.uid));
        }

        if (!snap.exists()) {
          router.replace("/field-operator");
          return;
        }

        const data = snap.data();
        setProfile({
          uid: snap.id,
          ...data,
          createdAt: data?.createdAt || fallbackCreatedAt,
          createdBy: data?.createdByName || data?.createdBy || "system",
        });
      } catch (error) {
        console.error("Failed to load field operator profile:", error);

        const code = error?.code || "";
        const message = (error?.message || "").toLowerCase();
        const isPermissionDenied = code.includes("permission-denied") || message.includes("missing or insufficient permissions");
        const isOffline =
          code.includes("unavailable") ||
          code.includes("failed-precondition") ||
          message.includes("offline") ||
          message.includes("could not reach cloud firestore backend");

        if (isPermissionDenied) {
          setProfile({
            uid: user.uid,
            name: user.displayName || "-",
            email: user.email || "-",
            role: ROLES.FIELD_OPERATOR,
            status: "active",
            createdAt: fallbackCreatedAt,
            createdBy: "system",
          });
        } else if (isOffline) {
          setProfile({
            uid: user.uid,
            name: user.displayName || "-",
            email: user.email || "-",
            role: ROLES.FIELD_OPERATOR,
            status: "active",
            createdAt: fallbackCreatedAt,
            createdBy: "system",
          });
        } else {
          setProfile(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  return (
    <div className="app-shell flex">
      <FieldOperatorSidebar />

      <div className="flex-1">
        <Navbar title="Field Operator Profile" />

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="app-card p-6 text-slate-600">Loading profile...</div>
          ) : !profile ? (
            <div className="app-card p-6 text-rose-700">Profile not found.</div>
          ) : (
            <div className="app-card p-6">
              <h2 className="text-xl font-semibold text-slate-900">Account Details</h2>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Name</p>
                  <p className="mt-1 text-slate-900 font-medium">{profile.name || "-"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="mt-1 text-slate-900 font-medium">{profile.email || "-"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Role</p>
                  <p className="mt-1 text-slate-900 font-medium">Field Operator</p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <p className="mt-1 text-slate-900 font-medium capitalize">{profile.status || "active"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Created At</p>
                  <p className="mt-1 text-slate-900 font-medium">{formatDate(profile.createdAt)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Created By</p>
                  <p className="mt-1 text-slate-900 font-medium break-all">{profile.createdBy || "-"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
