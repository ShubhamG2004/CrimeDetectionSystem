"use client";

import LogoutButton from "./LogoutButton";

export default function OperatorSidebar() {
  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col">
      <h2 className="text-lg font-bold mb-6">
        👮 Operator Panel
      </h2>

      <nav className="space-y-3 flex-1">
        <a
          href="/dashboard/operator"
          className="block px-3 py-2 rounded hover:bg-gray-700"
        >
          🚨 Live Incidents
        </a>

        <a
          href="/detect-image"
          className="block px-3 py-2 rounded hover:bg-gray-700"
        >
          🖼 Image Detection
        </a>

        <a
          href="/dashboard/operator/map"
          className="block px-3 py-2 rounded hover:bg-gray-700"
        >
          🗺️ Incident Map
        </a>


        <a
          href="#"
          className="block px-3 py-2 rounded hover:bg-gray-700 opacity-60 cursor-not-allowed"
        >
          🗺 Map View (Coming Soon)
        </a>
      </nav>

      

      <div className="mt-6">
        <LogoutButton />
      </div>
    </div>
  );
}
