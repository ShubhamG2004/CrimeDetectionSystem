"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Wifi, Camera, Radio, Clipboard } from "lucide-react";

import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import FieldOperatorSidebar from "@/components/FieldOperatorSidebar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const getCameraLabel = (camera) => {
  const name = camera.cameraName || camera.name || "Unnamed Camera";
  const location = camera.location || camera.area || "Unknown location";
  return `${name} (${location})`;
};

export default function ConnectEsp32Page() {
  const router = useRouter();

  const [approvedCameras, setApprovedCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [configResult, setConfigResult] = useState(null);

  const [form, setForm] = useState({
    cameraId: "",
    esp32Ip: "",
    streamPath: "/stream",
    capturePath: "/capture",
    uploadIntervalSec: "5",
  });

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

      try {
        const token = await user.getIdToken(true);
        const response = await fetch(`${API_URL}/api/operator/approved-cameras`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch approved cameras");
        }

        const cameras = Array.isArray(data.cameras) ? data.cameras : [];
        setApprovedCameras(cameras);

        if (cameras.length > 0) {
          setForm((prev) => ({
            ...prev,
            cameraId: prev.cameraId || cameras[0].id || cameras[0].cameraId,
            esp32Ip: prev.esp32Ip || "192.168.1.100",
          }));
        }
      } catch (error) {
        console.error("Failed to load approved cameras:", error);
        setMessage("Unable to load approved cameras right now.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const selectedCamera = useMemo(() => {
    return approvedCameras.find((camera) => {
      const id = camera.id || camera.cameraId;
      return id === form.cameraId;
    });
  }, [approvedCameras, form.cameraId]);

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied to clipboard.");
    } catch {
      setMessage("Could not copy automatically. Please copy manually.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setConfigResult(null);

    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }

    if (!form.cameraId || !form.esp32Ip) {
      setMessage("Camera and ESP32 IP are required.");
      return;
    }

    setSaving(true);

    try {
      const token = await auth.currentUser.getIdToken(true);
      const response = await fetch(`${API_URL}/api/operator/assign-esp32`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cameraId: form.cameraId,
          esp32Ip: form.esp32Ip,
          streamPath: form.streamPath,
          capturePath: form.capturePath,
          uploadIntervalSec: Number(form.uploadIntervalSec),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to save ESP32 config");
      }

      setConfigResult(data);
      setMessage("ESP32 configuration saved. Use the generated values in your ESP32 code.");
    } catch (error) {
      console.error("Failed to assign ESP32:", error);
      setMessage(error.message || "Failed to save ESP32 camera configuration.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell flex">
      <FieldOperatorSidebar />

      <div className="flex-1">
        <Navbar title="Connect ESP32 Camera" />

        <div className="p-6 space-y-5">
          <div className="app-card p-5 border-l-4 border-cyan-500">
            <h2 className="text-xl font-semibold text-slate-900">Assign Approved Camera To ESP32</h2>
            <p className="text-slate-600 text-sm mt-2">
              Select an admin-approved camera, set your ESP32 IP, and generate secure upload configuration. Once configured,
              ESP32 uploads will create incidents that appear in monitoring dashboards.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="app-card p-6 max-w-4xl space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm text-slate-700">
                <span className="font-semibold">Approved Camera</span>
                <select
                  className="app-input mt-1"
                  value={form.cameraId}
                  onChange={(e) => setForm((prev) => ({ ...prev, cameraId: e.target.value }))}
                  required
                >
                  <option value="">Select approved camera</option>
                  {approvedCameras.map((camera) => {
                    const id = camera.id || camera.cameraId;
                    return (
                      <option key={id} value={id}>
                        {getCameraLabel(camera)}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="text-sm text-slate-700">
                <span className="font-semibold">ESP32 IP Address</span>
                <input
                  className="app-input mt-1"
                  placeholder="192.168.1.100"
                  value={form.esp32Ip}
                  onChange={(e) => setForm((prev) => ({ ...prev, esp32Ip: e.target.value }))}
                  required
                />
              </label>

              <label className="text-sm text-slate-700">
                <span className="font-semibold">Stream Path</span>
                <input
                  className="app-input mt-1"
                  value={form.streamPath}
                  onChange={(e) => setForm((prev) => ({ ...prev, streamPath: e.target.value }))}
                />
              </label>

              <label className="text-sm text-slate-700">
                <span className="font-semibold">Capture Path</span>
                <input
                  className="app-input mt-1"
                  value={form.capturePath}
                  onChange={(e) => setForm((prev) => ({ ...prev, capturePath: e.target.value }))}
                />
              </label>

              <label className="text-sm text-slate-700 md:col-span-2">
                <span className="font-semibold">Upload Interval (seconds)</span>
                <input
                  type="number"
                  min="2"
                  max="120"
                  className="app-input mt-1"
                  value={form.uploadIntervalSec}
                  onChange={(e) => setForm((prev) => ({ ...prev, uploadIntervalSec: e.target.value }))}
                  required
                />
              </label>
            </div>

            {selectedCamera && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  <span>{selectedCamera.cameraName || selectedCamera.name || "Unnamed"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4" />
                  <span>{selectedCamera.location || selectedCamera.area || "Unknown"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  <span>Status: {(selectedCamera.status || "approved").toUpperCase()}</span>
                </div>
              </div>
            )}

            {message && <p className="text-sm text-slate-700">{message}</p>}

            <button type="submit" disabled={loading || saving || approvedCameras.length === 0} className="app-button disabled:opacity-60">
              {saving ? "Saving Configuration..." : "Assign Camera Configuration"}
            </button>

            {loading && <p className="text-sm text-slate-500">Loading approved cameras...</p>}
            {!loading && approvedCameras.length === 0 && (
              <p className="text-sm text-amber-700">No approved cameras available yet. Ask admin to approve your submitted camera first.</p>
            )}
          </form>

          {configResult && (
            <div className="app-card p-6 max-w-4xl space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Generated ESP32 Config</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="font-semibold text-slate-800">Camera ID</p>
                  <p className="mt-1 break-all text-slate-700">{configResult.uploadConfig?.cameraId}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="font-semibold text-slate-800">Upload URL</p>
                  <p className="mt-1 break-all text-slate-700">{configResult.uploadConfig?.uploadUrl}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 md:col-span-2">
                  <p className="font-semibold text-slate-800">Device Token</p>
                  <p className="mt-1 break-all text-slate-700">{configResult.uploadConfig?.deviceToken}</p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-green-300 font-mono text-xs leading-6 overflow-x-auto">
                <p>const char* CAMERA_ID = "{configResult.arduinoConfig?.CAMERA_ID}";</p>
                <p>const char* BACKEND_UPLOAD_URL = "{configResult.arduinoConfig?.BACKEND_UPLOAD_URL}";</p>
                <p>const char* DEVICE_TOKEN = "{configResult.arduinoConfig?.DEVICE_TOKEN}";</p>
                <p>const int UPLOAD_INTERVAL_MS = {configResult.arduinoConfig?.UPLOAD_INTERVAL_MS};</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleCopy(configResult.uploadConfig?.deviceToken || "")}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm inline-flex items-center gap-2"
                >
                  <Clipboard className="h-4 w-4" />
                  Copy Device Token
                </button>

                <a
                  href={configResult.esp32?.streamUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
                >
                  Open ESP32 Stream
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
