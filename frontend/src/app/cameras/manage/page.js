"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function ManageCameras() {
  const router = useRouter();

  const [cameras, setCameras] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    area: "",
    latitude: "",
    longitude: "",
    active: true,
  });

  /* ---------------- AUTH + ROLE GUARD ---------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      const role = localStorage.getItem("role");
      if (role !== "admin") {
        router.push("/dashboard");
        return;
      }

      setLoading(false);
      fetchCameras();
    });

    return () => unsub();
  }, [router]);

  /* ---------------- FETCH CAMERAS ---------------- */
  const fetchCameras = async () => {
    try {
      const token = await auth.currentUser.getIdToken();

      const res = await fetch("http://localhost:5000/api/cameras", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      setCameras(data);
    } catch (err) {
      console.error("Failed to fetch cameras", err);
    }
  };

  /* ---------------- OPEN EDIT MODAL ---------------- */
  const openEdit = (camera) => {
    setEditing(camera.cameraId);
    setForm({
      name: camera.name || "",
      area: camera.area || "",
      latitude: camera.latitude ?? "",
      longitude: camera.longitude ?? "",
      active: camera.active ?? true,
    });
  };

  /* ---------------- UPDATE CAMERA ---------------- */
  const updateCamera = async () => {
    try {
      const token = await auth.currentUser.getIdToken();

      await fetch(
        `http://localhost:5000/api/cameras/${editing}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...form,
            latitude: Number(form.latitude),
            longitude: Number(form.longitude),
          }),
        }
      );

      setEditing(null);
      fetchCameras();
    } catch (err) {
      alert("Failed to update camera");
    }
  };

  /* ---------------- DELETE CAMERA ---------------- */
  const deleteCamera = async (cameraId) => {
    if (!confirm("Delete this camera?")) return;

    try {
      const token = await auth.currentUser.getIdToken();

      await fetch(
        `http://localhost:5000/api/cameras/${cameraId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      fetchCameras();
    } catch (err) {
      alert("Failed to delete camera");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading cameras...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        🎥 Manage Cameras (Admin)
      </h1>

      <table className="w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">Camera ID</th>
            <th className="border p-2">Name</th>
            <th className="border p-2">Area</th>
            <th className="border p-2">Active</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>

        <tbody>
          {cameras.map((cam) => (
            <tr key={cam.cameraId}>
              <td className="border p-2">{cam.cameraId}</td>
              <td className="border p-2">{cam.name}</td>
              <td className="border p-2">{cam.area}</td>
              <td className="border p-2">
                {cam.active ? "Yes" : "No"}
              </td>
              <td className="border p-2 space-x-2">
                <button
                  onClick={() => openEdit(cam)}
                  className="bg-blue-600 text-white px-2 py-1 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteCamera(cam.cameraId)}
                  className="bg-red-600 text-white px-2 py-1 rounded"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ✏️ EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded w-96">
            <h2 className="text-xl font-bold mb-4">
              Edit Camera
            </h2>

            {["name", "area", "latitude", "longitude"].map((field) => (
              <input
                key={field}
                className="w-full p-2 border mb-2"
                placeholder={field}
                value={form[field]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [field]: e.target.value,
                  })
                }
              />
            ))}

            <label className="flex items-center gap-2 mb-3">
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
                onClick={() => setEditing(null)}
                className="px-3 py-1 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={updateCamera}
                className="px-3 py-1 bg-green-600 text-white rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
