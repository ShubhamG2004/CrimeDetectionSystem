"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import FieldOperatorSidebar from "@/components/FieldOperatorSidebar";

export default function FieldOperatorAddCameraPage() {
  const router = useRouter();

  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    cameraName: "",
    ipAddress: "",
    location: "",
    latitude: "",
    longitude: "",
    policeStationId: "",
    description: "",
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

      const stationsSnap = await getDocs(collection(db, "policeStations"));
      const stationList = stationsSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setStations(stationList);
    });

    return () => unsub();
  }, [router]);

  const selectedStationName = useMemo(() => {
    const station = stations.find((s) => s.id === form.policeStationId);
    return station?.name || "";
  }, [stations, form.policeStationId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }

    if (
      !form.cameraName ||
      !form.ipAddress ||
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
      const payload = {
        cameraName: form.cameraName.trim(),
        ipAddress: form.ipAddress.trim(),
        location: form.location.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        policeStationId: form.policeStationId,
        policeStationName: selectedStationName,
        description: form.description.trim(),
        addedBy: auth.currentUser.uid,
        status: "pending",
        approvedBy: null,
        createdAt: serverTimestamp(),

        // Backward-compatible fields used by existing routes/services.
        name: form.cameraName.trim(),
        area: form.location.trim(),
        active: false,
      };

      const docRef = await addDoc(collection(db, "cameras"), payload);
      await updateDoc(docRef, { cameraId: docRef.id });

      setMessage("Camera submitted successfully. Waiting for admin approval.");
      setForm({
        cameraName: "",
        ipAddress: "",
        location: "",
        latitude: "",
        longitude: "",
        policeStationId: "",
        description: "",
      });
    } catch (error) {
      console.error("Failed to submit camera:", error);
      setMessage("Failed to submit camera. Please try again.");
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
                placeholder="IP Address"
                value={form.ipAddress}
                onChange={(e) => setForm({ ...form, ipAddress: e.target.value })}
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
                    {station.name}
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
