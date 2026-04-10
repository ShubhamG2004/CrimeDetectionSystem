"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import { ArrowLeft, Camera, AlertTriangle, Maximize2, Signal, ShieldAlert } from "lucide-react";
import Link from "next/link";

import Navbar from "@/components/Navbar";
import OperatorSidebar from "@/components/OperatorSidebar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const getCameraName = (camera) => camera?.cameraName || camera?.name || "Unnamed Camera";
const toTitle = (value) => String(value || "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const getThreatTone = (level) => {
  const normalized = String(level || "LOW").toUpperCase();

  if (normalized === "CRITICAL") {
    return {
      pill: "bg-red-100 text-red-800 border-red-200",
      card: "border-red-200 bg-red-50",
      text: "text-red-900",
    };
  }

  if (normalized === "HIGH") {
    return {
      pill: "bg-orange-100 text-orange-800 border-orange-200",
      card: "border-orange-200 bg-orange-50",
      text: "text-orange-900",
    };
  }

  if (normalized === "MEDIUM") {
    return {
      pill: "bg-yellow-100 text-yellow-800 border-yellow-200",
      card: "border-yellow-200 bg-yellow-50",
      text: "text-yellow-900",
    };
  }

  return {
    pill: "bg-emerald-100 text-emerald-800 border-emerald-200",
    card: "border-emerald-200 bg-emerald-50",
    text: "text-emerald-900",
  };
};

