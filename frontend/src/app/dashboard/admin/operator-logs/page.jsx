"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ADMIN_API_BASE_URL } from "@/lib/config";
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
          `${ADMIN_API_BASE_URL}/operator-logs?limit=100`,
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
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="Operator Activity Logs" />

        <div className="p-6">
          <div className="bg-white rounded-lg shadow-[0_10px_24px_rgba(15,23,42,0.08)] overflow-x-auto border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-orange-50">
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
                    <tr key={log.id} className="border-t border-slate-200 hover:bg-orange-50/50">
                      <td className="p-3">{log.operatorEmail}</td>
                      <td className="p-3 font-medium text-slate-900">{log.action}</td>
                      <td className="p-3">{log.description}</td>
                      <td className="p-3">{log.cameraId || "-"}</td>
                      <td className="p-3 text-slate-600">
                        {log.createdAt?.seconds
                          ? new Date(
                              log.createdAt.seconds * 1000
                            ).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {/* STATES */}
            {loading && (
              <p className="p-6 text-center text-slate-600">
                Loading activity logs...
              </p>
            )}

            {!loading && logs.length === 0 && (
              <p className="p-6 text-center text-slate-600">
                No activity logs found
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
