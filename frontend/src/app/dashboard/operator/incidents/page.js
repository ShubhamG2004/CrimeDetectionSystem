"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import Navbar from "@/components/Navbar";
import OperatorSidebar from "@/components/OperatorSidebar";

export default function OperatorIncidentsPage() {
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "incidents"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setIncidents(list);
    });

    return () => unsubscribe();
  }, []);

  const handleAck = async (id) => {
    await updateDoc(doc(db, "incidents", id), {
      status: "acknowledged",
      acknowledgedAt: new Date()
    });
  };

  const handleResolve = async (id) => {
    await updateDoc(doc(db, "incidents", id), {
      status: "resolved",
      resolvedAt: new Date()
    });
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <OperatorSidebar />

      <div className="flex-1 flex flex-col">
        <Navbar title="Incident Management" />

        <div className="p-6 overflow-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Active Incidents
          </h2>

          <div className="space-y-4">
            {incidents.map((incident) => (
              <div
                key={incident.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Incident #{incident.id.slice(-6)}
                    </h3>
                    <p className="text-sm text-slate-600">
                      Severity:{" "}
                      <span className="font-medium capitalize">
                        {incident.severity}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Status:{" "}
                      <span className="font-medium capitalize">
                        {incident.status || "active"}
                      </span>
                    </p>
                  </div>

                  <div className="flex gap-3">
                    {incident.status !== "acknowledged" &&
                      incident.status !== "resolved" && (
                        <button
                          onClick={() => handleAck(incident.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                        >
                          ACK
                        </button>
                      )}

                    {incident.status !== "resolved" && (
                      <button
                        onClick={() => handleResolve(incident.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
                      >
                        RESOLVE
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {incidents.length === 0 && (
              <div className="text-center text-slate-500 py-10">
                No incidents found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}