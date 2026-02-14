"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

import IncidentMap from "@/components/IncidentMap";
import Navbar from "@/components/Navbar";
import OperatorSidebar from "@/components/OperatorSidebar";
import { 
  AlertCircle, 
  MapPin, 
  RefreshCw, 
  Shield,
  Camera,
  AlertTriangle,
  Activity,
  Eye,
  CheckCircle,
  XCircle,
  TrendingUp,
  Clock,
  Layers
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function OperatorMapPage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cameraCount, setCameraCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Color palette
  const colors = {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
    },
    slate: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    status: {
      critical: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
      success: '#10b981'
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let unsubscribeIncidents = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setError("Authentication required. Please log in to access the incident map.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // 🔐 Ensure fresh token for Firestore rules
        await user.getIdToken(true);

        /* 1️⃣ Load operator profile */
        const operatorSnap = await getDoc(
          doc(db, "operators", user.uid)
        );

        if (!operatorSnap.exists()) {
          setError("Operator profile not found. Please contact support.");
          setLoading(false);
          return;
        }

        const cameraIds = operatorSnap.data().cameras || [];
        setCameraCount(cameraIds.length);

        if (cameraIds.length === 0) {
          setError("No cameras assigned to your account. Please contact your administrator.");
          setLoading(false);
          return;
        }

        /* 2️⃣ Real-time incidents (Firestore-safe) */
        const q = query(
          collection(db, "incidents"),
          where("location.cameraId", "in", cameraIds)
        );

        unsubscribeIncidents = onSnapshot(
          q,
          (snapshot) => {
            const list = snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));
            setIncidents(list);
            setLastUpdate(new Date());
            setLoading(false);
          },
          (err) => {
            console.error("❌ Firestore snapshot error:", err);
            setError("Connection error. Please check your internet connection.");
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("❌ Operator map error:", err);
        setError("Unable to load incident data. Please try again.");
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeIncidents) unsubscribeIncidents();
    };
  }, []);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  const getIncidentStats = () => {
    const normalize = (value) => (value || "").toLowerCase();
    const resolveLevel = (incident) =>
      normalize(incident.severity) ||
      normalize(incident.threat_level) ||
      "low";

    const critical = incidents.filter((i) => resolveLevel(i) === "critical").length;
    const high = incidents.filter((i) => resolveLevel(i) === "high").length;
    const medium = incidents.filter((i) => resolveLevel(i) === "medium").length;
    const low = incidents.filter((i) => resolveLevel(i) === "low").length;

    return {
      total: incidents.length,
      critical,
      high,
      medium,
      low,
    };
  };

  const getIncidentTimeMs = (incident) => {
    const createdAt = incident.createdAt;
    if (createdAt?.toDate) return createdAt.toDate().getTime();
    if (createdAt instanceof Date) return createdAt.getTime();
    if (typeof createdAt === "string" || typeof createdAt === "number") {
      const parsed = new Date(createdAt).getTime();
      return Number.isNaN(parsed) ? null : parsed;
    }

    const legacyTimestamp = incident.timestamp;
    if (legacyTimestamp instanceof Date) return legacyTimestamp.getTime();
    if (typeof legacyTimestamp === "string" || typeof legacyTimestamp === "number") {
      const parsed = new Date(legacyTimestamp).getTime();
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  };

  const resolveSeverityBucket = (incident) => {
    const raw = (incident.severity || incident.threat_level || "").toLowerCase();
    if (raw === "critical") return "critical";
    if (raw === "warning") return "warning";
    if (raw === "info") return "info";
    if (raw === "high" || raw === "medium") return "warning";
    if (raw === "low") return "info";
    return null;
  };

  const getLast24hTrend = (items) => {
    const now = Date.now();
    const buckets = Array.from({ length: 24 }, (_, i) => {
      const hoursAgo = 23 - i;
      const bucketTime = new Date(now - hoursAgo * 60 * 60 * 1000);
      const label = bucketTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      return {
        hour: i,
        label,
        critical: 0,
        warning: 0,
        info: 0,
      };
    });

    items.forEach((incident) => {
      const timeMs = getIncidentTimeMs(incident);
      if (!timeMs) return;

      const diffHours = Math.floor((now - timeMs) / (1000 * 60 * 60));
      if (diffHours < 0 || diffHours >= 24) return;

      const bucket = buckets[23 - diffHours];
      const severity = resolveSeverityBucket(incident);
      if (severity && bucket[severity] !== undefined) {
        bucket[severity] += 1;
      }
    });

    return buckets.map((bucket, index) => {
      const isRecent = index >= 21;
      return {
        ...bucket,
        criticalRecent: isRecent ? bucket.critical : null,
        warningRecent: isRecent ? bucket.warning : null,
        infoRecent: isRecent ? bucket.info : null,
      };
    });
  };

  useEffect(() => {
    if (incidents.length > 0) {
      console.table(
        incidents.map((i) => ({
          id: i.id,
          severity: i.severity,
          threat_level: i.threat_level,
        }))
      );
    }
  }, [incidents]);

  const stats = getIncidentStats();
  const trendData = getLast24hTrend(incidents);

  /* ================= UI ================= */

  if (error) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        <OperatorSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 z-50">
            <Navbar title="Live Incident Map" />
          </div>
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xl shadow-blue-500/5">
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-pink-500/10 blur-xl"></div>
                      <AlertCircle className="w-12 h-12 text-red-600 relative z-10" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold text-slate-900 mb-3">
                    Map Unavailable
                  </h3>
                  <p className="text-slate-600 mb-8 text-xl">
                    {error}
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={handleRetry}
                      className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold flex items-center gap-3 hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Reload Map
                    </button>
                    <button
                      onClick={() => window.history.back()}
                      className="px-8 py-3.5 border-2 border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all duration-300 active:scale-[0.98]"
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 overflow-hidden">
      {/* Fixed Sidebar */}
      <div className="flex-shrink-0">
        <OperatorSidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Fixed Navbar */}
        <div className="flex-shrink-0 z-50">
          <Navbar 
            title={
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white shadow"></div>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Live Incident Map</h1>
                  <div className="flex items-center gap-2 text-base">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-slate-600">Real-time monitoring</span>
                    </div>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">{cameraCount} cameras assigned</span>
                  </div>
                </div>
              </div>
            }
          />
        </div>
        
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {/* Header Stats */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Live Operations Dashboard</h2>
                  <p className="text-slate-600 mt-1 text-lg">
                    Real-time threat monitoring across {cameraCount} surveillance points
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {mounted && lastUpdate && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span className="text-base font-medium text-slate-700">
                        Updated: {lastUpdate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                  )}
                  <button 
                    onClick={handleRetry}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium flex items-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-all duration-300 shadow-sm active:scale-[0.98]"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {/* Active Incidents Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg shadow-blue-500/5 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 group hover:-translate-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-base font-medium text-slate-500 mb-1.5">Active Incidents</p>
                      <div className="flex items-baseline gap-3">
                        <p className="text-5xl font-bold text-slate-900">{incidents.length}</p>
                        {incidents.length > 0 && (
                          <div className="flex items-center gap-1 px-2.5 py-1 bg-red-50 rounded-full">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-semibold text-red-700">LIVE</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-14 h-14 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <AlertTriangle className="w-7 h-7 text-red-600" />
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="flex justify-between text-base">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-slate-700 font-medium">Critical</span>
                        <span className="text-slate-900 font-bold">{stats.critical}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                        <span className="text-slate-700 font-medium">High</span>
                        <span className="text-slate-900 font-bold">{stats.high}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cameras Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg shadow-blue-500/5 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 group hover:-translate-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-base font-medium text-slate-500 mb-1.5">Cameras Assigned</p>
                      <p className="text-5xl font-bold text-slate-900">{cameraCount}</p>
                    </div>
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Camera className="w-7 h-7 text-blue-600" />
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-base">
                      <div className={`w-2 h-2 rounded-full ${cameraCount > 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                      <span className="text-slate-700">
                        {cameraCount > 0 ? 'All systems operational' : 'No cameras assigned'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* System Status Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg shadow-blue-500/5 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 group hover:-translate-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-base font-medium text-slate-500 mb-1.5">System Status</p>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                          <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75"></div>
                        </div>
                        <p className="text-3xl font-bold text-green-700">ACTIVE</p>
                      </div>
                    </div>
                    <div className="w-14 h-14 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Shield className="w-7 h-7 text-green-600" />
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-base">
                      <Activity className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-700">Uptime: 99.9%</span>
                    </div>
                  </div>
                </div>

                {/* Response Time Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg shadow-blue-500/5 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 group hover:-translate-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-base font-medium text-slate-500 mb-1.5">Avg Response</p>
                      <p className="text-5xl font-bold text-slate-900">2.4s</p>
                    </div>
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <TrendingUp className="w-7 h-7 text-purple-600" />
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-base">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-slate-700">Within optimal range</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Severity Trend */}
            <div className="mb-8 bg-white rounded-2xl border border-slate-200 shadow-lg shadow-blue-500/5">
              <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Severity Trend (Last 24 Hours)</h3>
                    <p className="text-base text-slate-600">Older data is faded, last 3 hours are highlighted.</p>
                  </div>
                  <div className="flex items-center gap-4 text-base">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                      <span className="text-slate-700 font-medium">Critical</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span className="text-slate-700 font-medium">Warning</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      <span className="text-slate-700 font-medium">Info</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 14, fill: "#64748b" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 14, fill: "#64748b" }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="critical"
                        stroke="#ef4444"
                        strokeWidth={2}
                        strokeOpacity={0.35}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="warning"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeOpacity={0.35}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="info"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeOpacity={0.35}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="criticalRecent"
                        stroke="#ef4444"
                        strokeWidth={3.5}
                        dot={{ r: 3 }}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="warningRecent"
                        stroke="#f59e0b"
                        strokeWidth={3.5}
                        dot={{ r: 3 }}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="infoRecent"
                        stroke="#3b82f6"
                        strokeWidth={3.5}
                        dot={{ r: 3 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Map Container */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl shadow-blue-500/10 overflow-hidden">
              {/* Map Header */}
              <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <Layers className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Incident Map Overview</h2>
                      <p className="text-slate-600 text-lg">Interactive geospatial visualization of all active threats</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {loading && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
                        <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                        <span className="text-base font-medium text-blue-700">Syncing data...</span>
                      </div>
                    )}
                    <div className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl text-white font-bold flex items-center gap-2 shadow-lg shadow-red-500/25">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      LIVE FEED
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Map Content */}
              <div className="p-2 md:p-4">
                {loading ? (
                  <div className="h-[600px] flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl m-4">
                    <div className="relative mb-8">
                      <div className="w-32 h-32 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <MapPin className="w-12 h-12 text-blue-600" />
                      </div>
                    </div>
                    <h3 className="text-3xl font-bold text-slate-900 mb-3">Loading Live Map</h3>
                    <p className="text-slate-600 max-w-md text-center text-lg">
                      Initializing real-time surveillance data from {cameraCount} camera{cameraCount !== 1 ? 's' : ''}...
                    </p>
                    <div className="mt-8 flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse delay-75"></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse delay-150"></div>
                    </div>
                  </div>
                ) : incidents.length === 0 ? (
                  <div className="h-[600px] flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 rounded-2xl m-4">
                    <div className="relative mb-8">
                      <div className="w-32 h-32 bg-gradient-to-br from-emerald-100 to-green-100 rounded-full flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-green-500/10 blur-2xl"></div>
                        <Shield className="w-16 h-16 text-emerald-600 relative z-10" />
                      </div>
                    </div>
                    <h3 className="text-3xl font-bold text-slate-900 mb-3">All Systems Clear</h3>
                    <p className="text-slate-600 max-w-md text-center mb-8 text-lg">
                      No active threats detected across {cameraCount} surveillance camera{cameraCount !== 1 ? 's' : ''}. 
                      The monitored area is secure and all systems are functioning normally.
                    </p>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                        <span className="text-base font-medium text-emerald-700">Secure Perimeter</span>
                      </div>
                      <div className="w-px h-6 bg-slate-200"></div>
                      <div className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-blue-600" />
                        <span className="text-base font-medium text-blue-700">Active Monitoring</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg m-4">
                    <IncidentMap incidents={incidents} />
                  </div>
                )}
              </div>
              
              {/* Map Footer */}
              {incidents.length > 0 && !loading && (
                <div className="px-8 py-5 bg-gradient-to-r from-slate-50 to-white border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                          <span className="text-base font-semibold text-slate-900">
                            Critical ({stats.critical})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                          <span className="text-base font-semibold text-slate-900">
                            High ({stats.high})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-amber-500 rounded-full"></div>
                          <span className="text-base font-semibold text-slate-900">
                            Medium ({stats.medium})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                          <span className="text-base font-semibold text-slate-900">
                            Low ({stats.low})
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-base font-medium text-slate-700">
                          {incidents.length} active incident{incidents.length !== 1 ? 's' : ''}
                        </p>
                        <p className="text-sm text-slate-500">
                          Last updated: {lastUpdate?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Bottom Status Bar */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-base text-slate-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Connection stable</span>
                </div>
                <span className="text-slate-400">•</span>
                <div className="flex items-center gap-2 text-base text-slate-600">
                  <Eye className="w-4 h-4" />
                  <span>Live feed active</span>
                </div>
              </div>
              <div className="text-base text-slate-500">
                <span className="font-medium">Operator ID:</span> {auth.currentUser?.uid?.slice(-8)} • 
                <span className="ml-2">Auto-refresh every 30s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}