"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Search, Bell, CalendarDays, ShieldAlert } from "lucide-react";

import Navbar from "@/components/Navbar";
import OperatorSidebar from "@/components/OperatorSidebar";

export default function OperatorIncidentsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // -------------------------------
  // ✅ Timestamp Parsing
  // -------------------------------
  const parseFirestoreTimestamp = (value) => {
    if (!value) {
      console.warn("⚠️ Timestamp is empty/null:", value);
      return null;
    }

    // Handle Firestore Timestamp object with toDate method
    if (typeof value === "object" && "toDate" in value) {
      return value.toDate();
    }

    // Handle native Date object
    if (value instanceof Date) {
      return value;
    }

    // Handle ISO string (from backend serialization)
    if (typeof value === "string") {
      try {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          console.log("✅ Parsed ISO string:", value, "→", date);
          return date;
        }
      } catch (e) {
        console.warn("❌ Failed to parse ISO string:", value);
      }
    }

    // Handle numeric timestamp
    if (typeof value === "number") {
      try {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      } catch (e) {
        console.warn("❌ Failed to parse numeric timestamp:", value);
      }
    }

    console.warn("⚠️ Unrecognized timestamp format:", value, typeof value);
    return null;
  };

  const formatTimestamp = (value) => {
    const date = parseFirestoreTimestamp(value);

    if (!date) return "Not Available";

    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Asia/Kolkata",
    }).format(date);
  };

  // -------------------------------
  // ✅ Helpers
  // -------------------------------
  const getCameraLocation = (alert) => {
    return (
      alert?.location?.name ||
      alert?.camera?.name ||
      alert?.cameraId ||
      "Unknown Location"
    );
  };

  const getThreatColor = (level) => {
    const lvl = String(level || "").toUpperCase();
    switch (lvl) {
      case "CRITICAL":
        return "from-rose-700 to-rose-800";
      case "HIGH":
        return "from-amber-700 to-amber-800";
      case "MEDIUM":
        return "from-sky-700 to-sky-800";
      case "LOW":
        return "from-slate-700 to-slate-800";
      default:
        return "from-slate-700 to-slate-800";
    }
  };

  const getConfidence = (value) => {
    if (!value) return 0;
    return value > 1 ? value : value * 100;
  };

  const filteredAlerts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const sorted = [...alerts].sort(
      (a, b) => new Date(b.triggeredAt || b.createdAt || 0) - new Date(a.triggeredAt || a.createdAt || 0)
    );

    if (!query) {
      return sorted;
    }

    return sorted.filter((alert) => {
      const haystack = [
        alert.crime_type,
        alert.station?.stationName,
        alert.location?.name,
        alert.camera?.name,
        alert.cameraId,
        alert.threat_level,
        alert.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [alerts, searchQuery]);

  const groupedAlerts = useMemo(() => {
    const groups = {};

    const getDateLabel = (date) => {
      if (!date) return "Unknown";

      const today = new Date();
      const parsedDate = date instanceof Date ? date : new Date(date);

      if (Number.isNaN(parsedDate.getTime())) {
        return "Unknown";
      }

      const isToday = parsedDate.toDateString() === today.toDateString();

      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const isYesterday = parsedDate.toDateString() === yesterday.toDateString();

      if (isToday) return "Today";
      if (isYesterday) return "Yesterday";

      return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
      }).format(parsedDate);
    };

    filteredAlerts.forEach((alert) => {
      const date = alert.triggeredAt || alert.createdAt;
      const label = getDateLabel(date);

      if (!groups[label]) {
        groups[label] = [];
      }

      groups[label].push(alert);
    });

    return groups;
  }, [filteredAlerts]);

  const summaryStats = useMemo(() => {
    const now = new Date();
    const todayCount = filteredAlerts.filter((alert) => {
      const date = alert.triggeredAt || alert.createdAt;
      if (!date) return false;
      const parsedDate = date instanceof Date ? date : new Date(date);
      return !Number.isNaN(parsedDate.getTime()) && parsedDate.toDateString() === now.toDateString();
    }).length;

    const criticalCount = filteredAlerts.filter((alert) => String(alert.threat_level || "").toUpperCase() === "CRITICAL").length;

    return {
      total: alerts.length,
      visible: filteredAlerts.length,
      today: todayCount,
      critical: criticalCount,
      groups: Object.keys(groupedAlerts).length,
    };
  }, [alerts.length, filteredAlerts, groupedAlerts]);

  const closeDetails = () => setSelectedAlert(null);

  // -------------------------------
  // ✅ Fetch Alerts
  // -------------------------------
  const fetchAlerts = useCallback(async (user) => {
    try {
      const token = await user.getIdToken(true);

      // Use env variable or fallback to localhost:5000
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const url = `${apiUrl}/api/alerts?limit=100`;

      console.log("📡 Fetching alerts from:", url);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || `HTTP_${response.status}`);
      }

      console.log("📦 Raw alert data from backend:", data);

      const list = Array.isArray(data.data)
        ? data.data
            .map((alert) => {
              console.log("🔍 Processing alert:", alert.id, {
                triggeredAt: alert.triggeredAt,
                createdAt: alert.createdAt,
                updatedAt: alert.updatedAt,
              });
              return {
                ...alert,
                createdAt: parseFirestoreTimestamp(alert.createdAt),
                updatedAt: parseFirestoreTimestamp(alert.updatedAt),
                triggeredAt: parseFirestoreTimestamp(
                  alert.triggeredAt || alert.createdAt
                ),
              };
            })
            .sort(
              (a, b) =>
                new Date(b.triggeredAt || 0) -
                new Date(a.triggeredAt || 0)
            )
        : [];

      console.log("✅ Loaded alerts:", list.length);
      setAlerts(list);
      setError("");
      setLoading(false);
    } catch (err) {
      console.error("❌ Failed to load alerts:", err);

      const msg = String(err?.message || "").toLowerCase();

      const isPermissionDenied =
        msg.includes("permission") ||
        msg.includes("operator profile not found") ||
        msg.includes("inactive");

      setError(
        isPermissionDenied
          ? "You do not have permission to read alerts."
          : "Unable to load alerts right now."
      );

      setLoading(false);
    }
  }, []);

  // -------------------------------
  // ✅ Auth + Initial Load
  // -------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const role = localStorage.getItem("role");

      if (role !== "operator") {
        router.replace("/dashboard");
        return;
      }

      await fetchAlerts(user);

      // 🔁 Auto refresh every 5 sec
      const interval = setInterval(() => {
        fetchAlerts(user);
      }, 5000);

      return () => clearInterval(interval);
    });

    return () => unsubscribe();
  }, [router, fetchAlerts]);

  // -------------------------------
  // ✅ UI
  // -------------------------------
  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 text-slate-900">
      <OperatorSidebar />

      <div className="flex-1 flex flex-col">
        <Navbar title="Alert Collection" />

        <div className="p-6 overflow-auto">
          <div className="relative mb-5 overflow-hidden rounded-3xl border border-slate-200 bg-white/85 px-5 py-5 shadow-sm backdrop-blur">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal-100/70 blur-3xl" />
            <div className="absolute -bottom-10 left-10 h-28 w-28 rounded-full bg-slate-200/60 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                  Date-wise crime feed
                </div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                  Alerts Dashboard
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Track recent incidents, search across stations and cameras, and open any card for full evidence details.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-5 lg:min-w-[520px]">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Total</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{summaryStats.total}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Visible</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{summaryStats.visible}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Today</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{summaryStats.today}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Critical</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{summaryStats.critical}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Groups</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{summaryStats.groups}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 inline-flex items-center rounded-full border border-slate-200 bg-slate-900 px-3 py-1 text-xs font-medium text-white shadow-sm">
            Latest first by date
          </div>

          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search
              </label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by crime, station, location, camera ID..."
                  className="w-full border-0 bg-transparent py-1 pl-6 pr-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
                />
              </div>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Clear
              </button>
            )}
          </div>

          {!loading && searchQuery && (
            <div className="mb-4 text-xs text-slate-500">
              Showing {filteredAlerts.length} result{filteredAlerts.length !== 1 ? "s" : ""} for “{searchQuery}”
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center text-slate-500 py-10">
              Loading alerts...
            </div>
          )}

          {/* Alerts */}
          {!loading && filteredAlerts.length > 0 && (
            <div className="space-y-6">
              {Object.entries(groupedAlerts).map(([dateLabel, dateAlerts]) => (
                <div key={dateLabel} className="space-y-2">
                  <div className="sticky top-0 z-10 flex items-center justify-between mb-2 rounded-xl bg-slate-50/95 backdrop-blur-sm py-1">
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-800 text-white px-3 py-1 text-[11px] font-medium shadow-sm">
                      <span>{dateLabel.toUpperCase()}</span>
                      <span className="opacity-70">({dateAlerts.length})</span>
                    </div>

                    <div className="text-[10px] text-slate-500 border border-slate-200 bg-white px-2 py-0.5 rounded-full shadow-sm">
                      Latest at top
                    </div>
                  </div>

                  <div className="grid gap-2 lg:grid-cols-2">
                    {dateAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                        onDoubleClick={() => setSelectedAlert(alert)}
                        role="button"
                        tabIndex={0}
                      >
                        {/* Header */}
                        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {alert.crime_type?.replace(/_/g, " ") || "Alert"}
                              </p>
                              <p className="truncate text-[10px] text-slate-500">
                                {alert.station?.stationName || "Police Station"}
                              </p>
                            </div>

                            <div className="whitespace-nowrap rounded-full border border-slate-300 bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">
                              {alert.threat_level || "LOW"}
                            </div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="space-y-2 p-2">
                          <div className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
                            <div className="rounded border border-slate-200 bg-white p-2 leading-4 shadow-sm">
                              <p className="font-semibold uppercase text-slate-500">Triggered</p>
                              <p className="font-medium text-slate-900">{formatTimestamp(alert.triggeredAt)}</p>
                            </div>
                            <div className="rounded border border-slate-200 bg-white p-2 leading-4 shadow-sm">
                              <p className="font-semibold uppercase text-slate-500">Location</p>
                              <p className="truncate font-medium text-slate-900">{getCameraLocation(alert)}</p>
                            </div>
                            <div className="rounded border border-slate-200 bg-white p-2 leading-4 shadow-sm">
                              <p className="font-semibold uppercase text-slate-500">Camera ID</p>
                              <p className="font-mono font-medium text-slate-900">{alert.cameraId?.slice(-6) || "N/A"}</p>
                            </div>
                            <div className="rounded border border-slate-200 bg-white p-2 leading-4 shadow-sm">
                              <p className="font-semibold uppercase text-slate-500">Confidence</p>
                              <p className="font-bold text-slate-900">{Math.round(getConfidence(alert.confidence))}%</p>
                            </div>
                          </div>

                          {alert.imageUrl && (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
                              <img
                                src={alert.imageUrl}
                                className="h-36 w-full object-cover"
                                alt="evidence"
                              />
                            </div>
                          )}

                          <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-2 text-[10px]">
                            <div className="rounded border border-slate-200 bg-white p-1.5 text-center leading-4 shadow-sm">
                              <p className="font-semibold text-slate-600">People</p>
                              <p className="font-medium text-slate-900">{alert.persons_detected || 0}</p>
                            </div>
                            <div className="rounded border border-slate-200 bg-white p-1.5 text-center leading-4 shadow-sm">
                              <p className="font-semibold text-slate-600">Score</p>
                              <p className="font-medium text-slate-900">{alert.threat_score || 0}</p>
                            </div>
                            <div className="rounded border border-slate-200 bg-white p-1.5 text-center leading-4 shadow-sm">
                              <p className="font-semibold text-slate-600">ID</p>
                              <p className="font-mono text-xs font-medium text-slate-900">{alert.id?.slice(-6)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Alerts */}
          {!loading && filteredAlerts.length === 0 && (
            <div className="text-center text-slate-500 py-10">
              {searchQuery ? "No alerts match your search." : "No alerts found."}
            </div>
          )}

          {/* Alert Details Modal */}
          {selectedAlert && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
              <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
                <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Alert Details
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">
                      {selectedAlert.crime_type?.replace(/_/g, " ") || "Alert"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedAlert.station?.stationName || "Police Station"}
                    </p>
                  </div>

                  <button
                    onClick={closeDetails}
                    className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
                  >
                    Close
                  </button>
                </div>

                <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="border-b border-slate-200 lg:border-b-0 lg:border-r lg:border-slate-200">
                    {selectedAlert.imageUrl ? (
                      <img
                        src={selectedAlert.imageUrl}
                        alt="Alert evidence"
                        className="h-80 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-80 items-center justify-center bg-slate-100 text-sm text-slate-500">
                        No evidence image available
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase text-slate-500">Triggered</p>
                        <p className="mt-1 text-slate-900">{formatTimestamp(selectedAlert.triggeredAt)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase text-slate-500">Updated</p>
                        <p className="mt-1 text-slate-900">{formatTimestamp(selectedAlert.updatedAt)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase text-slate-500">Location</p>
                        <p className="mt-1 text-slate-900">{getCameraLocation(selectedAlert)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase text-slate-500">Police Station</p>
                        <p className="mt-1 text-slate-900">{selectedAlert.station?.stationName || "Police Station"}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase text-slate-500">Camera ID</p>
                        <p className="mt-1 font-mono text-slate-900">{selectedAlert.cameraId || "N/A"}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold uppercase text-slate-500">Confidence</p>
                        <p className="mt-1 text-slate-900">{Math.round(getConfidence(selectedAlert.confidence))}%</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 text-center shadow-sm">
                        <p className="text-xs uppercase text-slate-500">People</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{selectedAlert.persons_detected || 0}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 text-center shadow-sm">
                        <p className="text-xs uppercase text-slate-500">Score</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{selectedAlert.threat_score || 0}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 text-center shadow-sm">
                        <p className="text-xs uppercase text-slate-500">Alert ID</p>
                        <p className="mt-1 font-mono text-sm font-medium text-slate-900">{selectedAlert.id}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}