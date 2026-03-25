"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Briefcase,
  Globe,
  User,
  AlertCircle,
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
    } finally {
      event.target.value = "";
    }
  };

  const handlePhotoClear = () => {
    setPhotoPreview("");
    setPhotoData("");
    setPhotoCleared(true);
  };

  const handleCancelEdit = useCallback(() => {
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
  }, [profile]);

  useEffect(() => {
    if (!editMode) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        handleCancelEdit();
      }
    };

    window.addEventListener("keydown", handleKeydown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [editMode, handleCancelEdit]);

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
    <div className="flex min-h-screen bg-gradient-to-br from-white via-slate-50 to-white">
      <AdminSidebar />

      <div className="flex-1 min-w-0">
        <Navbar title="Admin Profile" />

        <main className="relative p-4 sm:p-6 lg:p-8">
          {loading ? (
            <div className="rounded-2xl border border-black/5 bg-white p-8 text-center">
              <div className="inline-flex h-12 w-12 animate-pulse rounded-full bg-slate-200" />
              <p className="mt-4 text-slate-600">Loading profile...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-rose-600" />
                <p className="text-rose-700">{error}</p>
              </div>
            </div>
          ) : !profile ? (
            <div className="rounded-2xl border border-black/5 bg-white p-8 text-center text-slate-600">
              Profile not found.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Section */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                    Profile Settings
                  </h1>
                  <p className="mt-1 text-slate-500">
                    Manage your personal information and administrative credentials
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => (editMode ? handleCancelEdit() : setEditMode(true))}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Edit3 className="h-4 w-4" />
                  {editMode ? "Cancel Editing" : "Edit Profile"}
                </button>
              </div>

              {/* Feedback Message */}
              {feedback?.message && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                    feedback.type === "error"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              {/* Profile Overview Card */}
              <div className="rounded-2xl border border-black/5 bg-white p-6">
                <div className="flex flex-wrap items-start gap-6">
                  <div className="relative">
                    <div className="h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                      {photoPreview || profile.photoURL ? (
                        <img
                          src={photoPreview || profile.photoURL || ""}
                          alt="Admin avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-slate-600">
                          {getInitials(profile.name)}
                        </div>
                      )}
                    </div>
                    <span
                      className={`absolute -bottom-1 -right-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${resolveStatusTone(
                        profile.status
                      )}`}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {(profile.status || "active").slice(0, 3)}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">{profile.name}</h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {profile.role === ROLES.ADMIN
                            ? "System Administrator"
                            : profile.role || "Admin"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-600">{profile.email || "-"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-600">{profile.phone || "Not provided"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-600">{profile.organization}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-600">{profile.location || "Not specified"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Account Timeline */}
                <div className="rounded-2xl border border-black/5 bg-white p-6 lg:col-span-1">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock3 className="h-5 w-5 text-slate-500" />
                    <h3 className="text-base font-semibold text-slate-900">Account Timeline</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500">Created</p>
                      <p className="mt-1 font-medium text-slate-900">{formatDate(profile.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500">Last Login</p>
                      <p className="mt-1 font-medium text-slate-900">{formatDate(profile.lastLogin)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500">Created By</p>
                      <p className="mt-1 font-medium text-slate-900">{profile.createdBy || "system"}</p>
                    </div>
                  </div>
                </div>

                {/* Responsibilities */}
                <div className="rounded-2xl border border-black/5 bg-white p-6 lg:col-span-1">
                  <div className="flex items-center gap-2 mb-4">
                    <UserCheck className="h-5 w-5 text-slate-500" />
                    <h3 className="text-base font-semibold text-slate-900">Responsibilities</h3>
                  </div>
                  {profile.responsibilities?.length ? (
                    <ul className="space-y-2">
                      {profile.responsibilities.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">No responsibilities listed.</p>
                  )}
                </div>

                {/* Permissions */}
                <div className="rounded-2xl border border-black/5 bg-white p-6 lg:col-span-1">
                  <div className="flex items-center gap-2 mb-4">
                    <KeyRound className="h-5 w-5 text-slate-500" />
                    <h3 className="text-base font-semibold text-slate-900">Security Permissions</h3>
                  </div>
                  {profile.permissions?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.permissions.map((permission) => (
                        <span
                          key={permission}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No permissions recorded.</p>
                  )}
                </div>
              </div>

            </div>
          )}
        </main>
        {editMode && profile && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-10 backdrop-blur-sm">
            <div className="relative w-full max-w-3xl">
              <form
                onSubmit={handleSave}
                className="relative max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl ring-1 ring-black/5 sm:p-8"
              >
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-800"
                  aria-label="Close edit profile"
                >
                  <span className="text-lg">×</span>
                </button>

                <div className="mb-6 flex items-start gap-3 pr-12">
                  <div className="rounded-2xl bg-slate-900/5 p-3 text-slate-900">
                    <Edit3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Edit Profile</p>
                    <h3 className="text-2xl font-semibold text-slate-900">Personal & Clearance Details</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Update personal information, administrative scope, and portrait without leaving the dashboard.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {photoPreview || profile.photoURL ? (
                      <img
                        src={photoPreview || profile.photoURL || ""}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500">
                        {getInitials(profile.name)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black"
                    >
                      <ImagePlus className="h-4 w-4" />
                      Upload Photo
                    </button>
                    {(photoPreview || profile.photoURL) && (
                      <button
                        type="button"
                        onClick={handlePhotoClear}
                        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-rose-200 hover:text-rose-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoPick}
                  />
                  <p className="ml-auto text-xs text-slate-400">PNG or JPG, max 2 MB</p>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone Number</label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      placeholder="+1 555 0100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Birth Date</label>
                    <input
                      type="date"
                      name="birthDate"
                      value={form.birthDate}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Account Status</label>
                    <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600">
                      {(profile.status || "active").toUpperCase()}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Responsibilities <span className="text-xs font-normal text-slate-400">(one per line)</span>
                    </label>
                    <textarea
                      name="responsibilities"
                      value={form.responsibilities}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      placeholder="Threat oversight&#10;User provisioning&#10;Camera approvals"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Permissions <span className="text-xs font-normal text-slate-400">(one per line)</span>
                    </label>
                    <textarea
                      name="permissions"
                      value={form.permissions}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      placeholder="Full platform access&#10;Incident broadcast&#10;Role delegation"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Email and location are managed centrally
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="rounded-full border border-slate-200 px-6 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}