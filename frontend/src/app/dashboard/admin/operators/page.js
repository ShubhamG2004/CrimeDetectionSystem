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
  setDoc,
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


  /* ---------- AUTH GUARD ---------- */
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

  /* ---------- FETCH OPERATORS ---------- */
  const fetchOperators = async () => {
    const snap = await getDocs(collection(db, "users"));
    setOperators(
      snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter((u) => u.role === "operator")
    );
  };

  /* ---------- FETCH CAMERAS ---------- */
  const fetchCameras = async () => {
    const snap = await getDocs(collection(db, "cameras"));
    setCameras(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  };

  /* ---------- ADD OPERATOR ---------- */
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
        body: JSON.stringify({
            email: form.email,
            password: form.password,
            cameras: form.cameras,
        }),
        }
    );

    const data = await res.json();

    if (!res.ok) {
        alert(data.message);
        return;
    }

    alert("Operator created successfully");
    setForm({ email: "", password: "", cameras: [] });
    setShowModal(false);
    fetchOperators();
    };


  /* ---------- TOGGLE OPERATOR ---------- */
  const toggleStatus = async (uid, active) => {
    await updateDoc(doc(db, "users", uid), {
      active: !active,
    });
    fetchOperators();
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="👮 Operator Management" />

        <div className="p-6">
          <button
            onClick={() => setShowModal(true)}
            className="mb-4 bg-blue-600 text-white px-4 py-2 rounded"
          >
            ➕ Add New Operator
          </button>

          {/* TABLE */}
          <table className="w-full bg-white rounded shadow">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-3 text-left">Email</th>
                <th className="p-3">Cameras</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>

            <tbody>
              {operators.map((op) => (
                <tr key={op.uid} className="border-t">
                  <td className="p-3">{op.email}</td>
                  <td className="p-3 text-sm">
                    {op.cameras?.join(", ")}
                  </td>
                  <td className="p-3 text-center">
                    {op.active ? "Active" : "Disabled"}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() =>
                        toggleStatus(op.uid, op.active)
                      }
                      className={`px-3 py-1 rounded text-white ${
                        op.active
                          ? "bg-red-600"
                          : "bg-green-600"
                      }`}
                    >
                      {op.active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ADD OPERATOR MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded w-96">
              <h2 className="font-bold mb-3">
                Add Operator
              </h2>

              <input
                placeholder="Operator Email"
                className="w-full p-2 border mb-2"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
              />

              <input
                type="password"
                placeholder="Temporary Password"
                className="w-full p-2 border mb-2"
                value={form.password}
                onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                }
                />


              <label className="text-sm font-semibold">
                Assign Cameras
              </label>

              <div className="border p-2 mb-3 max-h-32 overflow-y-auto">
                {cameras.map((cam) => (
                  <label
                    key={cam.id}
                    className="block text-sm"
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
                        setForm({
                          ...form,
                          cameras: updated,
                        });
                      }}
                    />{" "}
                    {cam.name} ({cam.area})
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1 border rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={addOperator}
                  className="px-3 py-1 bg-green-600 text-white rounded"
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
