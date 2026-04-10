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
  AlertTriangle,
  ImageIcon,
  Calendar,
  Building2,
  Maximize,
  Wifi,
  Camera,
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

const getCrimeTypeLabel = (value) => {
  if (!value) return "Unknown Activity";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getThreatScore = (incident) => {
  const explicitScore = Number(incident?.threat_score);
  if (Number.isFinite(explicitScore) && explicitScore >= 0) {
    return Math.max(0, Math.min(100, Math.round(explicitScore)));
  }

  const confidence = Number(incident?.confidence) || 0;
  const level = String(incident?.threat_level || "LOW").toUpperCase();
  const levelBoost = level === "CRITICAL" ? 20 : level === "HIGH" ? 14 : level === "MEDIUM" ? 8 : 2;

  return Math.max(0, Math.min(100, Math.round(confidence * 100 + levelBoost)));
};

const getConfidencePercent = (value) =>
  Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100)));

const getThreatLevelClasses = (level) => {
  const normalized = String(level || "LOW").toUpperCase();

  if (normalized === "CRITICAL") {
    return "bg-red-100 text-red-800 border-red-200";
  }

  if (normalized === "HIGH") {
    return "bg-orange-100 text-orange-800 border-orange-200";
  }

  if (normalized === "MEDIUM") {
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  }

  return "bg-emerald-100 text-emerald-800 border-emerald-200";
};

