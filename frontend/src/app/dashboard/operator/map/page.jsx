"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import IncidentMap from "@/components/IncidentMap";
import Navbar from "@/components/Navbar";
import OperatorSidebar from "@/components/OperatorSidebar";

export default function OperatorMapPage() {
  const [incidents, setIncidents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    
    // Real-time listener for incidents
    const unsubscribe = onSnapshot(
      collection(db, "incidents"),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setIncidents(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching incidents:", err);
        setError("Failed to load incidents");
        setLoading(false);
      }
    );

    // Fallback: fetch once if real-time fails
    const fetchIncidents = async () => {
      try {
        const snap = await getDocs(collection(db, "incidents"));
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setIncidents(list);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching incidents:", err);
        setError("Failed to load incidents");
        setLoading(false);
      }
    };

    fetchIncidents();

    return () => unsubscribe();
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen bg-gray-100">
        <OperatorSidebar />
        <div className="flex-1">
          <Navbar title="🗺️ Incident Map" />
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <OperatorSidebar />
      <div className="flex-1">
        <Navbar title="🗺️ Incident Map" />
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Incident Map Dashboard</h1>
            <p className="text-gray-600">
              Monitor and manage security incidents in real-time. Click on markers for details.
            </p>
          </div>
          
          {loading ? (
            <div className="h-[520px] w-full rounded-xl bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-700">Loading incident map...</p>
              </div>
            </div>
          ) : (
            <IncidentMap incidents={incidents} />
          )}
          
          {/* Legend */}
          <div className="mt-8 bg-white p-4 rounded-lg shadow">
            <h3 className="font-medium text-gray-700 mb-3">Map Legend</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-600 rounded-full"></div>
                <span className="text-sm">Low Threat</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-yellow-600 rounded-full"></div>
                <span className="text-sm">Medium Threat</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-orange-600 rounded-full"></div>
                <span className="text-sm">High Threat</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 bg-red-600 rounded-full"></div>
                <span className="text-sm">Critical Threat</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}