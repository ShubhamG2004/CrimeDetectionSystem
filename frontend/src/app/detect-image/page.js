"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";

export default function ImageDetectionPage() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [locationName, setLocationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  /* ---------- HANDLE IMAGE ---------- */
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  /* ---------- SUBMIT IMAGE ---------- */
  const submitImage = async () => {
    if (!image || !locationName) {
      alert("Please upload an image and enter location");
      return;
    }

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("image", image);
    formData.append("locationName", locationName);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/detect/image`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();
      setResult(data);
    } catch (error) {
      alert("Crime detection failed");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar title="🖼️ Crime Image Detection" />

      <div className="max-w-xl mx-auto bg-white p-6 mt-6 rounded-lg shadow">
        {/* IMAGE UPLOAD */}
        <label className="block mb-2 font-semibold">
          Upload Image
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="mb-3"
        />

        {preview && (
          <img
            src={preview}
            alt="preview"
            className="w-full h-64 object-cover rounded mb-4 border"
          />
        )}

        {/* LOCATION INPUT */}
        <label className="block mb-2 font-semibold">
          Location / Area
        </label>
        <input
          type="text"
          placeholder="e.g. Parking Area, Gate 2, Pune"
          className="w-full p-2 border rounded mb-4"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
        />

        {/* SUBMIT BUTTON */}
        <button
          onClick={submitImage}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold"
        >
          {loading ? "🔍 Detecting Crime..." : "🚨 Detect Crime"}
        </button>

        {/* RESULT */}
        {result && (
          <div className="mt-6 border-t pt-4">
            <h3 className="font-bold mb-3 text-lg">
              Detection Result
            </h3>

            <p className="mb-1">
              <strong>Crime Type:</strong>{" "}
              <span className="text-red-600 font-semibold">
                {result.type || "NO_CRIME"}
              </span>
            </p>

            <p className="mb-1">
              <strong>Confidence:</strong>{" "}
              {Math.round((result.confidence || 0) * 100)}%
            </p>

            <p className="mb-1">
              <strong>Threat Level:</strong>{" "}
              {result.threat_level || "LOW"}
            </p>

            <p className="mb-1">
              <strong>People Detected:</strong>{" "}
              {result.persons_detected ?? 0}
            </p>

            <p className="mb-1">
              <strong>Location:</strong>{" "}
              {locationName}
            </p>

            {result.activities?.length > 0 && (
              <p className="mt-2 text-sm text-gray-600">
                <strong>Activities:</strong>{" "}
                {result.activities.join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
