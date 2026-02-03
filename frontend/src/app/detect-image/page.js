"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";

export default function ImageDetectionPage() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  /* ---------- HANDLE IMAGE ---------- */
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

  /* ---------- SUBMIT IMAGE ---------- */
  const submitImage = async () => {
    if (!image) {
      alert("Please upload an image");
      return;
    }

    if (!location.trim()) {
      alert("Please enter location name");
      return;
    }

    setLoading(true);
    setResult(null);
    setError("");

    const formData = new FormData();
    formData.append("image", image);
    formData.append("location", location);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/detect-image`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (!data.success) {
        setError(data.error || "Detection failed");
        return;
      }

      // Debug log
      console.log("Response from server:", data);
      
      // Ensure persons_detected is a number
      const personsDetected = parseInt(data.persons_detected) || 0;
      
      setResult({
        ...data,
        persons_detected: personsDetected,
        confidence: parseFloat(data.confidence) || 0,
        threat_score: parseInt(data.threat_score) || 0
      });

    } catch (error) {
      console.error("Detection error:", error);
      setError(error.message || "Failed to connect to detection server");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- RESET ---------- */
  const resetForm = () => {
    setImage(null);
    setPreview(null);
    setLocation("");
    setResult(null);
    setError("");
  };

  /* ---------- THREAT LEVEL COLORS ---------- */
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Navbar title="🖼️ AI Crime Image Detection" />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* HEADER */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            AI-Powered Crime Detection
          </h1>
          <p className="text-gray-600">
            Upload an image to detect potential crimes using pose analysis
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT COLUMN - UPLOAD FORM */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Upload & Detect
            </h2>

            {/* IMAGE UPLOAD */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Image *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
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
                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mx-auto w-12 h-12 mb-3 text-gray-400">
                        📷
                      </div>
                      <p className="text-gray-500">
                        Click to upload image
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Supports JPG, PNG, BMP (max 16MB)
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* LOCATION INPUT */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location Name *
              </label>
              <input
                type="text"
                placeholder="e.g., Parking Area, Gate 2, Pune"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600">
                ⚠️ {error}
              </div>
            )}

            {/* BUTTONS */}
            <div className="flex gap-3">
              <button
                onClick={submitImage}
                disabled={loading || !image || !location}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
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
                className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            </div>

            {/* INFO TIPS */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">💡 Tips:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Ensure people are clearly visible in the image</li>
                <li>• Well-lit images work better for detection</li>
                <li>• Multiple people interactions will be analyzed</li>
                <li>• System detects punches, kicks, grabs, falls, and more</li>
              </ul>
            </div>
          </div>

          {/* RIGHT COLUMN - RESULTS */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
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
                  <p className="text-gray-700">
                    {result.type || "Normal Activity"}
                  </p>
                </div>

                {/* METRICS GRID */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">Confidence</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round((result.confidence || 0) * 100)}%
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg ${getThreatBgColor(result.threat_level)}`}>
                    <div className="text-sm text-gray-500">Threat Level</div>
                    <div className={`text-xl font-bold ${getThreatColor(result.threat_level)}`}>
                      {result.threat_level || "LOW"}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">People Detected</div>
                    <div className="text-2xl font-bold text-gray-800">
                      {result.persons_detected || 0}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">Threat Score</div>
                    <div className="text-2xl font-bold text-gray-800">
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
                            {activity}
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
                            {signal}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Location</h4>
                    <p className="text-gray-800">{result.location || location}</p>
                  </div>

                  <div className="text-sm text-gray-500">
                    <p>Timestamp: {result.timestamp ? new Date(result.timestamp).toLocaleString() : new Date().toLocaleString()}</p>
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
                  Upload an image and click "Detect Crime" to see results
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}