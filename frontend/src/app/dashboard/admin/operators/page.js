"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";

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

  const emptyForm = {
    email: "",
    password: "",
    cameras: [],
  };

  const [form, setForm] = useState(emptyForm);

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

      if (role !== "admin") {
        router.replace("/dashboard/operator");
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
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="👮 Operator Management" />

        <div className="p-6">
          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Operators
            </h2>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition duration-200"
            >
              ➕ Add Operator
            </button>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 text-left font-semibold text-gray-700">Email</th>
                  <th className="p-4 text-left font-semibold text-gray-700">Cameras</th>
                  <th className="p-4 text-center font-semibold text-gray-700">Status</th>
                  <th className="p-4 text-center font-semibold text-gray-700">Created</th>
                  <th className="p-4 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>

              <tbody className="text-gray-800">
                {operators.map((op) => (
                  <tr key={op.uid} className="border-t hover:bg-gray-50 transition duration-150">
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
                      {op.createdAt
                        ? new Date(
                            op.createdAt.seconds * 1000
                          ).toLocaleDateString()
                        : "—"}
                    </td>

                    <td className="p-3 text-center space-x-2">
                      <button
                        onClick={() => editOperator(op)}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => {
                          setResetUid(op.uid);
                          setNewPassword("");
                        }}
                        className="px-3 py-1 bg-yellow-600 text-white text-xs rounded"
                      >
                        Reset Password
                      </button>

                      <button
                        onClick={() => toggleStatus(op.uid, op.status)}
                        className={`px-3 py-1 text-white text-xs rounded ${
                          op.status === "active"
                            ? "bg-red-600"
                            : "bg-green-600"
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-[440px] p-6 shadow-xl">
              <h3 className="font-bold text-xl mb-6 text-gray-800">
                {editingUid ? "Edit Operator" : "Add Operator"}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Operator Email
                  </label>
                  <input
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Temporary Password
                    </label>
                    <input
                      type="password"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign Cameras
                  </label>
                  <div ref={dropdownRef} className="relative">
                    <input
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="Search cameras by name or area..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setDropdownOpen(true);
                      }}
                      onFocus={() => setDropdownOpen(true)}
                    />

                    {dropdownOpen && (
                      <div className="absolute z-10 mt-1 bg-white border border-gray-300 rounded-lg w-full max-h-48 overflow-y-auto shadow-lg">
                        <div className="p-2">
                          {filteredCameras.length === 0 ? (
                            <p className="p-2 text-gray-500 text-sm text-center">
                              No cameras found
                            </p>
                          ) : (
                            filteredCameras.map((cam) => (
                              <label
                                key={cam.id}
                                className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer rounded-md transition"
                              >
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
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
                                  <p className="font-medium text-gray-800">{cam.name}</p>
                                  <p className="text-xs text-gray-500">{cam.area}</p>
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
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-1">Selected ({form.cameras.length}):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {form.cameras.map((id) => {
                          const cam = cameras.find(c => c.id === id);
                          return (
                            <span
                              key={id}
                              className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium"
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
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
                <button
                  onClick={closeModal}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={
                    editingUid ? updateOperator : addOperator
                  }
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition duration-200"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RESET PASSWORD MODAL */}
        {resetUid && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-[360px] p-6">
              <h3 className="font-bold text-lg mb-4">
                🔐 Reset Operator Password
              </h3>

              <input
                type="password"
                className="w-full p-2 border rounded mb-4"
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
                  className="px-4 py-1 border rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={resetPassword}
                  className="px-4 py-1 bg-red-600 text-white rounded"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}