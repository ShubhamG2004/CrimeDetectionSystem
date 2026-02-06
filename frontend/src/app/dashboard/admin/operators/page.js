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

  const [operators, setOperators] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    cameras: [],
  });

  /* ================= AUTH GUARD ================= */
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    onAuthStateChanged(auth, (user) => {
      if (!user) return router.replace("/login");
      if (localStorage.getItem("role") !== "admin")
        return router.replace("/dashboard/operator");

      fetchOperators();
      fetchCameras();
    });
  }, [router]);

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

    if (!res.ok) {
      alert(data.message);
      return;
    }

    setForm({ email: "", password: "", cameras: [] });
    setShowModal(false);
    fetchOperators();
  };

  /* ================= TOGGLE STATUS ================= */
  const toggleStatus = async (uid, status) => {
    await updateDoc(doc(db, "operators", uid), {
      status: status === "active" ? "inactive" : "active",
    });
    fetchOperators();
  };

  // 🔁 Map cameraId -> camera name
  const cameraMap = cameras.reduce((acc, cam) => {
    acc[cam.id || cam.cameraId] = cam.name;
    return acc;
  }, {});


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
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
            >
              ➕ Add Operator
            </button>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto bg-white rounded shadow">
            <table className="w-full">
              <thead className="bg-gray-200 text-gray-800 text-sm">
                <tr>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Cameras</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Created</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="text-gray-800 text-sm">
                {operators.map((op) => (
                  <tr key={op.uid} className="border-t hover:bg-gray-50">
                    <td className="p-3">{op.email}</td>

                    <td className="p-3 flex flex-wrap gap-1">
                        {op.cameras?.map((camId) => (
                          <span
                            key={camId}
                            className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs"
                          >
                            {cameraMap[camId] || camId}
                          </span>
                        ))}
                      </td>

                    <td className="p-3 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          op.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {op.status}
                      </span>
                    </td>

                    {/* ✅ CREATED DATE */}
                    <td className="p-3 text-center text-gray-600">
                      {op.createdAt
                        ? new Date(op.createdAt.seconds * 1000).toLocaleDateString()
                        : "—"}
                    </td>

                    <td className="p-3 text-center">
                      <button
                        onClick={() => toggleStatus(op.uid, op.status)}
                        className={`px-3 py-1 rounded text-white text-xs font-medium ${
                          op.status === "active"
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-green-600 hover:bg-green-700"
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
              <p className="p-6 text-center text-gray-600 font-medium">
                No operators found
              </p>
            )}
          </div>
        </div>

        {/* MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-[420px] p-6">
              <h3 className="font-bold text-lg text-gray-800 mb-4">
                Add New Operator
              </h3>

              <input
                className="w-full p-2 border rounded mb-2 text-gray-800"
                placeholder="Operator Email"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
              />

              <input
                type="password"
                className="w-full p-2 border rounded mb-3 text-gray-800"
                placeholder="Temporary Password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
              />

              <label className="text-sm font-semibold text-gray-700 mb-1 block">
                Assign Cameras
              </label>

              <div className="border rounded p-2 mb-4 max-h-36 overflow-y-auto text-sm text-gray-800">
                {cameras.map((cam) => (
                  <label
                    key={cam.id}
                    className="flex items-center gap-2 mb-1"
                  >
                    <input
                      type="checkbox"
                      checked={form.cameras.includes(cam.id)}
                      onChange={(e) => {
                        const updated = e.target.checked
                          ? [...form.cameras, cam.id]
                          : form.cameras.filter(
                              (c) => c !== cam.id
                            );
                        setForm({ ...form, cameras: updated });
                      }}
                    />
                    {cam.name} ({cam.area})
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-1 border rounded text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={addOperator}
                  className="px-4 py-1 bg-green-600 text-white rounded"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
