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
  AlertTriangle
} from "lucide-react";

export default function OperatorMapPage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cameraCount, setCameraCount] = useState(0);
  const [mounted, setMounted] = useState(false);

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

  /* ================= UI ================= */

  if (error) {
    return (
      <div className="flex h-screen bg-transparent overflow-hidden">
        <OperatorSidebar />
        <div className="flex-1 bg-transparent">
          <div className="sticky top-0 z-20">
            <Navbar title="Live Incident Map" />
          </div>
          <div className="h-full overflow-y-auto">
            <div className="flex items-center justify-center p-6">
            <div className="max-w-md w-full">
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 border border-gray-200 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-slate-700" />
                  </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Map Unavailable
                    </h3>
                    <p className="text-gray-600 mb-6">
                      {error}
                    </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleRetry}
                      className="app-button px-6 py-3"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reload Map
                    </button>
                    <button
                      onClick={() => window.history.back()}
                      className="app-button-secondary px-6 py-3"
                    >
                      Back
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
    <div className="flex h-screen bg-transparent overflow-hidden">
      <OperatorSidebar />
      <div className="flex-1 bg-transparent">
        <div className="sticky top-0 z-20">
          <Navbar 
            title={
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h1 className="text-[20px] font-semibold text-slate-950 tracking-[-0.3px]">Live Incident Map</h1>
                  <p className="text-[13px] text-slate-500">Track assigned zones in real time</p>
                </div>
              </div>
            }
          />
        </div>
        
        <div className="h-full overflow-y-auto">
          <div className="p-6">
          {/* Stats Overview */}
          <div className="mb-6">
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Live Overview</h2>
              <p className="text-sm text-gray-500">
                Snapshot of active signals from your assigned cameras
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-[18px] border border-gray-200 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Active Incidents</p>
                  <p className="text-[36px] font-bold text-slate-950 tracking-[-1px]">{incidents.length}</p>
                </div>
                <div className="w-12 h-12 border border-gray-200 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-slate-400" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-[18px] border border-gray-200 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Cameras Assigned</p>
                  <p className="text-[36px] font-bold text-slate-950 tracking-[-1px]">{cameraCount}</p>
                </div>
                <div className="w-12 h-12 border border-gray-200 rounded-full flex items-center justify-center">
                  <Camera className="w-6 h-6 text-slate-400" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-[18px] border border-gray-200 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">System Status</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                    <p className="text-lg font-semibold text-gray-900">Monitoring</p>
                  </div>
                </div>
                <div className="w-12 h-12 border border-gray-200 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-slate-400" />
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* Map Container */}
          <div className="relative bg-white rounded-[24px] border border-gray-200 shadow-[0_30px_80px_rgba(0,0,0,0.18)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-white to-slate-50 border-b border-gray-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Incident Locations</h2>
                <p className="text-xs text-slate-500">Live geospatial threat view</p>
              </div>
              <div className="flex items-center gap-3">
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Syncing...
                  </div>
                )}
                <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-black text-white shadow-md">
                  LIVE
                </div>
              </div>
            </div>
            
            <div className="p-2 md:p-4">
              {loading ? (
                <div className="h-[600px] flex flex-col items-center justify-center bg-white rounded-xl">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-gray-200 border-t-slate-700 rounded-full animate-spin"></div>
                    <MapPin className="w-6 h-6 text-slate-700 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="mt-4 text-gray-700 font-medium">Loading incident map...</p>
                  <p className="text-sm text-gray-500 mt-1">Pulling live signals from assigned cameras</p>
                </div>
              ) : incidents.length === 0 ? (
                <div className="h-[600px] flex flex-col items-center justify-center bg-white rounded-xl">
                  <div className="w-20 h-20 border border-gray-200 rounded-full flex items-center justify-center mb-4">
                    <Shield className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">All Clear</h3>
                  <p className="text-gray-600 max-w-md text-center mb-6">
                    No active incidents detected across your {cameraCount} assigned cameras.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                    Monitoring is active
                  </div>
                </div>
              ) : (
                <div className="rounded-[16px] overflow-hidden border border-gray-200">
                  <IncidentMap incidents={incidents} />
                </div>
              )}
            </div>
            
            {incidents.length > 0 && !loading && (
              <div className="p-4 border-t border-gray-200 bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>Critical</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-slate-400 rounded-full"></div>
                      <span>Warning</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-slate-300 rounded-full"></div>
                      <span>Info</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    {incidents.length} incident{incidents.length !== 1 ? 's' : ''} displayed
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Footer Note */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Live updates enabled • Last refreshed: {mounted ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}