const normalizeHost = (value) => String(value || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");

const buildStreamCandidates = (camera) => {
  const set = new Set();
  const push = (url) => {
    const raw = String(url || "").trim();
    if (!raw) return;
    const normalized = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    set.add(normalized);
  };

  push(camera?.esp32StreamUrl);
  push(camera?.esp32?.streamUrl);

  const host = normalizeHost(camera?.esp32?.ipAddress);
  if (host) {
    push(`http://${host}/stream`);
    push(`http://${host}:81/stream`);
    push(`http://${host}/mjpeg/1`);
    push(`http://${host}/video`);
  }

  return Array.from(set);
};

const invertedPreviewStyle = {
  transform: "rotate(180deg)",
  transformOrigin: "center center",
};

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
  const [captureError, setCaptureError] = useState("");
  const [streamError, setStreamError] = useState(false);
  const [streamRetryNonce, setStreamRetryNonce] = useState(0);
  const [streamCandidateIndex, setStreamCandidateIndex] = useState(0);
  const captureIntervalRef = useRef(null);
  const streamImgRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setStreamError(false);
    setStreamRetryNonce(0);
    setStreamCandidateIndex(0);
  }, [camera?.esp32StreamUrl]);

  useEffect(() => {
    const candidates = buildStreamCandidates(camera);
    if (!streamError || candidates.length === 0) return;

    const retryTimer = setTimeout(() => {
      setStreamRetryNonce((prev) => prev + 1);
      setStreamCandidateIndex((prev) => (prev + 1) % candidates.length);
      setStreamError(false);
    }, 5000);

    return () => clearTimeout(retryTimer);
  }, [streamError, camera?.esp32StreamUrl, camera?.esp32?.ipAddress]);

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

        if (!cameraResponse.ok || !incidentResponse.ok) {
          throw new Error(`Failed to fetch data: cameras=${cameraResponse.status} incidents=${incidentResponse.status}`);
        }

        const [cameraData, incidentData] = await Promise.all([
          cameraResponse.json(),
          incidentResponse.json(),
        ]);

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

  const hasEsp32Source = Boolean(
    camera?.esp32CaptureUrl || camera?.esp32StreamUrl || camera?.esp32?.ipAddress
  );

  const captureFromStream = useCallback(async () => {
    if (!streamImgRef.current || !canvasRef.current || !auth.currentUser || !cameraId) return;

    const imageEl = streamImgRef.current;
    const canvasEl = canvasRef.current;

    if (!imageEl.complete || imageEl.naturalWidth === 0 || imageEl.naturalHeight === 0) {
      setCaptureError("Stream frame not ready yet");
      return;
    }

    canvasEl.width = imageEl.naturalWidth;
    canvasEl.height = imageEl.naturalHeight;

    const context = canvasEl.getContext("2d");
    if (!context) {
      setCaptureError("Unable to read stream frame");
      return;
    }

    try {
      context.drawImage(imageEl, 0, 0, canvasEl.width, canvasEl.height);
    } catch (drawErr) {
      setCaptureError(`Stream capture failed: ${drawErr.message}`);
      return;
    }

    try {
      const token = await auth.currentUser.getIdToken(true);

      const imageBlob = await new Promise((resolve, reject) => {
        canvasEl.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to create image blob from stream"));
              return;
            }
            resolve(blob);
          },
          "image/jpeg",
          0.9
        );
      });

      const formData = new FormData();
      formData.append("image", imageBlob, "capture.jpg");
      formData.append("cameraId", cameraId);
      formData.append(
        "location",
        JSON.stringify({
          cameraId,
          lat: camera?.latitude,
          lng: camera?.longitude,
        })
      );

      const detectResponse = await fetch(`${API_URL}/api/detect/image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!detectResponse.ok) {
        let errorMessage = "Capture detection failed";
        try {
          const errorPayload = await detectResponse.json();
          errorMessage = errorPayload?.message || errorMessage;
          if (errorPayload?.detail) {
            errorMessage = `${errorMessage}: ${errorPayload.detail}`;
          }
          if (Array.isArray(errorPayload?.attemptedUrls) && errorPayload.attemptedUrls.length) {
            errorMessage = `${errorMessage} (tried: ${errorPayload.attemptedUrls.join(", ")})`;
          }
        } catch {
          // keep default message when response is not JSON
        }
        setCaptureError(errorMessage);
        console.warn("Capture detection failed", {
          status: detectResponse.status,
          statusText: detectResponse.statusText,
        });
        return;
      }

      const detectionResult = await detectResponse.json();
      const incidentData = detectionResult?.data;

      if (incidentData?.imageUrl) {
        setCaptureError(
          incidentData.ai_error
            ? `AI warning: ${incidentData.ai_error}${incidentData.capture_url ? ` (capture: ${incidentData.capture_url})` : ""}`
            : ""
        );
      } else {
        setCaptureError("Capture response did not include an image frame");
      }
    } catch (err) {
      setCaptureError(`Capture error: ${err.message}`);
      console.error("Frame capture/detection error:", err.message);
    }
  }, [camera, cameraId]);

  useEffect(() => {
    if (!hasEsp32Source || !mounted) {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
      return;
    }

    // Initial capture
    captureFromStream();

    // Capture every 10 seconds from the rendered live stream
    captureIntervalRef.current = setInterval(() => {
      captureFromStream();
    }, 10000);

    return () => {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
    };
  }, [hasEsp32Source, mounted, captureFromStream]);

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

      // Refresh every 30 seconds so live monitoring details stay current.
      intervalId = setInterval(() => {
        loadData(user);
      }, 30000);
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      unsubscribe();
    };
  }, [router, loadData, mounted]);

  const streamCandidates = buildStreamCandidates(camera);
  const activeStreamBase = streamCandidates.length
    ? streamCandidates[streamCandidateIndex % streamCandidates.length]
    : null;
  const streamSrc = activeStreamBase
    ? `${activeStreamBase}${activeStreamBase.includes("?") ? "&" : "?"}t=${streamRetryNonce}`
    : null;
  const dbFrames = incidents.slice(0, 12);
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
                    {/* ESP32 Stream or Incident Image */}
                    <div className="app-card overflow-hidden rounded-2xl bg-slate-900">
                      <div className="relative">
                        {streamSrc && !streamError ? (
                          /* ESP32 MJPEG Stream */
                          <div className="relative group">
                            <img
                              src={streamSrc}
                              alt="ESP32 Live Stream"
                              ref={streamImgRef}
                              crossOrigin="anonymous"
                              className="h-[500px] w-full object-cover"
                              style={invertedPreviewStyle}
                              onLoad={() => {
                                setStreamError(false);
                              }}
                              onError={() => {
                                setStreamError(true);
                              }}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                              <div className="flex items-center gap-2 text-white">
                                <Signal className="h-4 w-4 text-green-400 animate-pulse" />
                                <span className="text-sm font-medium">ESP32 Live Stream</span>
                              </div>
                              {streamCandidates.length > 1 && (
                                <p className="text-[11px] text-gray-300 mt-1">
                                  Source {streamCandidateIndex + 1}/{streamCandidates.length}
                                </p>
                              )}
                              <p className="text-xs text-gray-300 mt-2">Real-time video from device</p>
                            </div>
                          </div>
                        ) : (
                          /* No Stream or Images Available */
                          <div className="h-[500px] flex flex-col items-center justify-center text-center">
                            <ImageIcon className="h-16 w-16 text-slate-600 mb-4" />
                            <h3 className="text-xl font-semibold text-white">No Live Stream Available</h3>
                            <p className="text-slate-400 mt-2 max-w-sm">
                              {camera?.esp32StreamUrl ?
                                "ESP32 stream URL configured but not responding. Check ESP32 network and endpoint." :
                                "ESP32 not configured yet. Ask field operator to set up device."}
                            </p>
                            {streamSrc && (
                              <button
                                type="button"
                                onClick={() => {
                                  setStreamRetryNonce((prev) => prev + 1);
                                  setStreamCandidateIndex((prev) => (prev + 1) % Math.max(streamCandidates.length, 1));
                                  setStreamError(false);
                                }}
                                className="mt-4 inline-flex items-center rounded-md border border-slate-500 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                              >
                                Retry Live Stream
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Latest Detection Snapshot */}
                    <div className="app-card border border-slate-200 p-5 sm:p-6">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                          <Camera className="h-5 w-5 text-blue-600" />
                          Latest Detection
                        </h3>
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                          Auto refresh: 30s
                        </span>
                      </div>

                      {latestIncident?.imageUrl ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => setFullscreenImage(latestIncident.imageUrl)}
                            className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 group"
                          >
                            <img
                              src={latestIncident.imageUrl}
                              alt="Latest incident"
                              className="h-56 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                              style={invertedPreviewStyle}
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-left">
                              <p className="text-xs font-medium text-white/90">Tap to expand image</p>
                            </div>
                          </button>

                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</p>
                                <p className="text-xl font-bold text-slate-900 mt-1">
                                  {getCrimeTypeLabel(latestIncident.crime_type)}
                                </p>
                              </div>
                              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getThreatLevelClasses(latestIncident.threat_level)}`}>
                                {String(latestIncident.threat_level || "LOW").toUpperCase()}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                                <p className="text-xs font-semibold uppercase text-red-600">Threat Score</p>
                                <p className="mt-1 text-2xl font-bold text-red-800">{getThreatScore(latestIncident)}</p>
                              </div>
                              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                                <p className="text-xs font-semibold uppercase text-blue-600">Confidence</p>
                                <p className="mt-1 text-2xl font-bold text-blue-800">{getConfidencePercent(latestIncident.confidence)}%</p>
                              </div>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs font-semibold uppercase text-slate-500">Captured At</p>
                              <p className="mt-1 text-sm font-medium text-slate-800">
                                {formatDateTime(latestIncident.createdAt || latestIncident.updatedAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                          <ImageIcon className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                          <p className="font-semibold text-slate-700">No detected image yet</p>
                          <p className="text-sm text-slate-500 mt-1">
                            Latest image and threat details will appear here after the next detection cycle.
                          </p>
                        </div>
                      )}
                    </div>

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

                    {/* ESP32 Configuration */}
                    {camera?.esp32?.configured && (
                      <div className="app-card p-6 border border-cyan-200 bg-cyan-50">
                        <h3 className="font-semibold text-lg text-cyan-900 mb-4 flex items-center gap-2">
                          <Wifi className="h-5 w-5" />
                          ESP32 Device
                        </h3>
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="text-xs font-semibold text-cyan-700 uppercase">IP Address</p>
                            <p className="text-cyan-900 mt-1 font-mono">{camera.esp32?.ipAddress || "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-cyan-700 uppercase">Last Seen</p>
                            <p className="text-cyan-900 mt-1">
                              {camera.esp32?.lastSeenAt ? formatDateTime(camera.esp32.lastSeenAt) : "Never"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-cyan-700 uppercase">Stream Status</p>
                            <p className={`text-sm font-semibold mt-1 ${
                              camera.esp32StreamUrl ? "text-green-600" : "text-amber-600"
                            }`}>
                              {camera.esp32StreamUrl ? "✓ Configured" : "✗ Not Available"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

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

                {/* Captured Frames with AI Detection */}
                {hasEsp32Source && (
                  <div className="app-card p-6 border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg text-slate-900 flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        Captured Images (Database)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">Showing images stored in database (refreshes every 2 minutes). Live stream is prioritized when available.</p>

                    {dbFrames.length === 0 ? (
                      <p className="text-gray-500">No database images available yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {dbFrames.map((frame, idx) => (
                          <div key={frame.id || idx} className="border rounded-lg overflow-hidden cursor-pointer" onClick={() => setFullscreenImage(frame.imageUrl)}>
                            <img
                              src={frame.imageUrl}
                              alt="Captured"
                              className="w-full h-40 object-cover"
                              style={invertedPreviewStyle}
                            />

                            <div className="p-2">
                              <p className="text-xs font-semibold">{frame.crime_type?.replace(/_/g, " ") || "UNKNOWN"}</p>
                              <p className="text-xs text-gray-500">{formatDateTime(frame.createdAt || frame.updatedAt)}</p>
                              <p className="text-xs">Confidence: {Math.round((Number(frame.confidence) || 0) * 100)}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {captureError && (
                      <p className="text-xs text-red-600 mt-3">{captureError}</p>
                    )}
                    <canvas ref={canvasRef} style={{ display: "none" }} />
                  </div>
                )}
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
