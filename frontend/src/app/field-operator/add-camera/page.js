"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import dynamic from "next/dynamic";
import { auth, db } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import FieldOperatorSidebar from "@/components/FieldOperatorSidebar";

const LocationPickerMap = dynamic(
  () => import("@/components/LocationPickerMap"),
  { ssr: false }
);

export default function FieldOperatorAddCameraPage() {
  const router = useRouter();

  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  const [form, setForm] = useState({
    cameraName: "",
    location: "",
    latitude: "",
    longitude: "",
    policeStationId: "",
    description: "",
  });

  const getStationLabel = (station) => {
    if (!station) return "";
    return (
      station.stationName ||
      station.name ||
      station.title ||
      "Unnamed Station"
    );
  };

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
        // Primary source: backend enforces creator-admin scoping.
        const token = await user.getIdToken();
        const response = await fetch("http://localhost:5000/api/operator/police-stations", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }

        const data = await response.json();
        setStations(Array.isArray(data) ? data : []);
        setLoadError("");
      } catch (error) {
        console.error("Failed to load police stations:", error);
        const isPermissionDenied = (error?.code || "").includes("permission-denied") || String(error?.message || "").includes("HTTP_403");

        try {
          // Fallback path if backend is temporarily unavailable.
          const fieldOperatorSnap = await getDoc(doc(db, "field_operator", user.uid));
          const creatorAdminUid = fieldOperatorSnap.data()?.createdBy;

          if (!creatorAdminUid) {
            setStations([]);
            setLoadError("");
            return;
          }

          const scopedStationsSnap = await getDocs(
            query(
              collection(db, "policeStations"),
              where("createdBy", "==", creatorAdminUid)
            )
          );

          const scopedStations = scopedStationsSnap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));

          setStations(scopedStations);
          setLoadError("");
          return;
        } catch (fallbackError) {
          console.error("Fallback police station load failed:", fallbackError);
        }

        setLoadError(
          isPermissionDenied
            ? "Access denied while loading police stations. Please re-login or contact admin."
            : "Unable to load police stations right now."
        );
      }
    });

    return () => unsub();
  }, [router]);

  const selectedStationName = useMemo(() => {
    const station = stations.find((s) => s.id === form.policeStationId);
    return getStationLabel(station);
  }, [stations, form.policeStationId]);

  const mapPinLocation = useMemo(() => {
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
      };
    }

    return null;
  }, [form.latitude, form.longitude]);

  const updateLocationFields = (lat, lng) => {
    setForm((prev) => ({
      ...prev,
      latitude: Number(lat).toFixed(6),
      longitude: Number(lng).toFixed(6),
    }));
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported by your browser.");
      return;
    }

    setGeoLoading(true);
    setMessage("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocationFields(position.coords.latitude, position.coords.longitude);
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        setMessage("Unable to fetch your current location. Please allow location permission.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }

    if (
      !form.cameraName ||
      !form.location ||
      !form.latitude ||
      !form.longitude ||
      !form.policeStationId
    ) {
      setMessage("Please fill all required fields.");
      return;
    }

    setLoading(true);

    try {
      const token = await auth.currentUser.getIdToken(true);

      const payload = {
        cameraName: form.cameraName.trim(),
        location: form.location.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        policeStationId: form.policeStationId,
        policeStationName: selectedStationName,
        description: form.description.trim(),
      };

      // Use backend API instead of direct Firestore write
      const response = await fetch("http://localhost:5000/api/operator/submit-camera", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || `HTTP ${response.status}: Failed to submit camera`
        );
      }

      setMessage("✅ Camera submitted successfully. Waiting for admin approval.");
      setForm({
        cameraName: "",
        location: "",
        latitude: "",
        longitude: "",
        policeStationId: "",
        description: "",
      });

      // Optionally redirect to my-cameras after success
      setTimeout(() => {
        router.push("/field-operator/my-cameras");
      }, 1500);
    } catch (error) {
      console.error("Failed to submit camera:", error);

      const isPermissionError =
        error?.message?.includes("permission") ||
        error?.message?.includes("403");

      if (isPermissionError) {
        setMessage(
          "❌ Permission denied. Your account may not have the field_operator role set. Contact your admin."
        );
      } else if (error?.message?.includes("Police station")) {
        setMessage("❌ Selected police station is not available to you.");
      } else {
        setMessage(
          error?.message || "Failed to submit camera. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell flex">
      <FieldOperatorSidebar />

      <div className="flex-1">
        <Navbar title="Submit Camera For Approval" />

        <div className="p-6">
          <form onSubmit={handleSubmit} className="app-card p-6 max-w-3xl">
            <h2 className="text-xl font-semibold text-slate-900 mb-5">Camera Details</h2>

            {loadError && (
              <p className="mb-4 text-sm text-rose-700">{loadError}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                className="app-input"
                placeholder="Camera Name"
                value={form.cameraName}
                onChange={(e) => setForm({ ...form, cameraName: e.target.value })}
                required
              />

              <input
                className="app-input"
                placeholder="Location Name"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
              />

              <select
                className="app-input"
                value={form.policeStationId}
                onChange={(e) => setForm({ ...form, policeStationId: e.target.value })}
                required
              >
                <option value="">Select Police Station</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {getStationLabel(station)}
                  </option>
                ))}
              </select>

              <input
                type="number"
                step="any"
                className="app-input"
                placeholder="Latitude"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                required
              />

              <input
                type="number"
                step="any"
                className="app-input"
                placeholder="Longitude"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                required
              />
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="text-sm font-semibold text-slate-700">Location Picker</p>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={geoLoading}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-60"
                >
                  {geoLoading ? "Detecting..." : "Use Current Location"}
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-3">
                Click on map to fill latitude and longitude automatically.
              </p>

              <LocationPickerMap
                value={mapPinLocation}
                onChange={(point) => updateLocationFields(point.lat, point.lng)}
                height="300px"
              />

              <div className="mt-2 text-xs text-slate-600">
                {mapPinLocation
                  ? `Selected: ${mapPinLocation.lat}, ${mapPinLocation.lng}`
                  : "No location selected yet."}
              </div>
            </div>

            <textarea
              className="app-input mt-4 min-h-28"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />

            {message && (
              <p className="text-sm mt-4 text-slate-700">{message}</p>
            )}

            <div className="mt-5 flex gap-3">
              <button type="submit" disabled={loading} className="app-button disabled:opacity-60">
                {loading ? "Submitting..." : "Submit For Approval"}
              </button>
              <a
                href="/field-operator/my-cameras"
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                View My Cameras
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
