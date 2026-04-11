"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function AdminMessagesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [resolvingId, setResolvingId] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState({});

  const fetchMessages = async (status = statusFilter) => {
    const token = await auth.currentUser.getIdToken(true);
    const query = status && status !== "all" ? `?status=${status}` : "";
    const res = await fetch(`${API_BASE}/api/messages/admin${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to load messages");
    }

    setItems(Array.isArray(data?.data) ? data.data : []);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.replace("/login");
      if (localStorage.getItem("role") !== ROLES.ADMIN) {
        return router.replace("/dashboard");
      }

      try {
        await fetchMessages("all");
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const resolveMessage = async (id) => {
    try {
      setResolvingId(id);
      const token = await auth.currentUser.getIdToken(true);
      const res = await fetch(`${API_BASE}/api/messages/${id}/resolve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resolutionNote: resolutionNotes[id] || "Resolved by admin",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data?.message || "Failed to resolve message");
        return;
      }

      await fetchMessages(statusFilter);
    } catch (error) {
      console.error(error);
      alert("Could not resolve this issue");
    } finally {
      setResolvingId("");
    }
  };

  return (
    <div className="app-shell">
      <AdminSidebar />

      <div>
        <Navbar title="Operator & Field Messages" />

        <div className="p-6 space-y-4">
          <div className="app-card p-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Admin Issue Inbox</h2>
            <select
              className="app-input max-w-48"
              value={statusFilter}
              onChange={async (e) => {
                const next = e.target.value;
                setStatusFilter(next);
                setLoading(true);
                try {
                  await fetchMessages(next);
                } finally {
                  setLoading(false);
                }
              }}
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="app-card p-4">
            {loading ? (
              <p className="text-sm text-slate-500">Loading messages...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500">No messages found.</p>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{item.subject}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        item.status === "resolved"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-orange-100 text-orange-700"
                      }`}>
                        {(item.status || "open").toUpperCase()}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 mt-1">{item.message}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      From: {item.fromEmail || item.fromUid} ({item.fromRole})
                    </p>

                    {item.status === "resolved" ? (
                      <p className="text-sm text-emerald-700 mt-2">
                        Resolution: {item.resolutionNote || "Resolved"}
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-col md:flex-row gap-2">
                        <input
                          className="app-input"
                          placeholder="Resolution note (optional)"
                          value={resolutionNotes[item.id] || ""}
                          onChange={(e) =>
                            setResolutionNotes((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          className="app-button"
                          onClick={() => resolveMessage(item.id)}
                          disabled={resolvingId === item.id}
                        >
                          {resolvingId === item.id ? "Resolving..." : "Mark Resolved"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
