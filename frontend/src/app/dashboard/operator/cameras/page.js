"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import {
  Camera,
  ChevronRight,
  Clock3,
  Image as ImageIcon,
  MapPin,
  Search,
  Shield,
  Signal,
  Sparkles,
  Users,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import OperatorSidebar from "@/components/OperatorSidebar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const parseTimestamp = (value) => {
  if (!value) return null;

  if (typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value) => {
  const date = parseTimestamp(value);
  if (!date) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(date);
};

const getCameraName = (camera) => camera?.cameraName || camera?.name || "Unnamed Camera";
const getCameraLocation = (camera) => camera?.location || camera?.area || "Unknown location";
const getCameraStatus = (camera) => String(camera?.status || "active").toLowerCase();

export default function OperatorCamerasPage() {
  const router = useRouter();
  const [cameras, setCameras] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = useCallback(async (user) => {
    try {
      const token = await user.getIdToken(true);

      const [cameraResponse, incidentResponse] = await Promise.all([
        fetch(`${API_URL}/api/operator/cameras`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/operator/incidents`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [cameraData, incidentData] = await Promise.all([
        cameraResponse.json(),
        incidentResponse.json(),
      ]);

      if (!cameraResponse.ok) {
        throw new Error(cameraData?.message || `HTTP_${cameraResponse.status}`);
      }

      if (!incidentResponse.ok) {
        throw new Error(incidentData?.message || `HTTP_${incidentResponse.status}`);
      }

      const normalizedCameras = Array.isArray(cameraData)
        ? cameraData.map((camera) => ({
            ...camera,
            cameraId: camera.cameraId || camera.id,
          }))
        : [];

      const normalizedIncidents = Array.isArray(incidentData.incidents)
        ? incidentData.incidents
            .map((incident) => ({
              ...incident,
              createdAt: parseTimestamp(incident.createdAt),
              updatedAt: parseTimestamp(incident.updatedAt),
            }))
            .sort(
              (a, b) =>
                new Date(b.createdAt || b.updatedAt || 0) -
                new Date(a.createdAt || a.updatedAt || 0)
            )
        : [];

      setCameras(normalizedCameras);
      setIncidents(normalizedIncidents);
      setSelectedCameraId((current) => {
        if (current && normalizedCameras.some((camera) => camera.cameraId === current)) {
          return current;
        }
        return normalizedCameras[0]?.cameraId || "";
      });
      setError("");
      setLoading(false);
    } catch (err) {
      console.error("Failed to load operator cameras:", err);
      const message = String(err?.message || "").toLowerCase();
      const isPermissionDenied =
        message.includes("permission") ||
        message.includes("operator profile not found") ||
        message.includes("operator account is inactive");

      setError(
        isPermissionDenied
          ? "You do not have permission to view assigned cameras."
          : "Unable to load assigned cameras right now."
      );
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      if (localStorage.getItem("role") !== ROLES.OPERATOR) {
        router.replace("/dashboard");
        return;
      }

      await loadData(user);

      const interval = setInterval(() => {
        loadData(user);
      }, 5000);

      return () => clearInterval(interval);
    });

    return () => unsubscribe();
  }, [router, loadData]);

  const filteredCameras = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sorted = [...cameras].sort((a, b) => {
      const aScore = getCameraStatus(a) === "active" ? 1 : 0;
      const bScore = getCameraStatus(b) === "active" ? 1 : 0;
      return bScore - aScore || getCameraName(a).localeCompare(getCameraName(b));
    });

    if (!query) return sorted;

    return sorted.filter((camera) => {
      const haystack = [
        getCameraName(camera),
        getCameraLocation(camera),
        camera.policeStationName,
        camera.cameraId,
        camera.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [cameras, searchQuery]);

  const selectedCamera = useMemo(
    () => filteredCameras.find((camera) => camera.cameraId === selectedCameraId) || filteredCameras[0] || null,
    [filteredCameras, selectedCameraId]
  );

  const selectedCameraIncidents = useMemo(() => {
    if (!selectedCamera) return [];

    return incidents.filter((incident) => {
      const incidentCameraId = incident.cameraId || incident.location?.cameraId;
      return incidentCameraId === selectedCamera.cameraId;
    });
  }, [incidents, selectedCamera]);

  const latestIncident = selectedCameraIncidents[0] || null;

  const cameraCounts = useMemo(() => {
    const active = cameras.filter((camera) => getCameraStatus(camera) === "active").length;
    const pending = cameras.filter((camera) => getCameraStatus(camera) === "pending").length;
    return {
      total: cameras.length,
      active,
      pending,
      liveImages: incidents.filter((incident) => incident.imageUrl).length,
    };
  }, [cameras, incidents]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 text-slate-900">
      <OperatorSidebar />

      <div className="flex-1 flex flex-col">
        <Navbar title="Operator Cameras" />

        <div className="p-6 overflow-auto">
          <div className="relative mb-5 overflow-hidden rounded-3xl border border-slate-200 bg-white/85 px-5 py-5 shadow-sm backdrop-blur">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal-100/70 blur-3xl" />
            <div className="absolute -bottom-10 left-10 h-28 w-28 rounded-full bg-slate-200/60 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
                  <Camera className="h-3.5 w-3.5 text-slate-500" />
                  Assigned camera feed
                </div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                  My Cameras
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Review the cameras assigned to you and open any camera to watch the latest live images and incident activity.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4 lg:min-w-[520px]">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Total</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{cameraCounts.total}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Active</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{cameraCounts.active}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Pending</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{cameraCounts.pending}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-2 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Live Images</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{cameraCounts.liveImages}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search Cameras
              </label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by camera name, location, station..."
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

          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
              Loading assigned cameras...
            </div>
          )}

          {error && !loading && (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          {!loading && !error && filteredCameras.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
              No cameras found.
            </div>
          )}

          {!loading && !error && filteredCameras.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.35fr]">
              <div className="space-y-3">
                <div className="sticky top-0 z-10 rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm">
                  Assigned Cameras ({filteredCameras.length})
                </div>

                <div className="space-y-3">
                  {filteredCameras.map((camera) => {
                    const isSelected = camera.cameraId === selectedCamera?.cameraId;
                    const status = getCameraStatus(camera);

                    return (
                      <button
                        key={camera.cameraId}
                        onClick={() => setSelectedCameraId(camera.cameraId)}
                        className={`w-full rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
                          isSelected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-900"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`truncate text-base font-semibold ${isSelected ? "text-white" : "text-slate-900"}`}>
                              {getCameraName(camera)}
                            </p>
                            <p className={`mt-1 flex items-center gap-1 truncate text-sm ${isSelected ? "text-slate-200" : "text-slate-500"}`}>
                              <MapPin className="h-3.5 w-3.5" />
                              {getCameraLocation(camera)}
                            </p>
                          </div>
                          <div className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                            status === "active"
                              ? isSelected
                                ? "bg-white/15 text-white"
                                : "bg-emerald-100 text-emerald-700"
                              : status === "pending"
                              ? isSelected
                                ? "bg-white/15 text-white"
                                : "bg-amber-100 text-amber-700"
                              : isSelected
                              ? "bg-white/15 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {status}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className={`${isSelected ? "text-slate-200" : "text-slate-500"}`}>
                            {camera.policeStationName || "Police Station"}
                          </span>
                          <span className={`inline-flex items-center gap-1 ${isSelected ? "text-slate-200" : "text-slate-500"}`}>
                            Open live view <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-4 text-white">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Live Monitoring</p>
                        <h3 className="mt-1 text-2xl font-semibold">
                          {selectedCamera ? getCameraName(selectedCamera) : "Select a camera"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-300">
                          {selectedCamera ? getCameraLocation(selectedCamera) : "Choose an assigned camera to begin monitoring"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-right">
                        <p className="text-[10px] uppercase tracking-wide text-slate-200">Monitoring</p>
                        <p className="mt-1 text-sm font-semibold">{selectedCamera?.status || "active"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="border-b border-slate-200 lg:border-b-0 lg:border-r lg:border-slate-200">
                      {latestIncident?.imageUrl ? (
                        <div className="relative">
                          <img
                            src={latestIncident.imageUrl}
                            alt="Live monitoring"
                            className="h-[430px] w-full object-cover"
                          />
                          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                            <Signal className="h-3.5 w-3.5 text-emerald-300" />
                            Live image feed
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-[430px] flex-col items-center justify-center bg-slate-50 px-6 text-center">
                          <div className="mb-4 rounded-full border border-slate-200 bg-white p-4 shadow-sm">
                            <ImageIcon className="h-8 w-8 text-slate-400" />
                          </div>
                          <h4 className="text-lg font-semibold text-slate-900">No live image yet</h4>
                          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                            This camera will show the latest incident image here as soon as new activity is detected.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 p-5">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                          <p className="text-xs font-semibold uppercase text-slate-500">Camera ID</p>
                          <p className="mt-1 font-mono text-slate-900">{selectedCamera?.cameraId || "N/A"}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                          <p className="text-xs font-semibold uppercase text-slate-500">Police Station</p>
                          <p className="mt-1 text-slate-900">{selectedCamera?.policeStationName || "-"}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                          <p className="text-xs font-semibold uppercase text-slate-500">Last Update</p>
                          <p className="mt-1 text-slate-900">{formatDateTime(latestIncident?.createdAt || latestIncident?.updatedAt)}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                          <p className="text-xs font-semibold uppercase text-slate-500">Incident Count</p>
                          <p className="mt-1 text-slate-900">{selectedCameraIncidents.length}</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Activity</p>
                            <h4 className="text-lg font-semibold text-slate-900">Latest images</h4>
                          </div>
                          <Sparkles className="h-4 w-4 text-slate-400" />
                        </div>

                        <div className="space-y-3">
                          {selectedCameraIncidents.slice(0, 4).map((incident) => (
                            <div key={incident.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                              <img
                                src={incident.imageUrl}
                                alt="Incident thumbnail"
                                className="h-16 w-16 rounded-lg object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-slate-900">
                                  {incident.crime_type?.replace(/_/g, " ") || "Incident"}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {formatDateTime(incident.createdAt || incident.updatedAt)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 rounded-full bg-slate-900 px-2 py-1 text-[10px] font-medium text-white">
                                <Clock3 className="h-3 w-3" />
                                Live
                              </div>
                            </div>
                          ))}

                          {selectedCameraIncidents.length === 0 && (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                              No incident images available for this camera yet.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <Shield className="h-4 w-4 text-slate-500" />
                          Camera Profile
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase text-slate-500">Name</p>
                            <p className="mt-1 text-slate-900">{selectedCamera ? getCameraName(selectedCamera) : "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase text-slate-500">Location</p>
                            <p className="mt-1 text-slate-900">{selectedCamera ? getCameraLocation(selectedCamera) : "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase text-slate-500">Latitude</p>
                            <p className="mt-1 text-slate-900">{selectedCamera?.latitude ?? "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase text-slate-500">Longitude</p>
                            <p className="mt-1 text-slate-900">{selectedCamera?.longitude ?? "-"}</p>
                          </div>
                        </div>
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
