"use client";

import LogoutButton from "./LogoutButton";

export default function Navbar({ title }) {
  return (
    <div className="flex justify-between items-center px-6 py-4 bg-gray-900 text-white">
      <h1 className="text-xl font-semibold">{title}</h1>
      <LogoutButton />
    </div>
  );
}
