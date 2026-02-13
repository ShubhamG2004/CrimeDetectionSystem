"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Image, Map, Shield, CheckCircle } from "lucide-react";
import LogoutButton from "./LogoutButton";

export default function OperatorSidebar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleToggle = () => setMenuOpen((prev) => !prev);
    window.addEventListener("app:toggle-sidebar", handleToggle);
    return () => window.removeEventListener("app:toggle-sidebar", handleToggle);
  }, []);

  const handleClose = () => setMenuOpen(false);
  const isActive = (href) => pathname === href;

  const navItemClass = (active) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition ${
      active
        ? "bg-gradient-to-r from-slate-950 to-slate-800 text-white shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
        : "text-slate-700 font-medium hover:bg-gradient-to-r hover:from-slate-50 hover:to-white"
    }`;
  const iconClass = (active) => (active ? "h-5 w-5 text-white" : "h-5 w-5 text-slate-600");
  const labelClass = (active) => (active ? "text-white" : "text-slate-700");

  return (
    <>
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      <div
        id="operator-sidebar"
        className={`fixed left-0 top-0 z-50 h-screen w-64 bg-white text-slate-900 px-4 py-6 flex flex-col border-r border-gray-200 transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:min-h-screen ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Operator navigation"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950 tracking-[-0.4px]">
              Operator Console
            </h2>
            <p className="text-base font-medium text-slate-600 mt-1">
              Live response suite
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="md:hidden rounded-md px-2 py-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <nav className="space-y-2 flex-1">
          <a
            href="/dashboard/operator"
            onClick={handleClose}
            className={navItemClass(isActive("/dashboard/operator"))}
          >
            <AlertTriangle className={iconClass(isActive("/dashboard/operator"))} />
            <span className={labelClass(isActive("/dashboard/operator"))}>Live Incidents</span>
          </a>

          <a
            href="/detect-image"
            onClick={handleClose}
            className={navItemClass(isActive("/detect-image"))}
          >
            <Image className={iconClass(isActive("/detect-image"))} />
            <span className={labelClass(isActive("/detect-image"))}>Image Detection</span>
          </a>

          <a
            href="/dashboard/operator/map"
            onClick={handleClose}
            className={navItemClass(isActive("/dashboard/operator/map"))}
          >
            <Map className={iconClass(isActive("/dashboard/operator/map"))} />
            <span className={labelClass(isActive("/dashboard/operator/map"))}>Incident Map</span>
          </a>

          <a
            href="/dashboard/operator/incidents"
            onClick={handleClose}
            className={navItemClass(isActive("/dashboard/operator/incidents"))}
          >
            <CheckCircle className={iconClass(isActive("/dashboard/operator/incidents"))} />
            <span className={labelClass(isActive("/dashboard/operator/incidents"))}>Manage Incidents</span>
          </a>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
              <Shield className="h-5 w-5 text-slate-500" />
              <div>
                <span className="font-medium text-slate-600">Map View</span>
                <span className="text-xs text-slate-400 block mt-0.5">Coming Soon</span>
              </div>
            </div>
          </div>
        </nav>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <LogoutButton />
        </div>
      </div>
    </>
  );
}
