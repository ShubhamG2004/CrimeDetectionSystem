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

  const data = await res.json();

  // ✅ FIX: extract array safely
  setCameras(Array.isArray(data) ? data : data.cameras || []);
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
    <div className="app-shell flex">
      <AdminSidebar />

      <div className="flex-1">
        <Navbar title="🎥 Camera Management" />

        <div className="p-6">
          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="app-badge">Infrastructure</div>
              <h2 className="text-2xl font-semibold text-slate-900 mt-2">
                Cameras
              </h2>
            </div>
            <button
              onClick={() => {
                setShowModal(true);
                setForm(emptyForm);
                setEditingId(null);
              }}
              className="app-button"
            >
              ➕ Add Camera
            </button>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto app-card">
            <table className="w-full">
              <thead className="bg-slate-100 text-slate-700 text-sm">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Area</th>
                  <th className="p-3 text-center">Lat</th>
                  <th className="p-3 text-center">Lng</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="text-slate-800 text-sm">
                {cameras.map((cam) => (
                  <tr
                    key={cam.cameraId}
                    className="border-t border-slate-100 hover:bg-slate-50/70"
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
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
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
                        className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          deleteCamera(cam.cameraId)
                        }
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {cameras.length === 0 && (
              <p className="p-6 text-center text-slate-600 font-medium">
                No cameras found
              </p>
            )}
          </div>
        </div>

        {/* MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="app-card w-[420px] p-6">
              <h3 className="font-semibold text-lg text-slate-800 mb-4">
                {editingId ? "Edit Camera" : "Add Camera"}
              </h3>

              <input
                className="app-input mb-2"
                placeholder="Camera Name"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />

              <input
                className="app-input mb-2"
                placeholder="Area"
                value={form.area}
                onChange={(e) =>
                  setForm({ ...form, area: e.target.value })
                }
              />

              <input
                type="number"
                className="app-input mb-2"
                placeholder="Latitude"
                value={form.latitude}
                onChange={(e) =>
                  setForm({ ...form, latitude: e.target.value })
                }
              />

              <input
                type="number"
                className="app-input mb-3"
                placeholder="Longitude"
                value={form.longitude}
                onChange={(e) =>
                  setForm({ ...form, longitude: e.target.value })
                }
              />

              <label className="flex items-center gap-2 text-sm text-slate-700 mb-4">
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
                  className="px-4 py-1 border border-slate-300 rounded-lg text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCamera}
                  className="px-4 py-1 bg-slate-900 text-white rounded-lg"
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