export default function LaptopCameraMonitoringPage() {
  const router = useRouter();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const captureIntervalRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState("");
  const [assignedCameras, setAssignedCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [detectError, setDetectError] = useState("");
  const [latestDetection, setLatestDetection] = useState(null);
  const [lastDetectionAt, setLastDetectionAt] = useState(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError("");

      if (!navigator?.mediaDevices?.getUserMedia) {
        setError("Camera access is not supported by this browser.");
        setLoading(false);
        return;
      }

      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraReady(true);
      setLoading(false);
    } catch (err) {
      console.error("Failed to open laptop camera:", err);
      setError("Unable to access laptop camera. Please allow permissions and try again.");
      setLoading(false);
      setCameraReady(false);
    }
  }, [stopCamera]);

  const captureAndDetect = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !auth.currentUser || !selectedCameraId) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      setDetectError("");
      const token = await auth.currentUser.getIdToken(true);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (value) => {
            if (!value) {
              reject(new Error("Unable to capture frame"));
              return;
            }
            resolve(value);
          },
          "image/jpeg",
          0.9
        );
      });

      const selectedCamera = assignedCameras.find((item) => item.cameraId === selectedCameraId);

      const formData = new FormData();
      formData.append("image", blob, "laptop-capture.jpg");
      formData.append("cameraId", selectedCameraId);
      formData.append(
        "location",
        JSON.stringify({
          cameraId: selectedCameraId,
          name: selectedCamera?.area || selectedCamera?.location || "Laptop Camera",
          lat: selectedCamera?.latitude,
          lng: selectedCamera?.longitude,
        })
      );

      const response = await fetch(`${API_URL}/api/detect/image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Detection failed");
      }

      setLatestDetection(payload.data || null);
      setLastDetectionAt(new Date());
    } catch (err) {
      console.error("Laptop capture detection failed:", err);
      setDetectError(err.message || "Detection failed for latest frame");
    }
  }, [assignedCameras, selectedCameraId]);

  useEffect(() => {
    let unsubscribe;

    const setupAuth = async () => {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }

        if (localStorage.getItem("role") !== ROLES.OPERATOR) {
          router.replace("/dashboard");
          return;
        }

        try {
          const token = await user.getIdToken(true);
          const cameraResponse = await fetch(`${API_URL}/api/operator/cameras`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const cameraData = await cameraResponse.json();

          if (!cameraResponse.ok) {
            throw new Error(cameraData?.message || "Unable to load assigned cameras");
          }

          const normalized = Array.isArray(cameraData)
            ? cameraData.map((item) => ({ ...item, cameraId: item.cameraId || item.id })).filter((item) => item.cameraId)
            : [];

          setAssignedCameras(normalized);
          if (normalized.length > 0) {
            setSelectedCameraId(normalized[0].cameraId);
          }
        } catch (err) {
          console.error("Unable to load assigned cameras for laptop monitor:", err);
          setError("Unable to load assigned cameras. Please try again.");
        }

        await startCamera();
      });
    };

    setupAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
      stopCamera();
    };
  }, [router, startCamera, stopCamera]);

  useEffect(() => {
    if (!cameraReady || !selectedCameraId) return;

    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }

    captureIntervalRef.current = setInterval(() => {
      captureAndDetect();
    }, 5000);

    return () => {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
    };
  }, [cameraReady, selectedCameraId, captureAndDetect]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="w-64 bg-white shadow-md overflow-hidden">
        <OperatorSidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-10 bg-white shadow">
          <Navbar title="Laptop Live Monitoring" />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
              <div className="absolute -right-12 -top-10 h-36 w-36 rounded-full bg-cyan-100/70 blur-3xl" />
              <div className="absolute -bottom-10 left-16 h-32 w-32 rounded-full bg-indigo-100/70 blur-3xl" />

              <div className="relative flex items-start justify-between gap-4">
                <div>
                <Link
                  href="/dashboard/operator/cameras"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-3 transition"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Cameras
                </Link>
                <h1 className="text-3xl font-bold text-slate-900 mt-1">Laptop Camera</h1>
                <p className="text-slate-600 mt-2">Live monitoring from your local device webcam with auto capture every 5 seconds.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 shadow-sm">
                  <div className={`h-2 w-2 rounded-full ${cameraReady ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></div>
                  <span className="text-sm font-semibold text-emerald-800">{cameraReady ? "Live" : "Idle"}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden lg:col-span-2">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Camera className="h-4 w-4 text-blue-600" />
                    Local Live Feed
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedCameraId}
                      onChange={(event) => setSelectedCameraId(event.target.value)}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
                      disabled={assignedCameras.length === 0}
                    >
                      {assignedCameras.map((camera) => (
                        <option key={camera.cameraId} value={camera.cameraId}>
                          {getCameraName(camera)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={startCamera}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      Refresh Feed
                    </button>
                  </div>
                </div>

                <div className="bg-gradient-to-b from-slate-100 to-white p-4">
                  {assignedCameras.length === 0 && (
                    <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      No assigned cameras available. Assign at least one camera to process detections.
                    </p>
                  )}

                  <div className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-300 bg-slate-900 shadow-inner">
                    <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                      <span className={`h-1.5 w-1.5 rounded-full ${cameraReady ? "bg-emerald-400 animate-pulse" : "bg-slate-300"}`}></span>
                      {cameraReady ? "LIVE MONITOR" : "WAITING"}
                    </div>

                    <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-blue-600/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                      <Signal className="h-3 w-3" />
                      5s Capture
                    </div>

                    {loading ? (
                      <div className="flex h-full items-center justify-center text-slate-300">Initializing camera...</div>
                    ) : error ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-rose-200">
                        <AlertTriangle className="h-8 w-8 text-rose-400" />
                        <p>{error}</p>
                        <button
                          onClick={startCamera}
                          className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-900/30"
                        >
                          Retry Camera
                        </button>
                      </div>
                    ) : (
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-700">Crime Details</h3>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    Auto-refresh 5s
                  </span>
                </div>
                {detectError && <p className="text-xs text-rose-700 mb-2">{detectError}</p>}

                {latestDetection ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <ShieldAlert className="h-4 w-4 text-blue-600" />
                        Detection Status
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getThreatTone(latestDetection.threat_level).pill}`}>
                        {String(latestDetection.threat_level || "LOW").toUpperCase()}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] uppercase text-slate-500">Crime Type</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{toTitle(latestDetection.crime_type || "Normal")}</p>
                      </div>
                      <div className={`rounded-lg border p-3 ${getThreatTone(latestDetection.threat_level).card}`}>
                        <p className="text-[10px] uppercase text-slate-500">Threat Level</p>
                        <p className={`mt-1 text-sm font-semibold ${getThreatTone(latestDetection.threat_level).text}`}>{latestDetection.threat_level || "LOW"}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] uppercase text-slate-500">Threat Score</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{Math.round(Number(latestDetection.threat_score) || 0)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] uppercase text-slate-500">Confidence</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{Math.round((Number(latestDetection.confidence) || 0) * 100)}%</p>
                      </div>
                    </div>

                    {(latestDetection.activities?.length || latestDetection.signals?.length) > 0 && (
                      <div className="grid gap-3">
                        <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
                          <p className="text-[10px] font-semibold uppercase text-cyan-700">Activities</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(latestDetection.activities || []).slice(0, 8).map((item, idx) => (
                              <span key={`activity-${idx}`} className="rounded-full border border-cyan-200 bg-white px-2 py-0.5 text-[11px] font-medium text-cyan-800">
                                {toTitle(item)}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                          <p className="text-[10px] font-semibold uppercase text-rose-700">Signals</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(latestDetection.signals || []).slice(0, 8).map((item, idx) => (
                              <span key={`signal-${idx}`} className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-medium text-rose-800">
                                {toTitle(item)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No detection yet. First frame will be analyzed after 5 seconds.</p>
                )}

                <p className="mt-3 text-xs text-slate-500">
                  Last update: {lastDetectionAt ? lastDetectionAt.toLocaleTimeString() : "Waiting..."}
                </p>
              </div>
            </div>

            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
