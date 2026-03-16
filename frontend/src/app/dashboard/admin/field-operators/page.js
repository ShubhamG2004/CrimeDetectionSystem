"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
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

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUid, setEditingUid] = useState(null);
  const [editName, setEditName] = useState("");
  const [resetUid, setResetUid] = useState(null);
  const [newPassword, setNewPassword] = useState("");

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

  const openEditModal = (op) => {
    setEditingUid(op.uid);
    setEditName(op.name || "");
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingUid(null);
    setEditName("");
  };

  const saveEdit = async () => {
    if (!editingUid || !editName.trim()) {
      alert("Name is required");
      return;
    }

    try {
      await updateDoc(doc(db, "field_operator", editingUid), {
        name: editName.trim(),
        updatedAt: new Date(),
      });

      closeEditModal();
      await fetchFieldOperators();
    } catch (error) {
      console.error(error);
      alert("Failed to update field operator");
    }
  };

  const toggleStatus = async (uid, currentStatus) => {
    try {
      await updateDoc(doc(db, "field_operator", uid), {
        status: currentStatus === "active" ? "inactive" : "active",
        updatedAt: new Date(),
      });

      await fetchFieldOperators();
    } catch (error) {
      console.error(error);
      alert("Failed to update status");
    }
  };

  const resetPassword = async () => {
    if (!resetUid || !newPassword || newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`${API}/reset-operator-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: resetUid,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to reset password");
        return;
      }

      alert("Password reset successfully");
      setResetUid(null);
      setNewPassword("");
    } catch (error) {
      console.error(error);
      alert("Failed to reset password");
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
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="text-slate-800 text-sm">
                {!loading && operators.map((op) => (
                  <tr key={op.uid} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="p-3 font-medium">{op.name || "-"}</td>
                    <td className="p-3">{op.email}</td>
                    <td className="p-3 text-center">{op.role || "field_operator"}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          (op.status || "active") === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {(op.status || "active").toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-center space-x-2">
                      <button
                        onClick={() => openEditModal(op)}
                        className="px-3 py-1 bg-slate-900 text-white text-xs rounded"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => {
                          setResetUid(op.uid);
                          setNewPassword("");
                        }}
                        className="px-3 py-1 bg-amber-600 text-white text-xs rounded"
                      >
                        Change Password
                      </button>

                      <button
                        onClick={() => toggleStatus(op.uid, op.status || "active")}
                        className={`px-3 py-1 text-white text-xs rounded ${
                          (op.status || "active") === "active"
                            ? "bg-rose-600"
                            : "bg-emerald-600"
                        }`}
                      >
                        {(op.status || "active") === "active" ? "Disable" : "Enable"}
                      </button>
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

        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="app-card w-105 p-6">
              <h3 className="font-semibold text-lg mb-4 text-slate-800">Edit Field Operator</h3>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">Full Name</label>
                <input
                  className="app-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter full name"
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={closeEditModal}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {resetUid && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="app-card w-95 p-6">
              <h3 className="font-semibold text-lg mb-4 text-slate-800">Change Password</h3>

              <input
                type="password"
                className="app-input mb-4"
                placeholder="New Password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setResetUid(null);
                    setNewPassword("");
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={resetPassword}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg"
                >
                  Update Password
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
