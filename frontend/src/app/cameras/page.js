"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

export default function ManageCameras() {
  const router = useRouter();
  const checkedRef = useRef(false);

  const [cameras, setCameras] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = {
    name: "",
    area: "",
    latitude: "",
    longitude: "",
    active: true,
  };

  const [form, setForm] = useState(emptyForm);

  /* ================= AUTH GUARD ================= */
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    onAuthStateChanged(auth, async (user) => {
      if (!user) return router.replace("/login");
      if (localStorage.getItem("role") !== "admin")
        return router.replace("/dashboard");

      fetchCameras();
    });
  }, [router]);

  /* ================= FETCH CAMERAS ================= */
  const fetchCameras = async () => {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch("http://localhost:5000/api/cameras", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setCameras(await res.json());
  };

  /* ================= ADD / UPDATE ================= */
  const saveCamera = async () => {
    if (!form.name || !form.area) {
      alert("All fields are required");
      return;
    }

    const token = await auth.currentUser.getIdToken();

    const payload = {
      ...form,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      active: Boolean(form.active),
    };

    const url = editingId
      ? `http://localhost:5000/api/cameras/${editingId}`
      : "http://localhost:5000/api/cameras";

    const res = await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) return alert(data.message);

    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchCameras();
  };

  /* ================= DELETE ================= */
  const deleteCamera = async (id) => {
    if (!confirm("Delete camera?")) return;
    const token = await auth.currentUser.getIdToken();

    await fetch(`http://localhost:5000/api/cameras/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    fetchCameras();
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="🎥 Camera Management" />

        <div className="p-6">
          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Cameras
            </h2>
            <button
              onClick={() => {
                setShowModal(true);
                setForm(emptyForm);
                setEditingId(null);
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow"
            >
              ➕ Add Camera
            </button>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto bg-white rounded shadow">
            <table className="w-full">
              <thead className="bg-gray-200 text-gray-800 text-sm">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Area</th>
                  <th className="p-3 text-center">Lat</th>
                  <th className="p-3 text-center">Lng</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="text-gray-800 text-sm">
                {cameras.map((cam) => (
                  <tr
                    key={cam.cameraId}
                    className="border-t hover:bg-gray-50"
                  >
                    <td className="p-3 font-medium">
                      {cam.name}
                    </td>
                    <td className="p-3">{cam.area}</td>
                    <td className="p-3 text-center">
                      {cam.latitude}
                    </td>
                    <td className="p-3 text-center">
                      {cam.longitude}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          cam.active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {cam.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3 text-center space-x-2">
                      <button
                        onClick={() => {
                          setEditingId(cam.cameraId);
                          setForm(cam);
                          setShowModal(true);
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          deleteCamera(cam.cameraId)
                        }
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {cameras.length === 0 && (
              <p className="p-6 text-center text-gray-600 font-medium">
                No cameras found
              </p>
            )}
          </div>
        </div>

        {/* MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-[420px] p-6">
              <h3 className="font-bold text-lg text-gray-800 mb-4">
                {editingId ? "Edit Camera" : "Add Camera"}
              </h3>

              <input
                className="w-full p-2 border rounded mb-2 text-gray-800"
                placeholder="Camera Name"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />

              <input
                className="w-full p-2 border rounded mb-2 text-gray-800"
                placeholder="Area"
                value={form.area}
                onChange={(e) =>
                  setForm({ ...form, area: e.target.value })
                }
              />

              <input
                type="number"
                className="w-full p-2 border rounded mb-2 text-gray-800"
                placeholder="Latitude"
                value={form.latitude}
                onChange={(e) =>
                  setForm({ ...form, latitude: e.target.value })
                }
              />

              <input
                type="number"
                className="w-full p-2 border rounded mb-3 text-gray-800"
                placeholder="Longitude"
                value={form.longitude}
                onChange={(e) =>
                  setForm({ ...form, longitude: e.target.value })
                }
              />

              <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      active: e.target.checked,
                    })
                  }
                />
                Active
              </label>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-1 border rounded text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCamera}
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
