"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

// ✅ Client-only charts
const AnalyticsCharts = dynamic(
  () => import("@/components/AnalyticsCharts"),
  { ssr: false }
);

export default function Analytics() {
  const router = useRouter();
  const checkedRef = useRef(false);
  const [dailyData, setDailyData] = useState([]);
  const [severityData, setSeverityData] = useState([]);
  const [cameraData, setCameraData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // ✅ ensure auth check runs only once
    if (checkedRef.current) return;
    checkedRef.current = true;

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const role = localStorage.getItem("role");
      if (role !== ROLES.ADMIN) {
        router.replace("/dashboard");
      }
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get Firebase auth token
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error("User not authenticated");
        }

        console.log("📊 Fetching analytics data for user:", currentUser.uid);

        const token = await currentUser.getIdToken();
        if (!token) {
          throw new Error("Failed to get auth token");
        }

        console.log("🔑 Auth token retrieved, making API call...");

        // Call backend analytics endpoint
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const endpoint = `${apiUrl}/api/analytics/dashboard-data`;

        console.log("📡 Calling endpoint:", endpoint);

        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        console.log("📨 Response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("❌ API Error:", errorData);
          throw new Error(
            errorData.message || `API error: ${response.status} ${response.statusText}`
          );
        }

        const result = await response.json();
        console.log("✅ Analytics data received:", result);

        if (!result.success) {
          throw new Error(result.message || "API returned success: false");
        }

        const { data } = result;
        setDailyData(data.dailyData || []);
        setSeverityData(data.severityData || []);
        setCameraData(data.cameraData || []);
      } catch (err) {
        console.error("❌ Error fetching analytics:", err);
        setError(
          err.message || "Failed to load analytics. Please try again later."
        );
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if user is authenticated
    if (auth.currentUser) {
      fetchAnalyticsData();
    }
  }, []);

  return (
    <div className="app-shell flex">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="📊 Crime Analytics Dashboard" />

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

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="spinner mb-4"></div>
                <p className="text-slate-600">Loading analytics data...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <AnalyticsCharts
              dailyData={dailyData}
              severityData={severityData}
              cameraData={cameraData}
            />
          )}
        </div>
      </div>
    </div>
  );
}
