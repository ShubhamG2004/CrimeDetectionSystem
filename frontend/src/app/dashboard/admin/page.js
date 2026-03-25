"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  ArrowRight,
  BarChart3,
  Camera,
  ClipboardList,
  Radio,
  UserCog,
  Activity,
  Shield,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

const kpiCards = [
  {
    title: "System Status",
    value: "Operational",
    trend: "+99.9% uptime",
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
    accent: "from-white via-zinc-50 to-neutral-100 border border-black/5",
  },
  {
    title: "Monitoring Coverage",
    value: "Citywide",
    trend: "156 active cameras",
    icon: Activity,
    iconColor: "text-blue-600",
    accent: "from-white via-zinc-100 to-neutral-50 border border-black/5",
  },
  {
    title: "Response Readiness",
    value: "High",
    trend: "Avg. 2.4 min response",
    icon: Shield,
    iconColor: "text-purple-600",
    accent: "from-white via-zinc-50 to-neutral-200 border border-black/5",
  },
  {
    title: "Active Alerts",
    value: "3",
    trend: "2 critical · 1 warning",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    accent: "from-white via-zinc-50 to-neutral-200 border border-black/5",
  },
];

const quickActions = [
  {
    title: "Live Monitoring",
    description: "Track active incidents and incoming threat alerts in real time.",
    href: "/dashboard/admin/live-monitoring",
    icon: Radio,
    badge: "Priority",
    tone: "from-black to-neutral-900",
  },
  {
    title: "Analytics",
    description: "Review trends, detection quality, and operational patterns.",
    href: "/analytics",
    icon: BarChart3,
    badge: "Insights",
    tone: "from-neutral-900 to-neutral-800",
  },
  {
    title: "Camera Management",
    description: "Approve pending camera feeds and manage active surveillance nodes.",
    href: "/dashboard/admin/cameras",
    icon: Camera,
    badge: "Governance",
    tone: "from-neutral-900 to-neutral-700",
  },
  {
    title: "Field Operators",
    description: "Assign and supervise field installation and maintenance staff.",
    href: "/dashboard/admin/field-operators",
    icon: UserCog,
    badge: "Workforce",
    tone: "from-neutral-900 to-stone-700",
  },
  {
    title: "Operator Logs",
    description: "Inspect activity history and spot unusual access behavior.",
    href: "/dashboard/admin/operator-logs",
    icon: ClipboardList,
    badge: "Audit",
    tone: "from-neutral-800 to-stone-600",
  },
];

export default function AdminDashboard() {
  const router = useRouter();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const role = localStorage.getItem("role");
      if (role !== ROLES.ADMIN) {
        router.replace("/dashboard");
      }
    });

    return () => unsub();
  }, [router]);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-white via-zinc-50 to-white text-slate-900">
      <AdminSidebar />

      <div className="flex-1 min-w-0">
        <Navbar title="Admin Control Dashboard" />

        <main className="relative p-4 sm:p-6 lg:p-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Welcome back
            </h1>
            <p className="mt-1 text-slate-600">
              Monitor system health and manage operations from your command center.
            </p>
          </div>

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-10">
            {kpiCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.accent} p-5 transition-all duration-200 hover:shadow-md`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        {card.title}
                      </p>
                      <p className="mt-2 text-3xl font-bold text-slate-900">
                        {card.value}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">{card.trend}</p>
                    </div>
                    <div className={`rounded-xl bg-white/50 p-2.5 shadow-sm ${card.iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Actions Section */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Quick Actions
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Frequently used administrative tools
                </p>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-black/5 text-xs font-medium text-slate-700">
                Admin Access
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="group relative overflow-hidden rounded-2xl border border-black/5 bg-white p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="inline-flex rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {action.badge}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 group-hover:text-slate-800 transition-colors">
                          {action.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-500">
                          {action.description}
                        </p>
                        <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                          Access
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                      <div className={`ml-4 rounded-xl bg-gradient-to-br ${action.tone} p-2.5 text-white shadow-sm shrink-0`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Recent Activity Placeholder - Optional */}
          <div className="mt-10 pt-6 border-t border-black/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Recent System Events
              </h3>
              <button className="text-xs text-slate-500 hover:text-slate-700 transition-colors">
                View all
              </button>
            </div>
            <div className="space-y-2">
              {[
                { time: "2 min ago", event: "Camera feed restored - Zone A-12", type: "success" },
                { time: "15 min ago", event: "Alert triaged by operator #3421", type: "info" },
                { time: "1 hour ago", event: "System health check completed", type: "info" },
              ].map((activity, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <p className="text-sm text-slate-600 flex-1">{activity.event}</p>
                  <span className="text-xs text-slate-400">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}