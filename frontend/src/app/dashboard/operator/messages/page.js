"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import OperatorSidebar from "@/components/OperatorSidebar";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function OperatorMessagesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("medium");

  const fetchMine = async () => {
    const token = await auth.currentUser.getIdToken(true);
    const res = await fetch(`${API_BASE}/api/messages/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load messages");
    setItems(Array.isArray(data?.data) ? data.data : []);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.replace("/login");
      if (localStorage.getItem("role") !== ROLES.OPERATOR) {
        return router.replace("/dashboard");
      }

      try {
        await fetchMine();
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) {
      alert("Subject and message are required");
      return;
    }

    try {
      setSaving(true);
      const token = await auth.currentUser.getIdToken(true);
      const res = await fetch(`${API_BASE}/api/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject,
          message,
          priority,
          sourcePage: "/dashboard/operator/messages",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.message || "Failed to send message");
        return;
      }

      setSubject("");
      setMessage("");
      setPriority("medium");
      await fetchMine();
      alert("Message sent to admin");
    } catch (error) {
      console.error(error);
      alert("Could not send message right now");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <OperatorSidebar />

      <div>
        <Navbar title="Messages to Admin" />

        <div className="p-6 space-y-5">
          <form onSubmit={sendMessage} className="app-card p-5 space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Report an Issue</h2>
            <input
              className="app-input"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <select
              className="app-input"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
            <textarea
              className="app-input min-h-28"
              placeholder="Describe the issue so admin can resolve it quickly"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button className="app-button" disabled={saving} type="submit">
              {saving ? "Sending..." : "Send to Admin"}
            </button>
          </form>

          <div className="app-card p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-3">Your Messages</h3>
            {loading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500">No messages yet.</p>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{item.subject}</p>
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                        {(item.status || "open").toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{item.message}</p>
                    {item.resolutionNote && (
                      <p className="text-sm text-emerald-700 mt-2">Resolution: {item.resolutionNote}</p>
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
