"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
<<<<<<< HEAD
import { Camera, ListChecks, LayoutDashboard, Shield, UserCircle2, Wifi, MessageSquare } from "lucide-react";
=======
import { Camera, ListChecks, LayoutDashboard, Shield, UserCircle2, Wifi } from "lucide-react";
>>>>>>> 59bb784332c94aa99401ea1f39917d25316ef8f9
import LogoutButton from "./LogoutButton";

export default function FieldOperatorSidebar() {
  const pathname = usePathname();

  const isActive = (href) => pathname.startsWith(href);

  const navItemClass = (active) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active
        ? "bg-gradient-to-r from-slate-950 to-slate-800 text-white shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
        : "text-slate-700 font-medium hover:bg-gradient-to-r hover:from-slate-50 hover:to-white"
    }`;

  const iconClass = (active) =>
    active ? "h-5 w-5 text-white" : "h-5 w-5 text-slate-600";

  const labelClass = (active) =>
    active ? "text-white" : "text-slate-700";

  return (
    <aside className="w-64 h-screen bg-white border-r border-gray-200 px-4 py-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center shadow-sm">
            <Shield className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Field Operator</h2>
            <p className="text-xs text-slate-500 mt-1">Camera installation desk</p>
          </div>
        </div>

        <nav className="space-y-2">
          <Link
            href="/field-operator"
            className={navItemClass(pathname === "/field-operator")}
          >
            <LayoutDashboard className={iconClass(pathname === "/field-operator")} />
            <span className={labelClass(pathname === "/field-operator")}>Overview</span>
          </Link>

          <Link
            href="/field-operator/add-camera"
            className={navItemClass(isActive("/field-operator/add-camera"))}
          >
            <Camera className={iconClass(isActive("/field-operator/add-camera"))} />
            <span className={labelClass(isActive("/field-operator/add-camera"))}>Add Camera</span>
          </Link>

          <Link
            href="/field-operator/my-cameras"
            className={navItemClass(isActive("/field-operator/my-cameras"))}
          >
            <ListChecks className={iconClass(isActive("/field-operator/my-cameras"))} />
            <span className={labelClass(isActive("/field-operator/my-cameras"))}>My Cameras</span>
          </Link>

          <Link
            href="/field-operator/connect-esp32"
            className={navItemClass(isActive("/field-operator/connect-esp32"))}
          >
            <Wifi className={iconClass(isActive("/field-operator/connect-esp32"))} />
            <span className={labelClass(isActive("/field-operator/connect-esp32"))}>Connect ESP32</span>
          </Link>

          <Link
            href="/field-operator/profile"
            className={navItemClass(isActive("/field-operator/profile"))}
          >
            <UserCircle2 className={iconClass(isActive("/field-operator/profile"))} />
            <span className={labelClass(isActive("/field-operator/profile"))}>Profile</span>
          </Link>
<<<<<<< HEAD

          <Link
            href="/field-operator/messages"
            className={navItemClass(isActive("/field-operator/messages"))}
          >
            <MessageSquare className={iconClass(isActive("/field-operator/messages"))} />
            <span className={labelClass(isActive("/field-operator/messages"))}>Messages</span>
          </Link>
=======
>>>>>>> 59bb784332c94aa99401ea1f39917d25316ef8f9
        </nav>
      </div>

      <div className="mt-8 p-4 text-xs text-slate-500 border-t border-slate-200">
        <p className="font-medium text-slate-700 mb-2">Session</p>
        <LogoutButton />
      </div>
    </aside>
  );
}
