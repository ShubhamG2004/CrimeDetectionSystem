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
    accent: "from-white via-zinc-50 to-neutral-100 border border-black/5",
  },
  {
    title: "Monitoring Coverage",
    value: "Citywide",
    note: "Live watch across camera zones",
    accent: "from-white via-zinc-100 to-neutral-50 border border-black/5",
  },
  {
    title: "Response Readiness",
    value: "High",
    note: "Rapid dispatch pipeline active",
    accent: "from-white via-zinc-50 to-neutral-200 border border-black/5",
  },
  {
    title: "Audit Logging",
    value: "Enabled",
    note: "Operator actions are tracked",
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
    <div className="app-shell flex min-h-screen bg-gradient-to-br from-white via-zinc-50 to-white text-slate-900">
      <AdminSidebar />

      <div className="flex-1 min-w-0">
        <Navbar title="Admin Control Dashboard" />

        <main className="relative p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-r from-black/5 via-neutral-200/20 to-transparent blur-3xl" />

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
              <span className="app-badge bg-black text-white">Admin Workspace</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="group app-card border border-black/5 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-3">
                        <span className="app-badge bg-black text-white">{action.badge}</span>
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
