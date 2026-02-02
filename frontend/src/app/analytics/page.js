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
      const date = formatDate(i.timestamp);
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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        📊 Crime Analytics Dashboard
      </h1>

      <AnalyticsCharts
        dailyData={dailyData}
        severityData={severityData}
        cameraData={cameraData}
      />
    </div>
  );
}
