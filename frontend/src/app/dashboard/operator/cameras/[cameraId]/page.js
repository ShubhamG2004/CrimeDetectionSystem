"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import {
  ArrowLeft,
  MapPin,
  Signal,
  Clock,
  AlertTriangle,
  ImageIcon,
  Calendar,
  Building2,
  Maximize,
} from "lucide-react";
import Link from "next/link";

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

export default function CameraDetailPage() {
  const router = useRouter();
  const params = useParams();
  const cameraId = params?.cameraId;
  const checkedRef = useRef(false);

  const [camera, setCamera] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = useCallback(
    async (user) => {
      if (!cameraId) return;

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

        if (!cameraResponse.ok || !incidentResponse.ok) {
          throw new Error("Failed to fetch camera data");
        }

        const cameras = Array.isArray(cameraData)
          ? cameraData.map((c) => ({
              ...c,
              cameraId: c.cameraId || c.id,
            }))
          : [];

        const selectedCamera = cameras.find((c) => c.cameraId === cameraId);

        if (!selectedCamera) {
          setError("Camera not found or you don't have access to it");
          setLoading(false);
          return;
        }

        const cameraIncidents = Array.isArray(incidentData.incidents)
          ? incidentData.incidents
              .filter((inc) => {
                const incCameraId = inc.cameraId || inc.location?.cameraId;
                return incCameraId === cameraId;
              })
              .map((inc) => ({
                ...inc,
                createdAt: parseTimestamp(inc.createdAt),
                updatedAt: parseTimestamp(inc.updatedAt),
              }))
              .sort(
                (a, b) =>
                  new Date(b.createdAt || b.updatedAt || 0) -
                  new Date(a.createdAt || a.updatedAt || 0)
              )
          : [];

        setCamera(selectedCamera);
        setIncidents(cameraIncidents);
        setError("");
      } catch (err) {
        console.error("Failed to load camera details:", err);
        setError("Unable to load camera details. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [cameraId]
  );

  useEffect(() => {
    if (checkedRef.current || !mounted) return;
    checkedRef.current = true;
    let intervalId;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (intervalId) clearInterval(intervalId);
        router.replace("/login");
        return;
      }

      if (localStorage.getItem("role") !== ROLES.OPERATOR) {
        if (intervalId) clearInterval(intervalId);
        router.replace("/dashboard");
        return;
      }

      await loadData(user);

      // Refresh less aggressively to lower Firestore read pressure.
      intervalId = setInterval(() => {
        loadData(user);
      }, 30000);
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      unsubscribe();
    };
  }, [router, loadData, mounted]);

  const latestIncident = incidents[0] || null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md overflow-hidden">
        <OperatorSidebar />
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Navbar */}
        <div className="sticky top-0 z-10 bg-white shadow">
          <Navbar title="Camera Live Monitoring" />
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mb-4 h-12 w-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                <p className="text-slate-600 font-medium">Loading camera details...</p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="p-6">
              <div className="max-w-4xl mx-auto">
                <div className="app-card p-8 text-center border border-red-200 bg-red-50">
                  <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                  <h2 className="text-lg font-semibold text-red-900 mb-2">Error Loading Camera</h2>
                  <p className="text-red-700 mb-6">{error}</p>
                  <Link
                    href="/dashboard/operator/cameras"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Cameras
                  </Link>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && camera && (
            <div className="p-6 pb-8">
              <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      href="/dashboard/operator/cameras"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-3 transition"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Cameras
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900 mt-2">{getCameraName(camera)}</h1>
                    <p className="text-slate-600 flex items-center gap-2 mt-2">
                      <MapPin className="h-4 w-4" />
                      {getCameraLocation(camera)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                      <div className="h-2 w-2 bg-green-600 rounded-full animate-pulse"></div>
                      <span className="font-semibold text-green-900">Live</span>
                    </div>
                  </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Live Feed */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Primary Image */}
                    <div className="app-card overflow-hidden rounded-2xl bg-slate-900">
                      <div className="relative">
                        {latestIncident?.imageUrl ? (
                          <div className="relative group">
                            <img
                              src={latestIncident.imageUrl}
                              alt="Live feed"
                              className="h-[500px] w-full object-cover"
                            />
                            <button
                              onClick={() => setFullscreenImage(latestIncident.imageUrl)}
                              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition opacity-0 group-hover:opacity-100"
                            >
                              <Maximize className="h-5 w-5" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                              <div className="flex items-center gap-2 text-white">
                                <Signal className="h-4 w-4 text-green-400" />
                                <span className="text-sm font-medium">Live Stream</span>
                              </div>
                              <p className="text-xs text-gray-300 mt-2">{formatDateTime(latestIncident.createdAt || latestIncident.updatedAt)}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="h-[500px] flex flex-col items-center justify-center text-center">
                            <ImageIcon className="h-16 w-16 text-slate-600 mb-4" />
                            <h3 className="text-xl font-semibold text-white">No Live Image Yet</h3>
                            <p className="text-slate-400 mt-2 max-w-sm">
                              This camera will display the latest incident image here as soon as new activity is detected.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Incident Details */}
                    {latestIncident && (
                      <div className="app-card p-6 border border-slate-200">
                        <h3 className="font-semibold text-lg text-slate-900 mb-4">Latest Incident Details</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-xs font-semibold text-slate-500 uppercase">Crime Type</p>
                            <p className="text-sm font-semibold text-slate-900 mt-2">
                              {latestIncident.crime_type?.replace(/_/g, " ") || "Unknown"}
                            </p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-xs font-semibold text-slate-500 uppercase">Threat Level</p>
                            <p className={`text-sm font-semibold mt-2 ${
                              latestIncident.threat_level === "CRITICAL" ? "text-red-600" :
                              latestIncident.threat_level === "HIGH" ? "text-orange-600" :
                              latestIncident.threat_level === "MEDIUM" ? "text-yellow-600" :
                              "text-green-600"
                            }`}>
                              {latestIncident.threat_level || "Unknown"}
                            </p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-xs font-semibold text-slate-500 uppercase">Confidence</p>
                            <p className="text-sm font-semibold text-slate-900 mt-2">
                              {latestIncident.confidence ? `${Math.round(latestIncident.confidence * 100)}%` : "N/A"}
                            </p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-xs font-semibold text-slate-500 uppercase">People Detected</p>
                            <p className="text-sm font-semibold text-slate-900 mt-2">
                              {latestIncident.persons_detected || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-6">
                    {/* Camera Information */}
                    <div className="app-card p-6 border border-slate-200">
                      <h3 className="font-semibold text-lg text-slate-900 mb-4 flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Camera Info
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase">Camera ID</p>
                          <p className="text-sm font-mono text-slate-900 mt-1 break-all">{camera.cameraId}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase">Police Station</p>
                          <p className="text-sm text-slate-900 mt-1">{camera.policeStationName || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase">Status</p>
                          <p className={`text-sm font-semibold mt-1 ${
                            getCameraStatus(camera) === "active" ? "text-green-600" : "text-yellow-600"
                          }`}>
                            {getCameraStatus(camera)?.toUpperCase()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase">Latitude</p>
                          <p className="text-sm text-slate-900 mt-1">{camera.latitude ?? "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase">Longitude</p>
                          <p className="text-sm text-slate-900 mt-1">{camera.longitude ?? "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase">Added On</p>
                          <p className="text-sm text-slate-900 mt-1">{formatDateTime(camera.createdAt)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Activity Summary */}
                    <div className="app-card p-6 border border-slate-200">
                      <h3 className="font-semibold text-lg text-slate-900 mb-4 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Activity Summary
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-sm text-slate-700">Total Incidents</span>
                          <span className="text-lg font-bold text-slate-900">{incidents.length}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                          <span className="text-sm text-red-700">Critical</span>
                          <span className="text-lg font-bold text-red-900">
                            {incidents.filter((i) => i.threat_level === "CRITICAL").length}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <span className="text-sm text-orange-700">High</span>
                          <span className="text-lg font-bold text-orange-900">
                            {incidents.filter((i) => i.threat_level === "HIGH").length}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <span className="text-sm text-yellow-700">Medium</span>
                          <span className="text-lg font-bold text-yellow-900">
                            {incidents.filter((i) => i.threat_level === "MEDIUM").length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Incidents */}
                <div className="app-card p-6 border border-slate-200">
                  <h3 className="font-semibold text-lg text-slate-900 mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Incident Images
                  </h3>
                  {incidents.length === 0 ? (
                    <div className="text-center py-12">
                      <ImageIcon className="h-12 w-12 text-slate-400 mx-auto mb-3 opacity-40" />
                      <p className="text-slate-600">No incident images available yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {incidents.slice(0, 12).map((incident) => (
                        <div key={incident.id} className="group relative overflow-hidden rounded-lg border border-slate-200 hover:border-blue-400 transition cursor-pointer"
                          onClick={() => setFullscreenImage(incident.imageUrl)}
                        >
                          {incident.imageUrl && (
                            <>
                              <img
                                src={incident.imageUrl}
                                alt="Incident"
                                className="h-32 w-full object-cover group-hover:scale-110 transition duration-300"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                                <Maximize className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition" />
                              </div>
                            </>
                          )}
                          <div className="p-2 bg-white">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {incident.crime_type?.replace(/_/g, " ") || "Incident"}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {formatDateTime(incident.createdAt || incident.updatedAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Image Modal */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <div className="relative max-w-4xl max-h-screen w-full h-full">
            <img
              src={fullscreenImage}
              alt="Fullscreen view"
              className="w-full h-full object-contain"
            />
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition text-3xl"
              onClick={() => setFullscreenImage(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
