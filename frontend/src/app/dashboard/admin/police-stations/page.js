"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import dynamic from "next/dynamic";
import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

const LocationPickerMap = dynamic(
  () => import("@/components/LocationPickerMap"),
  { ssr: false }
);

const API = "http://localhost:5000/api/admin";

const emptyForm = {
  stationName: "",
  stationCode: "",
  city: "",
  area: "",
  contactNumber: "",
  emergencyNumber: "",
  alertEmail: "",
  officerInCharge: "",
  jurisdictionRadius: "",
};

export default function PoliceStationsPage() {
  const router = useRouter();
  const checkedRef = useRef(false);

  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [pinLocation, setPinLocation] = useState(null); // { lat, lng }
  const [saving, setSaving] = useState(false);

  /* ─── AUTH GUARD ─── */
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    onAuthStateChanged(auth, (user) => {
      if (!user) return router.replace("/login");
      if (localStorage.getItem("role") !== ROLES.ADMIN)
        return router.replace("/dashboard");
      fetchStations();
    });
  }, [router]);

  /* ─── FETCH ─── */
  const fetchStations = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`${API}/police-stations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStations(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error("Failed to fetch stations", err);
    } finally {
      setLoading(false);
    }
  };

  /* ─── SAVE (CREATE / UPDATE) ─── */
  const saveStation = async () => {
    if (!form.stationName.trim() || !form.contactNumber.trim()) {
      alert("Station Name and Contact Number are required");
      return;
    }

    setSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();

      const payload = {
        stationName: form.stationName,
        stationCode: form.stationCode,
        location: {
          city: form.city,
          area: form.area,
          latitude: pinLocation?.lat ?? null,
          longitude: pinLocation?.lng ?? null,
        },
        contactNumber: form.contactNumber,
        emergencyNumber: form.emergencyNumber,
        alertEmail: form.alertEmail,
        officerInCharge: form.officerInCharge,
        jurisdictionRadius: form.jurisdictionRadius
          ? Number(form.jurisdictionRadius)
          : null,
      };

      const url = editingId
        ? `${API}/police-station/${editingId}`
        : `${API}/police-station`;

      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) return alert(data.message || "Save failed");

      closeModal();
      fetchStations();
    } catch (err) {
      console.error("Save error", err);
      alert("An error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  /* ─── DELETE ─── */
  const deleteStation = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    try {
      const token = await auth.currentUser.getIdToken();
      await fetch(`${API}/police-station/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchStations();
    } catch (err) {
      console.error("Delete error", err);
    }
  };

  /* ─── HELPERS ─── */
  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({
      stationName: s.stationName || "",
      stationCode: s.stationCode || "",
      city: s.location?.city || "",
      area: s.location?.area || "",
      contactNumber: s.contactNumber || "",
      emergencyNumber: s.emergencyNumber || "",
      alertEmail: s.alertEmail || "",
      officerInCharge: s.officerInCharge || "",
      jurisdictionRadius: s.jurisdictionRadius ?? "",
    });
    const lat = s.location?.latitude;
    const lng = s.location?.longitude;
    setPinLocation(lat != null && lng != null ? { lat, lng } : null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setPinLocation(null);
  };

  const field = (key, placeholder, type = "text") => (
    <input
      type={type}
      className="app-input mb-2"
      placeholder={placeholder}
      value={form[key]}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
    />
  );

  /* ─── RENDER ─── */
  return (
    <div className="app-shell flex">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="🚓 Police Stations" />

        <div className="p-6">
          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="app-badge">Alert Routing</div>
              <h2 className="text-2xl font-semibold text-slate-900 mt-2">
                Police Stations
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Registered stations receive alerts based on proximity to
                crime location.
              </p>
            </div>
            <button
              onClick={() => {
                setForm(emptyForm);
                setEditingId(null);
                setShowModal(true);
              }}
              className="app-button"
            >
              ➕ Add Station
            </button>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto app-card">
            <table className="w-full">
              <thead className="bg-slate-100 text-slate-700 text-sm">
                <tr>
                  <th className="p-3 text-left">Station Name</th>
                  <th className="p-3 text-left">Code</th>
                  <th className="p-3 text-left">Location</th>
                  <th className="p-3 text-left">Contact</th>
                  <th className="p-3 text-left">Officer</th>
                  <th className="p-3 text-center">Radius (km)</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="text-slate-800 text-sm">
                {stations.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-slate-100 hover:bg-slate-50/70"
                  >
                    <td className="p-3 font-medium">{s.stationName}</td>
                    <td className="p-3 text-slate-500">
                      {s.stationCode || "—"}
                    </td>
                    <td className="p-3">
                      <span className="font-medium">
                        {s.location?.area || "—"}
                      </span>
                      {s.location?.city && (
                        <span className="text-slate-400">
                          , {s.location.city}
                        </span>
                      )}
                      {s.location?.latitude != null && (
                        <div className="text-xs text-slate-400">
                          {s.location.latitude}, {s.location.longitude}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div>{s.contactNumber}</div>
                      {s.emergencyNumber && (
                        <div className="text-xs text-rose-600">
                          🚨 {s.emergencyNumber}
                        </div>
                      )}
                    </td>
                    <td className="p-3">{s.officerInCharge || "—"}</td>
                    <td className="p-3 text-center">
                      {s.jurisdictionRadius != null
                        ? s.jurisdictionRadius
                        : "—"}
                    </td>
                    <td className="p-3 text-center space-x-2">
                      <button
                        onClick={() => openEdit(s)}
                        className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteStation(s.id, s.stationName)}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && stations.length === 0 && (
              <p className="p-8 text-center text-slate-500">
                No police stations registered yet. Add one to enable alert
                routing.
              </p>
            )}

            {loading && (
              <p className="p-8 text-center text-slate-500">Loading…</p>
            )}
          </div>
        </div>

        {/* ─── MODAL ─── */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="app-card w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6">
              <h3 className="font-semibold text-lg text-slate-800 mb-4">
                {editingId ? "Edit Police Station" : "Add Police Station"}
              </h3>

              <div className="grid grid-cols-2 gap-x-3">
                <div className="col-span-2">
                  {field("stationName", "Station Name *")}
                </div>
                {field("stationCode", "Station Code")}
                {field("officerInCharge", "Officer In Charge")}
                {field("city", "City")}
                {field("area", "Area")}
                {field("contactNumber", "Contact Number *")}
                {field("emergencyNumber", "Emergency Number")}
                <div className="col-span-2">
                  {field("alertEmail", "Alert Email")}
                </div>
                <div className="col-span-2">
                  {field(
                    "jurisdictionRadius",
                    "Jurisdiction Radius (km)",
                    "number"
                  )}
                </div>
              </div>

              {/* ── LOCATION SECTION ── */}
              <div className="mt-3 border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-700">
                    📍 Station Location
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!navigator.geolocation) {
                        alert("Geolocation is not supported by your browser.");
                        return;
                      }
                      navigator.geolocation.getCurrentPosition(
                        (pos) =>
                          setPinLocation({
                            lat: parseFloat(pos.coords.latitude.toFixed(6)),
                            lng: parseFloat(pos.coords.longitude.toFixed(6)),
                          }),
                        () => alert("Unable to retrieve your location.")
                      );
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg"
                  >
                    🎯 Use My Location
                  </button>
                </div>

                {/* Manual lat / lng inputs */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 12.971599"
                      className="app-input w-full"
                      value={pinLocation?.lat ?? ""}
                      onChange={(e) => {
                        const lat = parseFloat(e.target.value);
                        if (!isNaN(lat)) {
                          setPinLocation((prev) => ({
                            lat: parseFloat(lat.toFixed(6)),
                            lng: prev?.lng ?? 78.9629,
                          }));
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 77.594563"
                      className="app-input w-full"
                      value={pinLocation?.lng ?? ""}
                      onChange={(e) => {
                        const lng = parseFloat(e.target.value);
                        if (!isNaN(lng)) {
                          setPinLocation((prev) => ({
                            lat: prev?.lat ?? 20.5937,
                            lng: parseFloat(lng.toFixed(6)),
                          }));
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Map */}
                <p className="text-xs text-slate-500 mb-2">
                  Or click anywhere on the map to pin the location
                </p>
                <LocationPickerMap
                  value={pinLocation}
                  onChange={setPinLocation}
                  height="300px"
                />

                {/* Status */}
                <div className="mt-2 text-xs">
                  {pinLocation ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                      ✅ Pinned at {pinLocation.lat}, {pinLocation.lng}
                      <button
                        type="button"
                        onClick={() => setPinLocation(null)}
                        className="ml-2 text-slate-400 hover:text-rose-500 underline"
                      >
                        Clear
                      </button>
                    </span>
                  ) : (
                    <span className="text-slate-400">No location pinned yet</span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveStation}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
