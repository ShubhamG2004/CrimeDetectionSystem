"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

const API = "http://localhost:5000/api/admin";

export default function FieldOperatorsPage() {
  const router = useRouter();
  const checkedRef = useRef(false);

  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const fetchFieldOperators = async () => {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`${API}/field-operators`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to fetch field operators");
    }

    setOperators(Array.isArray(data.operators) ? data.operators : []);
  };

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      if (localStorage.getItem("role") !== ROLES.ADMIN) {
        router.replace("/dashboard");
        return;
      }

      try {
        await fetchFieldOperators();
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const createFieldOperator = async (e) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.password) {
      alert("Name, email and password are required");
      return;
    }

    setSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`${API}/create-field-operator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to create field operator");
        return;
      }

      setForm({ name: "", email: "", password: "" });
      await fetchFieldOperators();
      alert("Field operator created successfully");
    } catch (error) {
      console.error(error);
      alert("Failed to create field operator");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell flex">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="Field Operator Management" />

        <div className="p-6 space-y-5">
          <form onSubmit={createFieldOperator} className="app-card p-5">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Create Field Operator</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className="app-input"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <input
                type="email"
                className="app-input"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <input
                type="password"
                minLength={6}
                className="app-input"
                placeholder="Password (min 6 chars)"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="app-button mt-4 disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create Field Operator"}
            </button>
          </form>

          <div className="app-card overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 text-slate-700 text-sm">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-center">Role</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>

              <tbody className="text-slate-800 text-sm">
                {!loading && operators.map((op) => (
                  <tr key={op.uid} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="p-3 font-medium">{op.name || "-"}</td>
                    <td className="p-3">{op.email}</td>
                    <td className="p-3 text-center">{op.role || "field_operator"}</td>
                    <td className="p-3 text-center">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                        {(op.status || "active").toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {loading && <p className="p-6 text-center text-slate-600 font-medium">Loading field operators...</p>}
            {!loading && operators.length === 0 && (
              <p className="p-6 text-center text-slate-600 font-medium">No field operators found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
