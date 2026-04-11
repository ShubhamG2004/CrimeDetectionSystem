"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import { Shield, UserPlus, KeyRound, Camera, X, User } from "lucide-react";

import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

const OPERATORS_PAGE_CACHE_KEY = "admin_operators_page_cache_v1";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
  const [selectedOperator, setSelectedOperator] = useState(null);

  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [savingOperator, setSavingOperator] = useState(false);
  const [updatingStatusUid, setUpdatingStatusUid] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  const emptyForm = {
    email: "",
    password: "",
    cameras: [],
  };

  const [form, setForm] = useState(emptyForm);

  const readCachedData = () => {
    if (typeof window === "undefined") return null;

    try {
      const raw = sessionStorage.getItem(OPERATORS_PAGE_CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.operators) || !Array.isArray(parsed?.cameras)) {
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn("Failed to read operators page cache", error);
      return null;
    }
  };

  const writeCachedData = (nextOperators, nextCameras) => {
    if (typeof window === "undefined") return;

    try {
      sessionStorage.setItem(
        OPERATORS_PAGE_CACHE_KEY,
        JSON.stringify({ operators: nextOperators, cameras: nextCameras })
      );
    } catch (error) {
      console.warn("Failed to write operators page cache", error);
    }
  };

  /* ================= MOUNTED STATE ================= */
  useEffect(() => {
    setMounted(true);
  }, []);

  /* ================= AUTH GUARD ================= */
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const bootstrap = async (user) => {
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

      const cached = readCachedData();
      if (cached) {
        setOperators(cached.operators);
        setCameras(cached.cameras);
        setLoading(false);
      }

      try {
        await fetchOperatorsAndCameras();
      } catch (error) {
        console.error("Failed to load operators page:", error);
        setPageError(error?.message || "Unable to load operators right now.");
      } finally {
        setLoading(false);
      }
    };

    if (auth.currentUser) {
      bootstrap(auth.currentUser);
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      await bootstrap(user);
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
  const fetchOperatorsAndCameras = async () => {
    if (!auth.currentUser) return;

    const token = await auth.currentUser.getIdToken(true);
    const headers = { Authorization: `Bearer ${token}` };

    const [operatorRes, cameraRes] = await Promise.all([
      fetch(`${API_BASE}/api/admin/operators`, { headers }),
      fetch(`${API_BASE}/api/cameras`, { headers }),
    ]);

    const operatorData = await operatorRes.json();
    const cameraData = await cameraRes.json();

    if (!operatorRes.ok) {
      throw new Error(operatorData?.message || "Failed to load operators");
    }

    if (!cameraRes.ok) {
      throw new Error(cameraData?.message || "Failed to load cameras");
    }

    setPageError("");

    const nextOperators = Array.isArray(operatorData?.operators)
      ? operatorData.operators
      : [];
    const nextCameras = (Array.isArray(cameraData) ? cameraData : []).map((cam) => ({
      id: cam.cameraId,
      ...cam,
    }));

    setOperators(nextOperators);
    setCameras(nextCameras);
    writeCachedData(nextOperators, nextCameras);
  };

  /* ================= ADD OPERATOR ================= */
  const addOperator = async () => {
    if (!form.email || !form.password || form.cameras.length === 0) {
      alert("All fields are required");
      return;
    }

    try {
      setSavingOperator(true);
      const token = await auth.currentUser.getIdToken();

      const res = await fetch(
        `${API_BASE}/api/admin/create-operator`,
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
      if (!res.ok) {
        alert(data.message || "Failed to create operator");
        return;
      }

      closeModal();
      await fetchOperatorsAndCameras();
    } catch (error) {
      console.error("Failed to create operator:", error);
      alert("Could not create operator. Please retry.");
    } finally {
      setSavingOperator(false);
    }
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

    try {
      setSavingOperator(true);
      const token = await auth.currentUser.getIdToken(true);
      const res = await fetch(`${API_BASE}/api/admin/operators/${editingUid}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cameras: form.cameras,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data?.message || "Failed to update operator");
        return;
      }

      closeModal();
      await fetchOperatorsAndCameras();
    } catch (error) {
      console.error("Failed to update operator:", error);
      alert("Could not update operator. Please retry.");
    } finally {
      setSavingOperator(false);
    }
  };

  /* ================= TOGGLE STATUS ================= */
  const toggleStatus = async (uid, status) => {
    try {
      setUpdatingStatusUid(uid);
      const token = await auth.currentUser.getIdToken(true);
      const nextStatus = status === "active" ? "inactive" : "active";

      const res = await fetch(`${API_BASE}/api/admin/operators/${uid}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data?.message || "Failed to update operator status");
        return;
      }

      await fetchOperatorsAndCameras();
    } catch (error) {
      console.error("Failed to update operator status:", error);
      alert("Could not update status. Please retry.");
    } finally {
      setUpdatingStatusUid("");
    }
  };

  const getCreatedAtMs = (createdAt) => {
    if (!createdAt) return null;
    if (typeof createdAt?.toMillis === "function") return createdAt.toMillis();
    if (typeof createdAt?.seconds === "number") return createdAt.seconds * 1000;
    if (typeof createdAt?._seconds === "number") return createdAt._seconds * 1000;
    const parsed = new Date(createdAt).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  };

  const formatDateLabel = (value) => {
    const ts = getCreatedAtMs(value);
    if (!ts) return "-";

    return new Date(ts).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /* ================= RESET PASSWORD ================= */
  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    try {
      setResettingPassword(true);
      const token = await auth.currentUser.getIdToken();

      const res = await fetch(
        `${API_BASE}/api/admin/reset-operator-password`,
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
        alert(data.message || "Failed to reset password");
        return;
      }

      alert("Password reset successfully");

      setResetUid(null);
      setNewPassword("");
    } catch (error) {
      console.error("Failed to reset password:", error);
      alert("Could not reset password. Please retry.");
    } finally {
      setResettingPassword(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUid(null);
    setForm(emptyForm);
    setSearch("");
    setDropdownOpen(false);
  };

  /* ================= CAMERA NAME MAP ================= */
  const cameraMap = useMemo(
    () =>
      cameras.reduce((acc, cam) => {
        acc[cam.id] = cam.name;
        return acc;
      }, {}),
    [cameras]
  );

  const filteredCameras = useMemo(
    () =>
      cameras.filter((cam) => {
        const name = (cam.name || "").toLowerCase();
        const area = (cam.area || "").toLowerCase();
        const q = search.toLowerCase();
        return name.includes(q) || area.includes(q);
      }),
    [cameras, search]
  );

  return (
    <div className="app-shell flex">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="Operator Management" />

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
              <p className="text-sm text-slate-500 mt-1">
                Double-click an operator row to open full details.
              </p>
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
            {loading && (
              <div className="p-4 border-b border-slate-200 text-sm text-slate-500">
                Refreshing operators...
              </div>
            )}
            {!!pageError && (
              <div className="p-4 border-b border-rose-200 bg-rose-50 text-sm text-rose-700">
                {pageError}
              </div>
            )}
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
                  <tr
                    key={op.uid}
                    onDoubleClick={() => setSelectedOperator(op)}
                    className="border-t border-slate-100 hover:bg-slate-50/70 transition duration-150 cursor-pointer"
                  >
                    <td className="p-4">{op.email}</td>

                    <td className="p-4">
                      <ul className="space-y-1.5">
                        {(op.cameras || []).map((id) => (
                          <li
                            key={id}
                            className="px-2.5 py-1 bg-orange-50 text-orange-700 rounded-md text-xs font-medium"
                          >
                            {cameraMap[id] || id}
                          </li>
                        ))}
                      </ul>
                    </td>

                    <td className="p-4 text-center">
                      <span
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                          op.status === "active"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {op.status}
                      </span>
                    </td>

                    <td className="p-4 text-center text-gray-600">
                      {(() => {
                        const createdAtMs = getCreatedAtMs(op.createdAt);
                        return mounted && createdAtMs
                          ? new Date(createdAtMs).toLocaleDateString([], {
                            year: "numeric",
                            month: "short",
                            day: "numeric"
                          })
                          : "-";
                      })()}
                    </td>

                    <td
                      className="p-3 text-center space-x-2"
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          editOperator(op);
                        }}
                        className="px-3 py-1.5 bg-slate-900 text-white text-xs rounded-md font-medium hover:bg-black transition"
                      >
                        Edit
                      </button>

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setResetUid(op.uid);
                          setNewPassword("");
                        }}
                        className="px-3 py-1.5 bg-orange-600 text-white text-xs rounded-md font-medium hover:bg-orange-700 transition"
                      >
                        Reset Password
                      </button>

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleStatus(op.uid, op.status);
                        }}
                        disabled={updatingStatusUid === op.uid}
                        className={`px-3 py-1.5 text-white text-xs rounded-md font-medium transition ${
                          op.status === "active"
                            ? "bg-orange-600 hover:bg-orange-700"
                            : "bg-orange-600 hover:bg-orange-700"
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {updatingStatusUid === op.uid
                          ? "Saving..."
                          : op.status === "active"
                            ? "Disable"
                            : "Enable"}
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
                      <div className="space-y-1.5">
                        {form.cameras.map((id) => {
                          const cam = cameras.find(c => c.id === id);
                          return (
                            <span
                              key={id}
                              className="block px-2.5 py-1 bg-slate-200 text-slate-700 rounded-md text-xs font-medium"
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
                  disabled={savingOperator}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                >
                  {savingOperator ? "Saving..." : "Save Changes"}
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
                  disabled={resettingPassword}
                  className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  {resettingPassword ? "Resetting..." : "Reset"}
                </button>
              </div>
              </div>
            </div>
          </div>
        )}

        {/* OPERATOR DETAILS MODAL */}
        {selectedOperator && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.24)] overflow-hidden">
              <div className="border-b border-slate-200 bg-linear-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-2.5 py-1 text-[11px] uppercase tracking-wide text-slate-200">
                      <User className="h-3 w-3" />
                      Operator profile
                    </p>
                    <h3 className="mt-3 text-xl font-semibold">{selectedOperator.email}</h3>
                    <p className="mt-1 text-sm text-slate-300 break-all">UID: {selectedOperator.uid}</p>
                  </div>
                  <button
                    onClick={() => setSelectedOperator(null)}
                    className="rounded-lg border border-white/20 p-2 text-slate-200 hover:bg-white/10"
                    aria-label="Close details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Role</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedOperator.role || "operator"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Status</p>
                    <p className={`mt-1 text-sm font-semibold ${
                      (selectedOperator.status || "active") === "active"
                        ? "text-orange-700"
                        : "text-rose-700"
                    }`}>
                      {(selectedOperator.status || "active").toUpperCase()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Assigned Cameras</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{(selectedOperator.cameras || []).length}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">Created At</p>
                    <p className="mt-1 text-sm text-slate-900 font-medium">{formatDateLabel(selectedOperator.createdAt)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">Updated At</p>
                    <p className="mt-1 text-sm text-slate-900 font-medium">{formatDateLabel(selectedOperator.updatedAt)}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <Camera className="h-4 w-4" />
                    Camera Assignments
                  </p>

                  {(selectedOperator.cameras || []).length === 0 ? (
                    <p className="text-sm text-slate-500">No cameras assigned.</p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedOperator.cameras.map((cameraId) => {
                        const cam = cameras.find((entry) => entry.id === cameraId);
                        return (
                          <li key={cameraId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-sm font-medium text-slate-900">{cam?.name || cam?.cameraName || cameraId}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {cam?.area || cam?.location || "Unknown area"}
                              {cam?.latitude != null && cam?.longitude != null
                                ? ` | ${cam.latitude}, ${cam.longitude}`
                                : ""}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setSelectedOperator(null)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Close
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
