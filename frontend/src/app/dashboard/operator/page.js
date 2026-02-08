"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  orderBy,
  query,
  where
} from "firebase/firestore";
import {
  BarChart3,
  AlertTriangle,
  ShieldAlert,
  CheckCircle,
  Filter,
  Camera,
  Clock,
  MapPin,
  Users,
  TrendingUp,
  Search,
  MoreVertical,
  Download,
  Eye
} from "lucide-react";

import Navbar from "@/components/Navbar";
import OperatorSidebar from "@/components/OperatorSidebar";

export default function OperatorDashboard() {
  const router = useRouter();

  const [incidents, setIncidents] = useState([]);
  const [cameraFilter, setCameraFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [operatorCameras, setOperatorCameras] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });

  /* ---------- AUTH GUARD ---------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      if (localStorage.getItem("role") !== "operator") {
        router.replace("/dashboard/admin");
        return;
      }

      const opRef = doc(db, "operators", user.uid);
      const opSnap = await getDoc(opRef);

      if (!opSnap.exists()) {
        console.error("Operator profile missing");
        return;
      }

      setOperatorCameras(opSnap.data().cameras || []);
    });

    return () => unsub();
  }, [router]);

  /* ---------- FETCH INCIDENTS ---------- */
  /* ---------- FETCH INCIDENTS (FIXED & SECURE) ---------- */
