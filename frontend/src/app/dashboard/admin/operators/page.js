"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { Shield, UserPlus, KeyRound, Camera } from "lucide-react";

import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

export default function ManageOperators() {
  const router = useRouter();
  const checkedRef = useRef(false);
  const dropdownRef = useRef(null);

  const [operators, setOperators] = useState([]);
  const [cameras, setCameras] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [editingUid, setEditingUid] = useState(null);
  const [resetUid, setResetUid] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const emptyForm = {
    email: "",
    password: "",
    cameras: [],
  };

  const [form, setForm] = useState(emptyForm);

  /* ================= MOUNTED STATE ================= */
  useEffect(() => {
    setMounted(true);
  }, []);

  /* ================= AUTH GUARD ================= */
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const tokenResult = await user.getIdTokenResult(true);
      const role = tokenResult.claims.role;

      if (role !== ROLES.ADMIN) {
        router.replace("/dashboard");
        return;
      }

      fetchOperators();
      fetchCameras();
    });

    return () => unsub();
  }, [router]);

  /* ================= CLOSE DROPDOWN ON CLICK OUTSIDE ================= */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /* ================= FETCH OPERATORS ================= */
  const fetchOperators = async () => {
    const snap = await getDocs(collection(db, "operators"));
    setOperators(
      snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
    );
  };

  /* ================= FETCH CAMERAS ================= */
  const fetchCameras = async () => {
    const snap = await getDocs(collection(db, "cameras"));
    setCameras(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  };

  /* ================= ADD OPERATOR ================= */
  const addOperator = async () => {
    if (!form.email || !form.password || form.cameras.length === 0) {
      alert("All fields are required");
      return;
    }

    const token = await auth.currentUser.getIdToken();

    const res = await fetch(
      "http://localhost:5000/api/admin/create-operator",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      }
    );

    const data = await res.json();
    if (!res.ok) return alert(data.message);

    closeModal();
    fetchOperators();
  };

  /* ================= EDIT OPERATOR ================= */
  const editOperator = (op) => {
    setEditingUid(op.uid);
    setForm({
      email: op.email,
      password: "",
      cameras: op.cameras || [],
    });
    setShowModal(true);
  };

  const updateOperator = async () => {
    if (form.cameras.length === 0) {
      alert("Select at least one camera");
      return;
    }

    await updateDoc(doc(db, "operators", editingUid), {
      cameras: form.cameras,
      updatedAt: new Date(),
    });

    closeModal();
    fetchOperators();
  };

  /* ================= TOGGLE STATUS ================= */
  const toggleStatus = async (uid, status) => {
    await updateDoc(doc(db, "operators", uid), {
      status: status === "active" ? "inactive" : "active",
    });
    fetchOperators();
  };

  /* ================= RESET PASSWORD ================= */
  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    const token = await auth.currentUser.getIdToken();

    const res = await fetch(
      "http://localhost:5000/api/admin/reset-operator-password",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: resetUid,
          newPassword,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.message);
      return;
    }

    alert("Password reset successfully");

    setResetUid(null);
    setNewPassword("");
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUid(null);
    setForm(emptyForm);
    setSearch("");
    setDropdownOpen(false);
  };

  /* ================= CAMERA NAME MAP ================= */
  const cameraMap = cameras.reduce((acc, cam) => {
    acc[cam.id] = cam.name;
    return acc;
  }, {});

  const filteredCameras = cameras.filter(
    (cam) =>
      cam.name.toLowerCase().includes(search.toLowerCase()) ||
      cam.area.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-shell flex">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="👮 Operator Management" />

        <div className="p-6">
          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                <Shield className="h-3.5 w-3.5" />
                Team management
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 mt-2">
                Operators
              </h2>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-black"
            >
              <UserPlus className="h-4 w-4" />
              Add Operator
            </button>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto app-card">
            <table className="w-full">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="p-4 text-left font-semibold text-gray-700">Email</th>
                  <th className="p-4 text-left font-semibold text-gray-700">Cameras</th>
                  <th className="p-4 text-center font-semibold text-gray-700">Status</th>
                  <th className="p-4 text-center font-semibold text-gray-700">Created</th>
                  <th className="p-4 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>

              <tbody className="text-slate-800">
                {operators.map((op) => (
                  <tr key={op.uid} className="border-t border-slate-100 hover:bg-slate-50/70 transition duration-150">
                    <td className="p-4">{op.email}</td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {op.cameras?.map((id) => (
                          <span
                            key={id}
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium"
                          >
                            {cameraMap[id] || id}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      <span
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                          op.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {op.status}
                      </span>
                    </td>

                    <td className="p-4 text-center text-gray-600">
                      {mounted && op.createdAt
                        ? new Date(
                            op.createdAt.seconds * 1000
                          ).toLocaleDateString([], {
                            year: "numeric",
                            month: "short",
                            day: "numeric"
                          })
                        : "—"}
                    </td>

                    <td className="p-3 text-center space-x-2">
                      <button
                        onClick={() => editOperator(op)}
                        className="px-3 py-1.5 bg-slate-900 text-white text-xs rounded-md font-medium hover:bg-black transition"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => {
                          setResetUid(op.uid);
                          setNewPassword("");
                        }}
                        className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded-md font-medium hover:bg-amber-700 transition"
                      >
                        Reset Password
                      </button>

                      <button
                        onClick={() => toggleStatus(op.uid, op.status)}
                        className={`px-3 py-1.5 text-white text-xs rounded-md font-medium transition ${
                          op.status === "active"
                            ? "bg-rose-600 hover:bg-rose-700"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        {op.status === "active" ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {operators.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-gray-600 font-medium">
                  No operators found
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ADD/EDIT MODAL */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.24)] overflow-hidden">
              <div className="border-b border-slate-200 bg-linear-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-2.5 py-1 text-[11px] uppercase tracking-wide text-slate-200">
                      <UserPlus className="h-3 w-3" />
                      Operator access
                    </p>
                    <h3 className="mt-3 text-xl font-semibold">
                      {editingUid ? "Edit Operator" : "Create Operator"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-300">
                      Configure identity and camera permissions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Operator Email
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-800 focus:ring-2 focus:ring-slate-800/15 disabled:bg-slate-100 disabled:text-slate-500"
                    placeholder="operator@example.com"
                    value={form.email}
                    disabled={!!editingUid}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </div>

                {!editingUid && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Temporary Password
                    </label>
                    <input
                      type="password"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-800 focus:ring-2 focus:ring-slate-800/15"
                      placeholder="Enter password"
                      value={form.password}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          password: e.target.value,
                        })
                      }
                    />
                  </div>
                )}

                {/* SEARCHABLE DROPDOWN */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Assign Cameras
                  </label>
                  <div ref={dropdownRef} className="relative">
                    <input
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-800 focus:ring-2 focus:ring-slate-800/15"
                      placeholder="Search cameras by name or area..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setDropdownOpen(true);
                      }}
                      onFocus={() => setDropdownOpen(true)}
                    />

                    {dropdownOpen && (
                      <div className="absolute z-10 mt-2 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                        <div className="p-2">
                          {filteredCameras.length === 0 ? (
                            <p className="p-2 text-slate-500 text-sm text-center">
                              No cameras found
                            </p>
                          ) : (
                            filteredCameras.map((cam) => (
                              <label
                                key={cam.id}
                                className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer rounded-lg transition"
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                  checked={form.cameras.includes(cam.id)}
                                  onChange={(e) => {
                                    const updated = e.target.checked
                                      ? [...form.cameras, cam.id]
                                      : form.cameras.filter(
                                          (c) => c !== cam.id
                                        );
                                    setForm({
                                      ...form,
                                      cameras: updated,
                                    });
                                  }}
                                />
                                <div>
                                  <p className="font-medium text-slate-800">{cam.name}</p>
                                  <p className="text-xs text-slate-500">{cam.area}</p>
                                </div>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Selected cameras preview */}
                  {form.cameras.length > 0 && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <Camera className="h-4 w-4" />
                        Selected ({form.cameras.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {form.cameras.map((id) => {
                          const cam = cameras.find(c => c.id === id);
                          return (
                            <span
                              key={id}
                              className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-md text-xs font-medium"
                            >
                              {cam?.name || id}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ACTIONS */}
              <div className="mt-8 flex justify-end gap-3 border-t border-slate-200 pt-6">
                <button
                  onClick={closeModal}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={
                    editingUid ? updateOperator : addOperator
                  }
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                >
                  Save Changes
                </button>
              </div>
              </div>
            </div>
          </div>
        )}

        {/* RESET PASSWORD MODAL */}
        {resetUid && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.24)] overflow-hidden">
              <div className="bg-slate-900 px-6 py-4 text-white">
                <h3 className="inline-flex items-center gap-2 text-lg font-semibold">
                  <KeyRound className="h-5 w-5" />
                  Reset Operator Password
                </h3>
                <p className="mt-1 text-sm text-slate-300">
                  Set a new temporary password for this account.
                </p>
              </div>

              <div className="p-6">

              <input
                type="password"
                className="mb-5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-800 focus:ring-2 focus:ring-slate-800/15"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setResetUid(null);
                    setNewPassword("");
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={resetPassword}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  Reset
                </button>
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}