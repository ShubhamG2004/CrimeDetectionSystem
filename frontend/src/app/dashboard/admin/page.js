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
  ShieldAlert,
  UserCog,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { ROLES } from "@/lib/roles";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/AdminSidebar";

const kpiCards = [
  {
    title: "System Status",
    value: "Operational",
    note: "All core services healthy",
    accent: "from-emerald-500/15 to-emerald-200/20",
  },
  {
    title: "Monitoring Coverage",
    value: "Citywide",
    note: "Live watch across camera zones",
    accent: "from-sky-500/15 to-sky-200/20",
  },
  {
    title: "Response Readiness",
    value: "High",
    note: "Rapid dispatch pipeline active",
    accent: "from-amber-500/15 to-amber-200/20",
  },
  {
    title: "Audit Logging",
    value: "Enabled",
    note: "Operator actions are tracked",
    accent: "from-violet-500/15 to-fuchsia-200/20",
  },
];

const quickActions = [
  {
    title: "Live Monitoring",
    description: "Track active incidents and incoming threat alerts in real time.",
    href: "/dashboard/admin/live-monitoring",
    icon: Radio,
    badge: "Priority",
    tone: "from-rose-500 to-orange-500",
  },
  {
    title: "Analytics",
    description: "Review trends, detection quality, and operational patterns.",
    href: "/analytics",
    icon: BarChart3,
    badge: "Insights",
    tone: "from-cyan-500 to-blue-600",
  },
  {
    title: "Camera Management",
    description: "Approve pending camera feeds and manage active surveillance nodes.",
    href: "/dashboard/admin/cameras",
    icon: Camera,
    badge: "Governance",
    tone: "from-indigo-500 to-slate-700",
  },
  {
    title: "Field Operators",
    description: "Assign and supervise field installation and maintenance staff.",
    href: "/dashboard/admin/field-operators",
    icon: UserCog,
    badge: "Workforce",
    tone: "from-emerald-500 to-teal-700",
  },
  {
    title: "Operator Logs",
    description: "Inspect activity history and spot unusual access behavior.",
    href: "/dashboard/admin/operator-logs",
    icon: ClipboardList,
    badge: "Audit",
    tone: "from-amber-500 to-orange-700",
  },
];


export default function AdminDashboard() {
  const router = useRouter();
  const checkedRef = useRef(false);

  useEffect(() => {
    // ✅ ensure this effect runs only once
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
  }, [router]); // ✅ dependency array NEVER changes

  return (
    <div className="app-shell flex bg-[radial-gradient(circle_at_top_left,_#ecfeff,_#f8fafc_42%,_#f1f5f9_100%)]">
      <AdminSidebar />

      <div className="flex-1 min-w-0">
        <Navbar title="Admin Control Dashboard" />

        <main className="relative p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-r from-cyan-300/20 via-sky-300/10 to-transparent blur-3xl" />

          <section className="relative app-card overflow-hidden border-slate-900/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white p-6 sm:p-8">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-2xl" />
            <div className="absolute -left-16 -bottom-16 h-44 w-44 rounded-full bg-sky-300/15 blur-2xl" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.14em] text-cyan-100">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Security Command Center
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  Coordinate surveillance, response, and governance from one control plane.
                </h2>
                <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed">
                  Use the quick actions below to prioritize active incidents, validate camera activity, and keep your operator workflow accountable.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard/admin/live-monitoring" className="app-button border border-white/20 bg-white/15 hover:bg-white/20">
                  Open Live Feed
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/analytics" className="app-button-secondary border-white/20 bg-white/10 text-white hover:bg-white/15">
                  Review Analytics
                </Link>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((card) => (
              <article
                key={card.title}
                className={`app-card p-5 bg-gradient-to-br ${card.accent} transition-transform duration-200 hover:-translate-y-1`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                  {card.title}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
                <p className="mt-2 text-sm text-slate-600">{card.note}</p>
              </article>
            ))}
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
                Quick Action Modules
              </h3>
              <span className="app-badge">Admin Workspace</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="group app-card p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-3">
                        <span className="app-badge bg-slate-50">{action.badge}</span>
                        <h4 className="text-lg font-semibold text-slate-900">{action.title}</h4>
                      </div>
                      <div className={`rounded-xl bg-gradient-to-br ${action.tone} p-2.5 text-white shadow-sm`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      {action.description}
                    </p>

                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                      Open module
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