useEffect(() => {
  if (!operatorCameras || operatorCameras.length === 0) return;

  const fetchIncidents = async () => {
    try {
      setLoading(true);

      /**
       * Firestore limitation:
       * "in" query supports max 10 values.
       * If you ever assign >10 cameras, we’ll chunk later.
       */
      const q = query(
        collection(db, "incidents"),
        orderBy("createdAt", "desc"),
        where("location.cameraId", "in", operatorCameras)
      );

      const snap = await getDocs(q);

      const list = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.createdAt?.toDate() || null,
        };
      });

      setIncidents(list);
      calculateStats(list);
    } catch (err) {
      console.error("❌ Fetch incidents error:", err);
    } finally {
      setLoading(false);
    }
  };

  fetchIncidents();
}, [operatorCameras]);



  /* ---------- STATS ---------- */
  const calculateStats = (list) => {
    const s = {
      total: list.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    list.forEach((i) => {
      const level = i.threat_level?.toUpperCase() || "MEDIUM";
      if (level === "CRITICAL") s.critical++;
      else if (level === "HIGH") s.high++;
      else if (level === "MEDIUM") s.medium++;
      else if (level === "LOW") s.low++;
    });

    setStats(s);
  };

  /* ---------- FILTERED INCIDENTS ---------- */
  const filteredIncidents = incidents.filter((i) => {
      const cameraMatch =
        cameraFilter === "all" ||
        i.location?.cameraId === cameraFilter;

      const severityMatch =
        severityFilter === "all" ||
        i.threat_level?.toLowerCase() === severityFilter;

      const searchMatch =
        searchQuery === "" ||
        i.crime_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.location?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.threat_level?.toLowerCase().includes(searchQuery.toLowerCase());

      return cameraMatch && severityMatch && searchMatch;
    });


  /* ---------- HELPERS ---------- */
  const formatDate = (date) => {
    if (!date) return "Unknown";
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getCrimeTypeDisplay = (type) =>
    type
      ? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Unknown Activity";

  const getSeverityInfo = (level) => {
    const lvl = level?.toUpperCase() || "MEDIUM";
    switch (lvl) {
      case "CRITICAL":
        return {
          color: "bg-gradient-to-r from-red-500 to-red-600",
          text: "text-red-700",
          bg: "bg-red-50",
          icon: <ShieldAlert className="w-4 h-4" />,
          label: "Critical",
          border: "border-red-200"
        };
      case "HIGH":
        return {
          color: "bg-gradient-to-r from-orange-500 to-orange-600",
          text: "text-orange-700",
          bg: "bg-orange-50",
          icon: <AlertTriangle className="w-4 h-4" />,
          label: "High",
          border: "border-orange-200"
        };
      case "MEDIUM":
        return {
          color: "bg-gradient-to-r from-yellow-500 to-yellow-600",
          text: "text-yellow-700",
          bg: "bg-yellow-50",
          icon: <AlertTriangle className="w-4 h-4" />,
          label: "Medium",
          border: "border-yellow-200"
        };
      case "LOW":
        return {
          color: "bg-gradient-to-r from-blue-500 to-blue-600",
          text: "text-blue-700",
          bg: "bg-blue-50",
          icon: <CheckCircle className="w-4 h-4" />,
          label: "Low",
          border: "border-blue-200"
        };
      default:
        return {
          color: "bg-gradient-to-r from-gray-500 to-gray-600",
          text: "text-gray-700",
          bg: "bg-gray-50",
          icon: <CheckCircle className="w-4 h-4" />,
          label: "Info",
          border: "border-gray-200"
        };
    }
  };

  const getUniqueCameras = () => {
    const cameras = incidents
      .map(i => i.location?.cameraId)
      .filter(Boolean);
    return [...new Set(cameras)];
  };

  const exportIncidents = () => {
    const data = filteredIncidents.map(inc => ({
      ID: inc.id,
      Type: inc.crime_type,
      Severity: inc.threat_level,
      Location: inc.location?.name,
      Camera: inc.location?.cameraId,
      Confidence: `${Math.round((inc.confidence || 0) * 100)}%`,
      "People Detected": inc.persons_detected || 0,
      "Threat Score": inc.threat_score || 0,
      Timestamp: inc.timestamp?.toLocaleString() || "Unknown"
    }));

    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incidents_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="flex h-screen bg-transparent overflow-hidden">
      <OperatorSidebar />

      <div className="flex-1 bg-transparent">
        <div className="sticky top-0 z-20">
          <Navbar title="👮 Operator Dashboard" />
        </div>

        <div className="h-full overflow-y-auto">
          <div className="p-6 space-y-6">
          {/* HEADER */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="app-badge">Operator workspace</div>
              <h1 className="mt-3 text-2xl font-semibold text-slate-900">Incident Management</h1>
              <p className="text-slate-600 mt-1">Monitor and respond to security incidents in real-time</p>
            </div>
            <button
              onClick={exportIncidents}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* STATS CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Incidents</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full" 
                  style={{ width: `${stats.total > 0 ? 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Critical</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">{stats.critical}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-xl">
                  <ShieldAlert className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 rounded-full" 
                  style={{ width: `${stats.total > 0 ? (stats.critical / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">High Priority</p>
                  <p className="text-3xl font-bold text-orange-600 mt-2">{stats.high}</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 rounded-full" 
                  style={{ width: `${stats.total > 0 ? (stats.high / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Medium</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.medium}</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 rounded-full" 
                  style={{ width: `${stats.total > 0 ? (stats.medium / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Low</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{stats.low}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full" 
                  style={{ width: `${stats.total > 0 ? (stats.low / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* FILTERS BAR */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* SEARCH */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search incidents by type, location, or severity..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-semibold text-gray-900 placeholder:font-semibold placeholder:text-gray-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* FILTERS */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative">
                  <Camera className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <select
                    className="pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white min-w-[180px] font-semibold text-gray-900"
                    value={cameraFilter}
                    onChange={(e) => setCameraFilter(e.target.value)}
                  >
                    <option value="all">All Cameras</option>
                    {getUniqueCameras().map((cam) => (
                      <option key={cam} value={cam}>
                        Camera {cam}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <select
                    className="pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white min-w-[180px] font-semibold text-gray-900"
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                  >
                    <option value="all">All Severity</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ACTIVE FILTERS */}
            <div className="flex flex-wrap gap-2 mt-4">
              {cameraFilter !== "all" && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-800 rounded-lg text-sm font-semibold">
                  <Camera className="w-3 h-3" />
                  Camera {cameraFilter}
                  <button 
                    onClick={() => setCameraFilter("all")}
                    className="ml-1 hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {severityFilter !== "all" && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-800 rounded-lg text-sm font-semibold">
                  <Filter className="w-3 h-3" />
                  {severityFilter.charAt(0).toUpperCase() + severityFilter.slice(1)}
                  <button 
                    onClick={() => setSeverityFilter("all")}
                    className="ml-1 hover:text-purple-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-800 rounded-lg text-sm font-semibold">
                  <Search className="w-3 h-3" />
                  "{searchQuery}"
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="ml-1 hover:text-gray-900"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>

          {/* INCIDENTS TABLE */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Recent Incidents</h2>
                <span className="text-sm text-gray-600">
                  {filteredIncidents.length} incident{filteredIncidents.length !== 1 ? 's' : ''} found
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Loading incidents...</p>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-block p-4 bg-gray-50 rounded-2xl mb-4">
                  <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">No incidents found</h3>
                <p className="text-gray-500">Try adjusting your filters or search criteria</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredIncidents.map((incident) => {
                  const severity = getSeverityInfo(incident.threat_level);
                  return (
                    <div 
                      key={incident.id} 
                      className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedIncident(incident)}
                    >
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* IMAGE */}
                        {incident.imageUrl && (
                          <div className="lg:w-64 flex-shrink-0">
                            <div className="relative aspect-video rounded-xl overflow-hidden shadow-md">
                              <img
                                src={incident.imageUrl}
                                alt="Incident"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-3 right-3">
                                <span className={`px-3 py-1.5 text-xs font-semibold text-white rounded-full ${severity.color}`}>
                                  {severity.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* DETAILS */}
                        <div className="flex-1">
                          <div className="flex flex-col md:flex-row md:items-start justify-between mb-4">
                            <div>
                              <h3 className="text-xl font-bold text-gray-900">
                                {getCrimeTypeDisplay(incident.crime_type)}
                              </h3>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                                  <Clock className="w-4 h-4" />
                                  {formatDate(incident.timestamp)}
                                </span>
                                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                                  <MapPin className="w-4 h-4" />
                                  {incident.location?.name || "Unknown Location"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-3 md:mt-0">
                              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                                <Eye className="w-5 h-5" />
                              </button>
                              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                                <MoreVertical className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          {/* METRICS */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className={`p-4 rounded-xl border ${severity.border}`}>
                              <p className="text-sm text-gray-600 mb-1">Confidence</p>
                              <p className="text-2xl font-bold text-gray-900">
                                {Math.round((incident.confidence || 0) * 100)}%
                              </p>
                            </div>
                            <div className="p-4 rounded-xl border border-gray-200">
                              <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                People Detected
                              </p>
                              <p className="text-2xl font-bold text-gray-900">
                                {incident.persons_detected || 0}
                              </p>
                            </div>
                            <div className="p-4 rounded-xl border border-gray-200">
                              <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                                <TrendingUp className="w-4 h-4" />
                                Threat Score
                              </p>
                              <p className="text-2xl font-bold text-gray-900">
                                {Number(incident.threat_score) || 0}/100
                              </p>
                            </div>
                            <div className="p-4 rounded-xl border border-gray-200">
                              <p className="text-sm text-gray-600 mb-1">Camera</p>
                              <p className="text-lg font-semibold text-gray-900">
                                {incident.location?.name || "Unknown Camera"}

                              </p>
                            </div>
                          </div>

                          {/* ACTIVITIES */}
                          {incident.activities && incident.activities.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-2">Activities Detected</p>
                              <div className="flex flex-wrap gap-2">
                                {incident.activities.slice(0, 5).map((activity, idx) => (
                                  <span
                                    key={idx}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium"
                                  >
                                    {activity.replace(/_/g, ' ')}
                                  </span>
                                ))}
                                {incident.activities.length > 5 && (
                                  <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">
                                    +{incident.activities.length - 5} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SUMMARY */}
          <div className="text-center text-sm text-gray-500 pt-2">
            Showing {filteredIncidents.length} of {incidents.length} total incidents
            {incidents.length > 0 && (
              <span className="ml-4">
                Last updated {formatDate(new Date(Math.max(...incidents.map(i => i.timestamp?.getTime() || 0))))}
              </span>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}