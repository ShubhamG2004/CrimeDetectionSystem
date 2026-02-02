"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import Navbar from "@/components/Navbar";
import OperatorSidebar from "@/components/OperatorSidebar";

export default function OperatorDashboard() {
  const router = useRouter();
  const checkedRef = useRef(false);

  const [incidents, setIncidents] = useState([]);
  const [cameraFilter, setCameraFilter] = useState("all");

  /* ---------- AUTH GUARD ---------- */
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      if (localStorage.getItem("role") !== "operator") {
        router.replace("/dashboard/admin");
      }
    });

    return () => unsub();
  }, [router]);

  /* ---------- FETCH INCIDENTS ---------- */
  useEffect(() => {
    const fetchIncidents = async () => {
      const q = query(
        collection(db, "incidents"),
        orderBy("timestamp", "desc")
      );
      const snap = await getDocs(q);
      setIncidents(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    };

    fetchIncidents();
  }, []);

  /* ---------- FILTER ---------- */
  const filteredIncidents =
    cameraFilter === "all"
      ? incidents
      : incidents.filter(
          (i) => i.cameraId === cameraFilter
        );

  /* ---------- SEVERITY ---------- */
  const getSeverityColor = (type) => {
    if (type?.includes("FIGHT")) return "bg-red-600";
    if (type?.includes("INTRUSION")) return "bg-orange-500";
    return "bg-yellow-500";
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* SIDEBAR */}
      <OperatorSidebar />

      {/* MAIN CONTENT */}
      <div className="flex-1">
        <Navbar title="👮 Operator Control Dashboard" />

        <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* FILTER PANEL */}
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-bold mb-3">🎥 Filters</h3>

            <label className="block text-sm mb-1">
              Camera
            </label>
            <select
              className="w-full p-2 border rounded"
              value={cameraFilter}
              onChange={(e) =>
                setCameraFilter(e.target.value)
              }
            >
              <option value="all">All</option>
              {[...new Set(
                incidents.map((i) => i.cameraId)
              )].map((cam) => (
                <option key={cam} value={cam}>
                  {cam}
                </option>
              ))}
            </select>
          </div>

          {/* INCIDENT FEED */}
          <div className="lg:col-span-3 space-y-4">
            {filteredIncidents.map((i) => (
              <div
                key={i.id}
                className="bg-white rounded shadow p-4 flex gap-4"
              >
                {/* IMAGE */}
                {i.imageUrl && (
                  <img
                    src={i.imageUrl}
                    alt="incident"
                    className="w-40 h-28 object-cover rounded"
                  />
                )}

                {/* DETAILS */}
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg">
                      {i.type?.replace("_", " ")}
                    </h3>
                    <span
                      className={`text-white text-xs px-2 py-1 rounded ${getSeverityColor(
                        i.type
                      )}`}
                    >
                      ALERT
                    </span>
                  </div>

                  <p className="text-sm text-gray-600">
                    📍 {i.location?.name || "Unknown"}
                  </p>
                  <p className="text-sm">
                    🎥 Camera: {i.cameraId}
                  </p>
                  <p className="text-sm">
                    🔍 Confidence:{" "}
                    {(i.confidence * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-500">
                    ⏱{" "}
                    {i.timestamp
                      ?.toDate()
                      .toLocaleString()}
                  </p>
                </div>
              </div>
            ))}

            {filteredIncidents.length === 0 && (
              <p className="text-center text-gray-500">
                No incidents found
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
