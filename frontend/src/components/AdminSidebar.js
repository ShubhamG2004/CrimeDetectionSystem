"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
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
  MessageSquare,
} from "lucide-react";

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const routesToPrefetch = [
      "/dashboard/admin/field-operators",
      "/dashboard/admin/operators",
      "/dashboard/admin/cameras",
      "/dashboard/admin/live-monitoring",
      "/dashboard/admin/messages",
    ];

    routesToPrefetch.forEach((route) => {
      router.prefetch(route);
    });
  }, [router]);

  // Keep overview active only on its exact route; other items support nested routes.
  const isActive = (href) =>
    href === "/dashboard/admin"
      ? pathname === href
      : pathname.startsWith(href);

  const navItemClass = (active) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active
        ? "bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.22)]"
        : "text-slate-600 font-medium hover:bg-orange-50 hover:text-orange-700"
    }`;

  const iconClass = (active) =>
    active ? "h-5 w-5 text-orange-300" : "h-5 w-5 text-slate-600";

  const labelClass = (active) =>
    active ? "text-white" : "text-slate-600";

  return (
    <aside className="sticky top-0 w-64 h-screen bg-white border-r border-slate-200 px-4 py-6 flex flex-col justify-between overflow-y-auto">
      
      {/* Top Section */}
      <div>
        {/* Logo / Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl border border-orange-200 bg-orange-50 flex items-center justify-center shadow-sm">
            <Shield className="h-5 w-5 text-orange-600" />
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

          <Link
            href="/dashboard/admin/messages"
            className={navItemClass(isActive("/dashboard/admin/messages"))}
          >
            <MessageSquare className={iconClass(isActive("/dashboard/admin/messages"))} />
            <span className={labelClass(isActive("/dashboard/admin/messages"))}>
              Messages
            </span>
          </Link>
        </nav>
      </div>

      {/* Bottom Info Panel */}
      <div className="mt-8 p-4 text-xs text-slate-500 border-t border-slate-200 bg-orange-50/50 rounded-xl">
        <p className="font-medium text-slate-800 mb-1">
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

