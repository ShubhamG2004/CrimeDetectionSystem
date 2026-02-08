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
      <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <OperatorSidebar />
        <div className="flex-1 flex flex-col">
          <Navbar title="Incident Map" />
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Unable to Load Map
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {error}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleRetry}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Try Again
                    </button>
                    <button
                      onClick={() => window.history.back()}
                      className="px-6 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors duration-200"
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
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <OperatorSidebar />
      <div className="flex-1 flex flex-col">
        <Navbar 
          title={
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Incident Map</h1>
                <p className="text-sm text-gray-500">Real-time monitoring dashboard</p>
              </div>
            </div>
          }
        />
        
        <div className="flex-1 p-6">
          {/* Stats Overview */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Active Incidents</p>
                  <p className="text-3xl font-bold text-gray-900">{incidents.length}</p>
                </div>
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Cameras Assigned</p>
                  <p className="text-3xl font-bold text-gray-900">{cameraCount}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                  <Camera className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <p className="text-lg font-semibold text-gray-900">Live</p>
                  </div>
                </div>
                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Map Container */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Incident Locations</h2>
                  <p className="text-sm text-gray-500">
                    Real-time visualization of incidents across monitored areas
                  </p>
                </div>
                {loading && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Updating...
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-2 md:p-4">
              {loading ? (
                <div className="h-[600px] flex flex-col items-center justify-center bg-gray-50 rounded-xl">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <MapPin className="w-6 h-6 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="mt-4 text-gray-600 font-medium">Loading incident map...</p>
                  <p className="text-sm text-gray-500 mt-1">Fetching real-time data from your cameras</p>
                </div>
              ) : incidents.length === 0 ? (
                <div className="h-[600px] flex flex-col items-center justify-center bg-gray-50 rounded-xl">
                  <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4">
                    <Shield className="w-10 h-10 text-green-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">All Clear</h3>
                  <p className="text-gray-600 max-w-md text-center mb-6">
                    No active incidents detected across your {cameraCount} assigned cameras.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Monitoring is active
                  </div>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  <IncidentMap incidents={incidents} />
                </div>
              )}
            </div>
            
            {incidents.length > 0 && !loading && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>Critical Incident</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span>Warning</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span>Information</span>
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
              Data updates in real-time • Last updated: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}