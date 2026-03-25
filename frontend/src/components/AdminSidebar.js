"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radio,
  BarChart3,
  Video,
  Users,
  ClipboardList,
  Shield,
  Building2,
  UserCircle2,
} from "lucide-react";

export default function AdminSidebar() {
  const pathname = usePathname();

  // Keep overview active only on its exact route; other items support nested routes.
  const isActive = (href) =>
    href === "/dashboard/admin"
      ? pathname === href
      : pathname.startsWith(href);

  const navItemClass = (active) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active
        ? "bg-black text-white"
        : "text-gray-600 font-medium hover:bg-gray-100"
    }`;

  const iconClass = (active) =>
    active ? "h-5 w-5 text-white" : "h-5 w-5 text-gray-600";

  const labelClass = (active) =>
    active ? "text-white" : "text-gray-600";

  return (
    <aside className="w-64 h-screen bg-white border-r border-gray-200 px-4 py-6 flex flex-col justify-between">
      
      {/* Top Section */}
      <div>
        {/* Logo / Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center shadow-sm">
            <Shield className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Admin Control
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Operations & Governance
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          <Link
            href="/dashboard/admin"
            className={navItemClass(isActive("/dashboard/admin"))}
          >
            <LayoutDashboard
              className={iconClass(isActive("/dashboard/admin"))}
            />
            <span className={labelClass(isActive("/dashboard/admin"))}>
              Overview
            </span>
          </Link>

          <Link
            href="/dashboard/admin/profile"
            className={navItemClass(isActive("/dashboard/admin/profile"))}
          >
            <UserCircle2
              className={iconClass(isActive("/dashboard/admin/profile"))}
            />
            <span className={labelClass(isActive("/dashboard/admin/profile"))}>
              Profile
            </span>
          </Link>

          <Link
            href="/dashboard/admin/live-monitoring"
            className={navItemClass(isActive("/dashboard/admin/live-monitoring"))}
          >
            <Radio
              className={iconClass(isActive("/dashboard/admin/live-monitoring"))}
            />
            <span className={labelClass(isActive("/dashboard/admin/live-monitoring"))}>
              Live Monitoring
            </span>
          </Link>

          <Link
            href="/dashboard/admin/field-operators"
            className={navItemClass(
              isActive("/dashboard/admin/field-operators")
            )}
          >
            <Users
              className={iconClass(
                isActive("/dashboard/admin/field-operators")
              )}
            />
            <span
              className={labelClass(
                isActive("/dashboard/admin/field-operators")
              )}
            >
              Field Operators
            </span>
          </Link>

          <Link
            href="/dashboard/admin/operators"
            className={navItemClass(
              isActive("/dashboard/admin/operators")
            )}
          >
            <Users
              className={iconClass(
                isActive("/dashboard/admin/operators")
              )}
            />
            <span
              className={labelClass(
                isActive("/dashboard/admin/operators")
              )}
            >
              Manage Operators
            </span>
          </Link>

          <Link
            href="/dashboard/admin/police-stations"
            className={navItemClass(isActive("/dashboard/admin/police-stations"))}
          >
            <Building2 className={iconClass(isActive("/dashboard/admin/police-stations"))} />
            <span className={labelClass(isActive("/dashboard/admin/police-stations"))}>
              Police Stations
            </span>
          </Link>

          <Link
            href="/dashboard/admin/cameras"
            className={navItemClass(
              isActive("/dashboard/admin/cameras")
            )}
          >
            <Video
              className={iconClass(
                isActive("/dashboard/admin/cameras")
              )}
            />
            <span
              className={labelClass(
                isActive("/dashboard/admin/cameras")
              )}
            >
              Manage Cameras
            </span>
          </Link>

          <Link
            href="/analytics"
            className={navItemClass(
              isActive("/analytics")
            )}
          >
            <BarChart3
              className={iconClass(
                isActive("/analytics")
              )}
            />
            <span
              className={labelClass(
                isActive("/analytics")
              )}
            >
              Analytics
            </span>
          </Link>

          <Link
            href="/dashboard/admin/operator-logs"
            className={navItemClass(
              isActive("/dashboard/admin/operator-logs")
            )}
          >
            <ClipboardList
              className={iconClass(
                isActive("/dashboard/admin/operator-logs")
              )}
            />
            <span
              className={labelClass(
                isActive("/dashboard/admin/operator-logs")
              )}
            >
              Operator Logs
            </span>
          </Link>
        </nav>
      </div>

      {/* Bottom Info Panel */}
      <div className="mt-8 p-4 text-xs text-slate-500 border-t border-slate-200">
        <p className="font-medium text-slate-700 mb-1">
          Security Status
        </p>
        <p>
          System posture active. All activities are logged and
          monitored in real time.
        </p>
      </div>
    </aside>
  );
}
