"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radio,
  BarChart3,
  Video,
  Users,
  ClipboardList,
  Shield,
} from "lucide-react";

export default function AdminSidebar() {
  const pathname = usePathname();
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
    <aside className="w-64 h-screen bg-white text-slate-900 border-r border-gray-200 px-4 py-6 space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center">
            <Shield className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Admin Control</h2>
            <p className="text-xs text-slate-500 mt-1">Operations & governance</p>
          </div>
        </div>
      </div>

      <nav className="space-y-2">
        <a href="/dashboard/admin" className={navItemClass(isActive("/dashboard/admin"))}>
          <LayoutDashboard className={iconClass(isActive("/dashboard/admin"))} />
          <span className={labelClass(isActive("/dashboard/admin"))}>Overview</span>
        </a>

        <a href="/dashboard/operator" className={navItemClass(isActive("/dashboard/operator"))}>
          <Radio className={iconClass(isActive("/dashboard/operator"))} />
          <span className={labelClass(isActive("/dashboard/operator"))}>Live Monitoring</span>
        </a>

        <a href="/analytics" className={navItemClass(isActive("/analytics"))}>
          <BarChart3 className={iconClass(isActive("/analytics"))} />
          <span className={labelClass(isActive("/analytics"))}>Analytics</span>
        </a>

        <a href="/cameras" className={navItemClass(isActive("/cameras"))}>
          <Video className={iconClass(isActive("/cameras"))} />
          <span className={labelClass(isActive("/cameras"))}>Manage Cameras</span>
        </a>

        <a
          href="/dashboard/admin/operators"
          className={navItemClass(isActive("/dashboard/admin/operators"))}
        >
          <Users className={iconClass(isActive("/dashboard/admin/operators"))} />
          <span className={labelClass(isActive("/dashboard/admin/operators"))}>Manage Operators</span>
        </a>

        <a
          href="/dashboard/admin/operator-logs"
          className={navItemClass(isActive("/dashboard/admin/operator-logs"))}
        >
          <ClipboardList className={iconClass(isActive("/dashboard/admin/operator-logs"))} />
          <span className={labelClass(isActive("/dashboard/admin/operator-logs"))}>Operator Logs</span>
        </a>
      </nav>

      <div className="app-panel p-4 text-xs text-slate-500">
        Security posture active. All activities are logged.
      </div>
    </aside>
  );
}
