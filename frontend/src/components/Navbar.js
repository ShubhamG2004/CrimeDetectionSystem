"use client";

import LogoutButton from "./LogoutButton";

export default function Navbar({ title }) {
  const handleMenuClick = () => {
    window.dispatchEvent(new CustomEvent("app:toggle-sidebar"));
  };

  return (
    <div className="flex h-16 items-center justify-between gap-4 px-6 bg-white text-slate-900 border-b border-gray-200 shadow-[0_6px_16px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={handleMenuClick}
          className="md:hidden rounded-md px-2 py-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          aria-label="Open sidebar"
        >
          ☰
        </button>
        <div className="min-w-0">
          {typeof title === "string" ? (
            <h1 className="text-base sm:text-xl font-semibold text-slate-950 truncate tracking-[-0.3px]">
              {title}
            </h1>
          ) : (
            title
          )}
        </div>
      </div>
      <div className="shrink-0">
        <LogoutButton />
      </div>
    </div>
  );
}
