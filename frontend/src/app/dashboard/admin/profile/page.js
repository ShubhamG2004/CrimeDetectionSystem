"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";
import { auth, db } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import {
  Activity,
  CalendarDays,
  Clock3,
  Edit3,
  ImagePlus,
  KeyRound,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

const formatDate = (value) => {
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
};

const resolveStatusTone = (status) => {
  const normalized = (status || "active").toLowerCase();

  if (normalized === "suspended") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (normalized === "inactive") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const asDate = (value, fallback = null) => {
  if (!value) return fallback;

  try {
    if (value?.toDate) {
      return value.toDate();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  } catch (err) {
    console.warn("Failed to parse date", err);
    return fallback;
  }
};

const withFallbackArray = (value, fallback) =>
  Array.isArray(value) && value.length > 0 ? value : fallback;

const parseListField = (value = "") =>
  value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);

const formatDateOnly = (value) => {
  const parsed = asDate(value);
  if (!parsed) return "-";

  return parsed.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatInputDate = (value) => {
  const parsed = asDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : "";
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result?.toString() || "");
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

const getInitials = (value = "") => {
  const chunks = value.trim().split(/\s+/).filter(Boolean);
  if (!chunks.length) return "AD";
  return chunks
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");
};

export default function AdminProfilePage() {
  const router = useRouter();
  const photoInputRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    birthDate: "",
    responsibilities: "",
    permissions: "",
  });
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoData, setPhotoData] = useState("");
  const [photoCleared, setPhotoCleared] = useState(false);

  useEffect(() => {
    let mounted = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;

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

      const fallbackProfile = {
        uid: user.uid,
        name: user.displayName || "Administrator",
        email: user.email || "-",
        role: ROLES.ADMIN,
        status: "active",
        phone: user.phoneNumber || null,
        photoURL: user.photoURL || null,
        birthDate: null,
        location: null,
        organization: "City Command Center",
        createdAt: user.metadata?.creationTime
          ? new Date(user.metadata.creationTime)
          : null,
        lastLogin: user.metadata?.lastSignInTime
          ? new Date(user.metadata.lastSignInTime)
          : null,
        createdBy: "system",
        responsibilities: [
          "Threat oversight",
          "User provisioning",
          "Camera approvals",
        ],
        permissions: [
          "Full platform access",
          "Incident broadcast",
          "Role delegation",
        ],
      };

      try {
        const snap = await getDoc(doc(db, "users", user.uid));

        if (snap.exists()) {
          const data = snap.data() || {};
          setProfile({
            ...fallbackProfile,
            name:
              data.name ||
              data.displayName ||
              data.fullName ||
              fallbackProfile.name,
            email: data.email || fallbackProfile.email,
            role: data.role || fallbackProfile.role,
            status: data.status || fallbackProfile.status,
            phone: data.phone || data.phoneNumber || fallbackProfile.phone,
            location: data.location || data.office || fallbackProfile.location,
            organization:
              data.organization ||
              data.department ||
              fallbackProfile.organization,
            createdAt: asDate(data.createdAt, fallbackProfile.createdAt),
            birthDate: asDate(
              data.birthDate || data.birthdate,
              fallbackProfile.birthDate
            ),
            createdBy:
              data.createdByName ||
              data.createdBy ||
              data.createdVia ||
              fallbackProfile.createdBy,
            responsibilities: withFallbackArray(
              data.responsibilities,
              fallbackProfile.responsibilities
            ),
            permissions: withFallbackArray(
              data.permissions,
              fallbackProfile.permissions
            ),
            photoURL:
              data.photoURL ||
              data.photo ||
              data.avatar ||
              fallbackProfile.photoURL,
          });
        } else {
          setProfile(fallbackProfile);
        }

        setError("");
      } catch (err) {
        console.error("Failed to load admin profile:", err);

        const code = err?.code || "";
        const message = (err?.message || "").toLowerCase();
        const isPermissionDenied =
          code.includes("permission-denied") ||
          message.includes("missing or insufficient permissions");
        const isOffline =
          code.includes("unavailable") ||
          message.includes("offline") ||
          message.includes("could not reach cloud firestore backend");

        if (isPermissionDenied || isOffline) {
          setProfile(fallbackProfile);
          setError("");
        } else {
          setProfile(null);
          setError(
            "Unable to load the admin profile right now. Please refresh and try again."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [router]);

  useEffect(() => {
    if (!profile) return;

    setForm({
      name: profile.name || "",
      phone: profile.phone || "",
      birthDate: formatInputDate(profile.birthDate),
      responsibilities: profile.responsibilities?.join("\n") || "",
      permissions: profile.permissions?.join("\n") || "",
    });

    setPhotoPreview(profile.photoURL || "");
    setPhotoData("");
    setPhotoCleared(false);
    setFeedback(null);
  }, [profile]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoPick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setFeedback({ type: "error", message: "Photo must be smaller than 2 MB." });
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPhotoPreview(dataUrl);
      setPhotoData(dataUrl);
      setPhotoCleared(false);
      setFeedback(null);
    } catch (err) {
      console.error("Failed to load photo", err);
      setFeedback({ type: "error", message: "Could not read that file. Try another image." });
    }
  };

  const handlePhotoClear = () => {
    setPhotoPreview("");
    setPhotoData("");
    setPhotoCleared(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setFeedback(null);

    if (!profile) return;

    setForm({
      name: profile.name || "",
      phone: profile.phone || "",
      birthDate: formatInputDate(profile.birthDate),
      responsibilities: profile.responsibilities?.join("\n") || "",
      permissions: profile.permissions?.join("\n") || "",
    });

    setPhotoPreview(profile.photoURL || "");
    setPhotoData("");
    setPhotoCleared(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    setFeedback(null);

    try {
      const trimmedName = form.name.trim() || profile.name || "Administrator";
      const trimmedPhone = form.phone.trim();
      const birthDateIso = form.birthDate ? new Date(form.birthDate).toISOString() : null;
      const responsibilitiesList = parseListField(form.responsibilities);
      const permissionsList = parseListField(form.permissions);

      const payload = {
        name: trimmedName,
        phone: trimmedPhone || null,
        birthDate: birthDateIso,
        responsibilities: responsibilitiesList,
        permissions: permissionsList,
      };

      if (photoData) {
        payload.photoURL = photoData;
      } else if (photoCleared) {
        payload.photoURL = null;
      }

      await setDoc(doc(db, "users", profile.uid), payload, { merge: true });

      setProfile((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          name: trimmedName,
          phone: trimmedPhone || null,
          birthDate: birthDateIso ? new Date(birthDateIso) : null,
          responsibilities: responsibilitiesList,
          permissions: permissionsList,
          photoURL: photoData ? photoData : photoCleared ? null : prev.photoURL,
        };
      });

      setEditMode(false);
      setFeedback({ type: "success", message: "Profile updated successfully." });
    } catch (err) {
      console.error("Failed to update admin profile", err);
      setFeedback({ type: "error", message: "Unable to save changes right now." });
    } finally {
      setPhotoData("");
      setPhotoCleared(false);
      setSaving(false);
    }
  };

  return (
    <div className="app-shell flex min-h-screen bg-gradient-to-br from-white via-slate-50 to-white">
      <AdminSidebar />

      <div className="flex-1 min-w-0">
        <Navbar title="Admin Profile" />

        <main className="relative p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-black/5 via-slate-200/30 to-transparent blur-3xl" />

          {loading ? (
            <div className="app-card p-6 text-slate-600">Loading profile...</div>
          ) : error ? (
            <div className="app-card border border-rose-200 bg-rose-50 p-6 text-rose-700">
              {error}
            </div>
          ) : !profile ? (
            <div className="app-card p-6 text-slate-600">Profile not found.</div>
          ) : (
            <div className="space-y-6">
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <article className="app-card col-span-1 xl:col-span-2 border border-black/5 bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Admin Identity
                      </p>
                      <h1 className="mt-3 text-2xl font-semibold text-slate-900">
                        {profile.name}
                      </h1>
                      <p className="mt-1 text-sm text-slate-600">
                        {profile.role === ROLES.ADMIN
                          ? "System Administrator"
                          : profile.role || "Admin"}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs font-semibold ${resolveStatusTone(
                        profile.status
                      )}`}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {(profile.status || "active").toUpperCase()}
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                      <Mail className="h-5 w-5 text-slate-500" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {profile.email || "-"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                      <Phone className="h-5 w-5 text-slate-500" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Contact</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {profile.phone || "Not provided"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                      <MapPin className="h-5 w-5 text-slate-500" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Location</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {profile.location || "Not specified"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                      <Activity className="h-5 w-5 text-slate-500" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Organization</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {profile.organization}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>

                <article className="app-card border border-black/5 bg-white p-6">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-5 w-5 text-slate-500" />
                    <h3 className="text-base font-semibold text-slate-900">
                      Account Timeline
                    </h3>
                  </div>

                  <div className="mt-4 space-y-4 text-sm text-slate-600">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Created At
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formatDate(profile.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Last Login
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formatDate(profile.lastLogin)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Created By
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {profile.createdBy || "system"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        User ID
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-900 break-all">
                        {profile.uid}
                      </p>
                    </div>
                  </div>
                </article>
              </section>

              <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <article className="app-card border border-black/5 bg-white p-6 lg:col-span-1">
                  <h3 className="text-base font-semibold text-slate-900">
                    Command Footprint
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Contact and deployment context for this administrator.
                  </p>

                  <dl className="mt-5 space-y-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Organization</dt>
                      <dd className="font-medium text-slate-900">
                        {profile.organization}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Operational Region</dt>
                      <dd className="font-medium text-slate-900">
                        {profile.location || "Undisclosed"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Primary Contact</dt>
                      <dd className="font-medium text-slate-900">
                        {profile.phone || profile.email || "-"}
                      </dd>
                    </div>
                  </dl>
                </article>

                <article className="app-card border border-black/5 bg-white p-6 lg:col-span-1">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-slate-500" />
                    <h3 className="text-base font-semibold text-slate-900">
                      Responsibilities
                    </h3>
                  </div>

                  {profile.responsibilities?.length ? (
                    <ul className="mt-4 space-y-2 text-sm text-slate-700">
                      {profile.responsibilities.map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">
                      No responsibilities listed.
                    </p>
                  )}
                </article>

                <article className="app-card border border-black/5 bg-white p-6 lg:col-span-1">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-slate-500" />
                    <h3 className="text-base font-semibold text-slate-900">
                      Security & Access
                    </h3>
                  </div>

                  {profile.permissions?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {profile.permissions.map((permission) => (
                        <span
                          key={permission}
                          className="rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold text-white"
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">
                      No permissions recorded.
                    </p>
                  )}
                </article>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
