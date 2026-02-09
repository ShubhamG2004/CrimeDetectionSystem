"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import dynamic from "next/dynamic";

// ✅ Client-only charts
const AnalyticsCharts = dynamic(
  () => import("@/components/AnalyticsCharts"),
  { ssr: false }
);

export default function Analytics() {
  const [dailyData, setDailyData] = useState([]);
  const [severityData, setSeverityData] = useState([]);
  const [cameraData, setCameraData] = useState([]);

  useEffect(() => {
    const fetchIncidents = async () => {
      const snapshot = await getDocs(collection(db, "incidents"));
      const incidents = snapshot.docs.map((doc) => doc.data());

      processDaily(incidents);
      processSeverity(incidents);
      processCamera(incidents);
    };

    fetchIncidents();
  }, []);

  /* ---------- HELPERS ---------- */

  const getSeverity = (confidence) => {
    if (confidence >= 0.8) return "HIGH";
    if (confidence >= 0.6) return "MEDIUM";
    return "LOW";
  };

  const formatDate = (timestamp) => {
    if (timestamp?.toDate) {
      return timestamp.toDate().toLocaleDateString();
    }
    return new Date(timestamp).toLocaleDateString();
  };

  /* ---------- PROCESS DATA ---------- */

  const processDaily = (incidents) => {
    const map = {};
    incidents.forEach((i) => {
      const date = formatDate(i.createdAt || i.timestamp);
      map[date] = (map[date] || 0) + 1;
    });

    setDailyData(
      Object.keys(map).map((d) => ({
        date: d,
        count: map[d],
      }))
    );
  };

  const processSeverity = (incidents) => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    incidents.forEach((i) => {
      counts[getSeverity(i.confidence)]++;
    });

    setSeverityData(
      Object.keys(counts).map((k) => ({
        name: k,
        value: counts[k],
      }))
    );
  };

  const processCamera = (incidents) => {
    const map = {};
    incidents.forEach((i) => {
      map[i.cameraId] = (map[i.cameraId] || 0) + 1;
    });

    setCameraData(
      Object.keys(map).map((c) => ({
        camera: c,
        count: map[c],
      }))
    );
  };

  return (
    <div className="app-shell">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="app-badge">Operational insights</div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">
              Crime analytics dashboard
            </h1>
            <p className="text-sm text-slate-600">
              Track incident volume, severity distribution, and camera hotspots.
            </p>
          </div>
        </div>

        <AnalyticsCharts
          dailyData={dailyData}
          severityData={severityData}
          cameraData={cameraData}
        />
      </div>
    </div>
  );
}
