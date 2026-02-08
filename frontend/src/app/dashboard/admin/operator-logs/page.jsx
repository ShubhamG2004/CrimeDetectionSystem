"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

export default function OperatorLogs() {
  const router = useRouter();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ================= AUTH + FETCH LOGS ================= */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const token = await user.getIdToken();

        const res = await fetch(
          "http://localhost:5000/api/admin/operator-logs?limit=100",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();
        setLogs(data.logs || []);
      } catch (err) {
        console.error("Failed to fetch operator logs:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="📜 Operator Activity Logs" />

        <div className="p-6">
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Operator</th>
                  <th className="p-3 text-left">Action</th>
                  <th className="p-3 text-left">Description</th>
                  <th className="p-3 text-left">Camera</th>
                  <th className="p-3 text-left">Time</th>
                </tr>
              </thead>

              <tbody>
                {!loading &&
                  logs.map((log) => (
                    <tr key={log.id} className="border-t">
                      <td className="p-3">{log.operatorEmail}</td>
                      <td className="p-3 font-medium">{log.action}</td>
                      <td className="p-3">{log.description}</td>
                      <td className="p-3">{log.cameraId || "—"}</td>
                      <td className="p-3 text-gray-600">
                        {log.createdAt?.seconds
                          ? new Date(
                              log.createdAt.seconds * 1000
                            ).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {/* STATES */}
            {loading && (
              <p className="p-6 text-center text-gray-600">
                Loading activity logs…
              </p>
            )}

            {!loading && logs.length === 0 && (
              <p className="p-6 text-center text-gray-600">
                No activity logs found
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
