"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import OperatorSidebar from "@/components/OperatorSidebar";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function ImageDetectionPage() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedCamera, setSelectedCamera] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  /* ======================================================
     🔄 MOUNTED STATE - PREVENT HYDRATION ISSUES
     ====================================================== */
  useEffect(() => {
    setMounted(true);
  }, []);

  /* ======================================================
     🎥 FETCH CAMERAS AFTER AUTH IS READY
     ====================================================== */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const token = await user.getIdToken();

        const res = await fetch(
          "http://localhost:5000/api/operator/cameras",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();

        if (Array.isArray(data)) {
          setCameras(data);
        } else {
          console.warn("Unexpected cameras response:", data);
          setCameras([]);
        }
      } catch (err) {
        console.error("Failed to fetch cameras:", err);
        setCameras([]);
      }
    });

    return () => unsubscribe();
  }, []);

  /* ================= IMAGE HANDLER ================= */
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 16MB)
    if (file.size > 16 * 1024 * 1024) {
      setError("File size too large. Max 16MB allowed.");
      return;
    }

    // Check file type
    const validTypes = ["image/jpeg", "image/png", "image/jpg", "image/bmp"];
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Please upload JPEG, PNG, or BMP images.");
      return;
    }

    setImage(file);
    setPreview(URL.createObjectURL(file));
    setError("");
    setResult(null);
  };

  /* ================= CAMERA SELECT ================= */
  const handleCameraChange = (cameraId) => {
    setSelectedCameraId(cameraId);
    const cam = cameras.find((c) => c.cameraId === cameraId);
    setSelectedCamera(cam || null);
  };

  /* ================= CALCULATE THREAT SCORE ================= */
  const calculateThreatScore = (data) => {
    // If threat_score is provided, use it
    if (data.threat_score !== undefined) {
      return data.threat_score;
    }
    
    // Otherwise calculate based on confidence and threat level
    let baseScore = 0;
    
    // Base on confidence
    const confidence = data.confidence || 0;
    baseScore = Math.round(confidence * 100);
    
    // Adjust based on threat level
    const threatLevel = data.threat_level?.toUpperCase() || "LOW";
    switch (threatLevel) {
      case "CRITICAL":
        return Math.min(100, baseScore + 40);
      case "HIGH":
        return Math.min(100, baseScore + 25);
      case "MEDIUM":
        return Math.min(100, baseScore + 15);
      case "LOW":
        return baseScore;
      default:
        return baseScore;
    }
  };

  /* ================= DETERMINE CRIME STATUS ================= */
  const determineCrimeStatus = (data) => {
    // If crime_detected is explicitly set, use it
    if (data.crime_detected !== undefined) {
      return data.crime_detected;
    }
    
    // Otherwise infer from threat level and crime type
    const threatLevel = data.threat_level?.toUpperCase() || "LOW";
    const crimeType = data.crime_type || data.type || "";
    const confidence = data.confidence || 0;
    
    // If it's a serious crime type or high threat level, mark as crime detected
    const seriousCrimes = ["KIDNAPPING", "ABDUCTION", "ASSAULT", "ROBBERY", "FIGHT"];
    const isSeriousCrime = seriousCrimes.some(crime => 
      crimeType.toUpperCase().includes(crime)
    );
    
    return isSeriousCrime || threatLevel === "HIGH" || threatLevel === "CRITICAL" || confidence > 0.7;
  };

  /* ================= SUBMIT ================= */
  const submitImage = async () => {
    if (!image || !selectedCamera) {
      alert("Please select a camera and upload an image");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("image", image);
    formData.append(
      "location",
      JSON.stringify({
        name: selectedCamera.area,
        lat: selectedCamera.latitude,
        lng: selectedCamera.longitude,
        cameraId: selectedCamera.cameraId,
      })
    );

    try {
      const res = await fetch(
        "http://localhost:5000/api/detect/image",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Detection failed");
      }

      console.log("✅ SAVED TO DB:", data);

      // Process the response data
      const processedData = {
        ...data.data,
        confidence: Number(data.data.confidence) || 0,
        persons_detected: Number(data.data.persons_detected) || 0,
        threat_score: calculateThreatScore(data.data),
        crime_detected: determineCrimeStatus(data.data),
      };

      setResult(processedData);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ================= RESET ================= */
  const resetForm = () => {
    setImage(null);
    setPreview(null);
    setSelectedCamera(null);
    setSelectedCameraId("");
    setResult(null);
    setError("");
  };

  /* ================= THREAT LEVEL COLORS ================= */
  const getThreatColor = (level) => {
    switch (level?.toUpperCase()) {
      case "CRITICAL":
        return "text-red-700";
      case "HIGH":
        return "text-red-600";
      case "MEDIUM":
        return "text-orange-600";
      case "LOW":
        return "text-yellow-600";
      default:
        return "text-gray-600";
    }
  };

  const getThreatBgColor = (level) => {
    switch (level?.toUpperCase()) {
      case "CRITICAL":
        return "bg-red-100";
      case "HIGH":
        return "bg-red-50";
      case "MEDIUM":
        return "bg-orange-50";
      case "LOW":
        return "bg-yellow-50";
      default:
        return "bg-gray-50";
    }
  };

  /* ================= GET CRIME TYPE DISPLAY ================= */
  const getCrimeTypeDisplay = (data) => {
    if (data.crime_type) return data.crime_type;
    if (data.type) return data.type;
    
    // If crime is detected but no type specified, show generic message
    if (data.crime_detected) {
      const threatLevel = data.threat_level?.toUpperCase();
      if (threatLevel === "CRITICAL" || threatLevel === "HIGH") {
        return "Violent Activity";
      }
      return "Suspicious Activity";
    }
    
    return "Normal Activity";
  };

  return (
    <div className="flex h-screen bg-transparent overflow-hidden">
      <OperatorSidebar />
      <div className="flex-1 bg-transparent">
        <div className="sticky top-0 z-20">
          <Navbar title="🖼️ AI Crime Image Detection" />
        </div>

        <div className="h-full overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-8">
          {/* HEADER */}
          <div className="text-center mb-8">
            <div className="app-badge mx-auto w-fit">Image analysis</div>
            <h1 className="mt-4 text-3xl font-semibold text-slate-900 mb-2">
              AI-Powered Crime Detection
            </h1>
            <p className="text-slate-600">
              Upload an image to detect potential crimes using pose analysis
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT COLUMN - UPLOAD FORM */}
            <div className="app-card p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              Upload & Detect
            </h2>

            {/* CAMERA SELECTION */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Camera *
              </label>
              <select
                className="app-input"
                value={selectedCameraId}
                onChange={(e) => handleCameraChange(e.target.value)}
              >
                <option value="">-- Select Camera --</option>
                {cameras.map((cam) => (
                  <option key={cam.cameraId} value={cam.cameraId}>
                    {cam.name} ({cam.area})
                  </option>
                ))}
              </select>
              {cameras.length === 0 && (
                <p className="text-sm text-slate-500 mt-2">
                  No cameras assigned to you
                </p>
              )}
              {selectedCamera && (
                <div className="mt-2 p-3 bg-cyan-50 rounded-lg">
                  <p className="text-sm font-medium text-cyan-800">
                    📍 {selectedCamera.area}
                  </p>
                  <p className="text-xs text-cyan-600">
                    Lat: {selectedCamera.latitude}, Lng: {selectedCamera.longitude}
                  </p>
                </div>
              )}
            </div>

            {/* IMAGE UPLOAD */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Image *
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-cyan-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer block"
                >
                  {preview ? (
                    <div className="relative">
                      <img
                        src={preview}
                        alt="preview"
                        className="w-full h-64 object-cover rounded-lg mb-3"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreview(null);
                          setImage(null);
                        }}
                        className="absolute top-2 right-2 bg-rose-500 text-white p-1 rounded-full hover:bg-rose-600"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mx-auto w-12 h-12 mb-3 text-slate-400">
                        📷
                      </div>
                      <p className="text-slate-500">
                        Click to upload image
                      </p>
                      <p className="text-sm text-slate-400 mt-1">
                        Supports JPG, PNG, BMP (max 16MB)
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600">
                ⚠️ {error}
              </div>
            )}

            {/* BUTTONS */}
            <div className="flex gap-3">
              <button
                onClick={submitImage}
                disabled={loading || !image || !selectedCamera}
                className="flex-1 app-button disabled:opacity-50 disabled:bg-slate-400"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Detecting...
                  </>
                ) : (
                  <>
                    🔍 Detect Crime
                  </>
                )}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-slate-700"
              >
                Clear
              </button>
            </div>

            {/* INFO TIPS */}
            <div className="mt-6 p-4 bg-cyan-50 rounded-lg">
              <h4 className="font-medium text-cyan-800 mb-2">💡 Tips:</h4>
              <ul className="text-sm text-cyan-700 space-y-1">
                <li>• Ensure people are clearly visible in the image</li>
                <li>• Well-lit images work better for detection</li>
                <li>• Multiple people interactions will be analyzed</li>
                <li>• System detects punches, kicks, grabs, falls, and more</li>
                <li>• Camera location will be automatically recorded</li>
              </ul>
            </div>
          </div>

          {/* RIGHT COLUMN - RESULTS */}
            <div className="app-card p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              Detection Results
            </h2>

            {result ? (
              <>
                {/* CRIME STATUS */}
                <div className={`mb-6 p-4 rounded-lg border ${result.crime_detected ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">
                      {result.crime_detected ? '🚨 Crime Detected' : '✅ No Crime Detected'}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${result.crime_detected ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {result.crime_detected ? 'ALERT' : 'SAFE'}
                    </span>
                  </div>
                  <p className="text-slate-700">
                    {getCrimeTypeDisplay(result)}
                  </p>
                </div>

                {/* METRICS GRID */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm text-slate-500">Confidence</div>
                    <div className="text-2xl font-bold text-cyan-700">
                      {Math.round((result.confidence || 0) * 100)}%
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg ${getThreatBgColor(result.threat_level)}`}>
                    <div className="text-sm text-slate-500">Threat Level</div>
                    <div className={`text-xl font-bold ${getThreatColor(result.threat_level)}`}>
                      {result.threat_level || "LOW"}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm text-slate-500">People Detected</div>
                    <div className="text-2xl font-bold text-slate-800">
                      {result.persons_detected || 0}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm text-slate-500">Threat Score</div>
                    <div className="text-2xl font-bold text-slate-800">
                      {result.threat_score || 0}/100
                    </div>
                  </div>
                </div>

                {/* DETAILS */}
                <div className="space-y-4">
                  {result.activities && result.activities.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Activities Detected</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.activities.map((activity, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                          >
                            {activity.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.signals && result.signals.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Threat Signals</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.signals.map((signal, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                          >
                            {signal.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Location</h4>
                    <p className="text-gray-800">
                      {typeof result.location === "object"
                        ? (result.location?.name || selectedCamera?.area || "Unknown")
                        : (result.location || selectedCamera?.area || "Unknown")}
                    </p>
                    {typeof result.location === "object" &&
                      result.location?.lat != null &&
                      result.location?.lng != null ? (
                        <p className="text-sm text-gray-600">
                          📍 Lat: {result.location.lat}, Lng: {result.location.lng}
                        </p>
                      ) : selectedCamera && (
                        <p className="text-sm text-gray-600">
                          📍 Lat: {selectedCamera.latitude}, Lng: {selectedCamera.longitude}
                        </p>
                      )}
                  </div>

                  <div className="text-sm text-gray-500">
                    {mounted && (
                      <p>
                        Timestamp: {result.timestamp 
                          ? new Date(result.timestamp).toLocaleString([], {
                              year: "numeric",
                              month: "short", 
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : new Date().toLocaleString([], {
                              year: "numeric",
                              month: "short",
                              day: "numeric", 
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                        }
                      </p>
                    )}
                    {selectedCamera && (
                      <p>Camera: {selectedCamera.name}</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* EMPTY STATE */
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                  No Detection Yet
                </h3>
                <p className="text-gray-500">
                  Select a camera, upload an image and click "Detect Crime" to see results
                </p>
              </div>
            )}
          </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}