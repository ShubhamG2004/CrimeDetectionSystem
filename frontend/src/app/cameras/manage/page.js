"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import AdminSidebar from "@/components/AdminSidebar";
import Navbar from "@/components/Navbar";

export default function ManageCameras() {
  const router = useRouter();

  const [cameras, setCameras] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const emptyForm = {
    name: "",
    area: "",
    latitude: "",
    longitude: "",
    active: true,
  };

  const [form, setForm] = useState(emptyForm);

  /* ---------------- AUTH ---------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return router.push("/login");
      if (localStorage.getItem("role") !== "admin")
        return router.push("/dashboard");

      setLoading(false);
      fetchCameras();
    });

    return () => unsub();
  }, [router]);

  /* ---------------- FETCH ---------------- */
  const fetchCameras = async () => {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch("http://localhost:5000/api/cameras", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setCameras(await res.json());
  };

  /* ---------------- ADD ---------------- */
  const addCamera = async () => {
    const token = await auth.currentUser.getIdToken();

    const payload = {
      ...form,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      active: Boolean(form.active),
    };

    const res = await fetch("http://localhost:5000/api/cameras", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) return alert(data.message);

    alert("✅ Camera added");
    setEditing(null);
    setForm(emptyForm);
    fetchCameras();
  };

  /* ---------------- UPDATE ---------------- */
  const updateCamera = async () => {
    const token = await auth.currentUser.getIdToken();

    const payload = {
      ...form,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      active: Boolean(form.active),
    };

    const res = await fetch(
      `http://localhost:5000/api/cameras/${editing}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();
    if (!res.ok) return alert(data.message);

    alert("✅ Camera updated");
    setEditing(null);
    fetchCameras();
  };

  /* ---------------- DELETE ---------------- */
  const deleteCamera = async (id) => {
    if (!confirm("Delete camera?")) return;
    const token = await auth.currentUser.getIdToken();

    await fetch(`http://localhost:5000/api/cameras/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    fetchCameras();
  };

  if (loading) return <p className="ml-64 p-6">Loading...</p>;

  return (
    <>
      {/* 🔥 ADMIN SIDEBAR */}
      <AdminSidebar />

      {/* 🔥 MAIN CONTENT */}
      <main className="ml-64 p-6">
        <div className="flex justify-between mb-4">
          <h1 className="text-2xl font-bold">🎥 Manage Cameras</h1>
          <button
            className="bg-green-600 text-white px-4 py-2 rounded"
            onClick={() => {
              setEditing("new");
              setForm(emptyForm);
            }}
          >
            ➕ Add Camera
          </button>
        </div>

        <table className="w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Area</th>
              <th>Lat</th>
              <th>Lng</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cameras.map((cam) => (
              <tr key={cam.cameraId}>
                <td>{cam.cameraId}</td>
                <td>{cam.name}</td>
                <td>{cam.area}</td>
                <td>{cam.latitude}</td>
                <td>{cam.longitude}</td>
                <td className={cam.active ? "text-green-600" : "text-red-600"}>
                  {cam.active ? "ACTIVE" : "INACTIVE"}
                </td>
                <td>
                  <button
                    onClick={() => {
                      setEditing(cam.cameraId);
                      setForm({
                        name: cam.name,
                        area: cam.area,
                        latitude: cam.latitude,
                        longitude: cam.longitude,
                        active: Boolean(cam.active),
                      });
                    }}
                    className="bg-blue-600 text-white px-2 mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteCamera(cam.cameraId)}
                    className="bg-red-600 text-white px-2"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* MODAL */}
        {editing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 w-96 rounded">
              <h2 className="text-xl font-bold mb-3">
                {editing === "new" ? "Add Camera" : "Edit Camera"}
              </h2>

              {["name", "area", "latitude", "longitude"].map((f) => (
                <input
                  key={f}
                  className="border p-2 w-full mb-2"
                  placeholder={f}
                  value={form[f]}
                  onChange={(e) =>
                    setForm({ ...form, [f]: e.target.value })
                  }
                />
              ))}

              {/* 🔥 ACTIVE SLIDER */}
              <div className="flex items-center gap-3 mb-4">
                <span>Inactive</span>
                <input
                  type="checkbox"
                  checked={Boolean(form.active)}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                />
                <span>Active</span>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(null)}>Cancel</button>
                <button
                  onClick={editing === "new" ? addCamera : updateCamera}
                  className="bg-green-600 text-white px-3 py-1"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
