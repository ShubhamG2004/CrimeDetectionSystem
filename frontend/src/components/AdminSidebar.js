"use client";

export default function AdminSidebar() {
  return (
    <div className="w-64 bg-gray-800 text-white min-h-screen p-4 space-y-4">
      <h2 className="text-lg font-bold mb-4">
        🛠️ Admin Panel
      </h2>

      <a
        href="/dashboard/admin"
        className="block px-3 py-2 rounded hover:bg-gray-700"
      >
        📊 Overview
      </a>

      <a
        href="/dashboard/operator"
        className="block px-3 py-2 rounded hover:bg-gray-700"
      >
        👮 Live Monitoring
      </a>

      <a
        href="/analytics"
        className="block px-3 py-2 rounded hover:bg-gray-700"
      >
        📈 Analytics
      </a>

      <a
        href="/cameras"
        className="block px-3 py-2 rounded hover:bg-gray-700"
      >
        🎥 Manage Cameras
      </a>
      <a
    href="/dashboard/admin/operators"
    className="block px-3 py-2 rounded hover:bg-gray-700"
    >
    👮 Manage Operators
    </a>

    </div>
  );
}
