"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import dynamic from "next/dynamic";
import { Building2, MapPin, Phone, Mail, X } from "lucide-react";
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
  const [selectedStation, setSelectedStation] = useState(null);
  const [search, setSearch] = useState("");

  /* AUTH GUARD */
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

  /* FETCH */
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

  /* SAVE (CREATE / UPDATE) */
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

  /* DELETE */
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

  /* HELPERS */
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

  const getTimestampMs = (value) => {
    if (!value) return null;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (typeof value?._seconds === "number") return value._seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  };

  const formatDateTime = (value) => {
    const ts = getTimestampMs(value);
    if (!ts) return "-";
    return new Date(ts).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredStations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stations;

    return stations.filter((station) => {
      const fields = [
        station.stationName,
        station.stationCode,
        station.location?.city,
        station.location?.area,
        station.contactNumber,
        station.officerInCharge,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());

      return fields.some((v) => v.includes(q));
    });
  }, [stations, search]);

  const stationMetrics = useMemo(() => {
    const withCoordinates = stations.filter(
      (s) => s.location?.latitude != null && s.location?.longitude != null
    ).length;
    const withEmergency = stations.filter((s) => !!s.emergencyNumber).length;

    return {
      total: stations.length,
      geoReady: withCoordinates,
      emergencyReady: withEmergency,
    };
  }, [stations]);

  /* RENDER */
  return (
    <div className="app-shell flex">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="Police Stations" />

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
              <p className="text-xs text-slate-400 mt-1">
                Double-click any row to view full station details.
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
              + Add Station
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <div className="app-card p-4 border-l-4 border-slate-800">
              <p className="text-xs text-slate-500">Total Stations</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{stationMetrics.total}</p>
            </div>
            <div className="app-card p-4 border-l-4 border-orange-500">
              <p className="text-xs text-slate-500">Geo-ready</p>
              <p className="text-2xl font-semibold text-orange-700 mt-1">{stationMetrics.geoReady}</p>
            </div>
            <div className="app-card p-4 border-l-4 border-sky-500">
              <p className="text-xs text-slate-500">Emergency Contacts</p>
              <p className="text-2xl font-semibold text-sky-700 mt-1">{stationMetrics.emergencyReady}</p>
            </div>
          </div>

          <div className="app-card p-4 mb-4">
            <input
              type="text"
              className="app-input"
              placeholder="Search by station name, code, city, area, contact, or officer..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
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
                {filteredStations.map((s) => (
                  <tr
                    key={s.id}
                    onDoubleClick={() => setSelectedStation(s)}
                    className="border-t border-slate-100 hover:bg-slate-50/70 cursor-pointer transition-colors"
                  >
                    <td className="p-3 font-medium">{s.stationName}</td>
                    <td className="p-3 text-slate-500">
                      {s.stationCode || "-"}
                    </td>
                    <td className="p-3">
                      <span className="font-medium">
                        {s.location?.area || "-"}
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
                        <div className="text-xs text-orange-600">
                          Emergency: {s.emergencyNumber}
                        </div>
                      )}
                    </td>
                    <td className="p-3">{s.officerInCharge || "-"}</td>
                    <td className="p-3 text-center">
                      {s.jurisdictionRadius != null
                        ? s.jurisdictionRadius
                        : "-"}
                    </td>
                    <td
                      className="p-3 text-center space-x-2"
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(s);
                        }}
                        className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteStation(s.id, s.stationName);
                        }}
                        className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && filteredStations.length === 0 && (
              <p className="p-8 text-center text-slate-500">
                {search.trim()
                  ? "No stations matched your search."
                  : "No police stations registered yet. Add one to enable alert routing."}
              </p>
            )}

            {loading && (
              <p className="p-8 text-center text-slate-500">Loading...</p>
            )}
          </div>
        </div>

        {/* MODAL */}
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

              {/* LOCATION SECTION */}
              <div className="mt-3 border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-700">
                    Station Location
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
                    className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded-lg"
                  >
                    Use My Location
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
                    <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
                      Pinned at {pinLocation.lat}, {pinLocation.lng}
                      <button
                        type="button"
                        onClick={() => setPinLocation(null)}
                        className="ml-2 text-slate-400 hover:text-orange-500 underline"
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
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DETAILS MODAL */}
        {selectedStation && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.24)] overflow-hidden">
              <div className="border-b border-slate-200 bg-linear-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-2.5 py-1 text-[11px] uppercase tracking-wide text-slate-200">
                      <Building2 className="h-3 w-3" />
                      Station Profile
                    </p>
                    <h3 className="mt-3 text-xl font-semibold">{selectedStation.stationName}</h3>
                    <p className="mt-1 text-sm text-slate-300">ID: {selectedStation.id}</p>
                  </div>
                  <button
                    onClick={() => setSelectedStation(null)}
                    className="rounded-lg border border-white/20 p-2 text-slate-200 hover:bg-white/10"
                    aria-label="Close details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Station Code</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedStation.stationCode || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Jurisdiction Radius</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {selectedStation.jurisdictionRadius != null
                        ? `${selectedStation.jurisdictionRadius} km`
                        : "-"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Officer In Charge</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedStation.officerInCharge || "-"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />
                      Location
                    </p>
                    <p className="mt-1 text-sm text-slate-900 font-medium">
                      {selectedStation.location?.area || "-"}
                      {selectedStation.location?.city ? `, ${selectedStation.location.city}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedStation.location?.latitude != null && selectedStation.location?.longitude != null
                        ? `${selectedStation.location.latitude}, ${selectedStation.location.longitude}`
                        : "Coordinates not set"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <Phone className="h-3.5 w-3.5" />
                      Contact
                    </p>
                    <p className="mt-1 text-sm text-slate-900 font-medium">{selectedStation.contactNumber || "-"}</p>
                    <p className="mt-1 text-xs text-orange-700">
                      Emergency: {selectedStation.emergencyNumber || "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Mail className="h-3.5 w-3.5" />
                    Alert Email
                  </p>
                  <p className="mt-1 text-sm text-slate-900 font-medium break-all">{selectedStation.alertEmail || "-"}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">Created At</p>
                    <p className="mt-1 text-sm text-slate-900 font-medium">{formatDateTime(selectedStation.createdAt)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">Updated At</p>
                    <p className="mt-1 text-sm text-slate-900 font-medium">{formatDateTime(selectedStation.updatedAt)}</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setSelectedStation(null)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

