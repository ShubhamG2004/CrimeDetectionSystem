"use client";

import React, { useState, useEffect } from 'react';

const metrics = [
  { label: "Active cameras", value: "48", tone: "text-slate-900" },
  { label: "Incidents today", value: "132", tone: "text-slate-900" },
  { label: "Avg. response", value: "2m 12s", tone: "text-slate-900" },
];

const alerts = [
  {
    level: "Critical",
    title: "Crowd escalation detected",
    detail: "Downtown transit hub, camera 12",
    containerClass: "border-rose-200 bg-rose-50",
    labelClass: "text-rose-700",
    titleClass: "text-slate-900",
    detailClass: "text-slate-600",
  },
  {
    level: "High",
    title: "Suspicious loitering pattern",
    detail: "West gate perimeter, camera 04",
    containerClass: "border-amber-200 bg-amber-50",
    labelClass: "text-amber-700",
    titleClass: "text-slate-900",
    detailClass: "text-slate-600",
  },
  {
    level: "Stable",
    title: "Sector coverage at target",
    detail: "North district command view",
    containerClass: "border-emerald-200 bg-emerald-50",
    labelClass: "text-emerald-700",
    titleClass: "text-slate-900",
    detailClass: "text-slate-600",
  },
];

// Animated Counter Component
const AnimatedCounter = ({ value, tone }) => {
  const [count, setCount] = useState(0);
  const numericValue = parseInt(value, 10);

  useEffect(() => {
    if (isNaN(numericValue)) return;
    let start = 0;
    const duration = 1500;
    const increment = numericValue / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= numericValue) {
        setCount(numericValue);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    
    return () => clearInterval(timer);
  }, [numericValue]);

  if (value.includes('m') || value.includes('s')) {
    return <p className={`mt-3 text-3xl font-semibold ${tone}`}>{value}</p>;
  }
  return <p className={`mt-3 text-3xl font-semibold ${tone}`}>{count}</p>;
};

// Live Pulse Animation Component
const LivePulse = () => {
  const [pulse, setPulse] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 800);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
      <span className={`relative flex h-2 w-2`}>
        <span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 ${pulse ? 'animate-ping' : ''}`}></span>
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]"></span>
      </span>
      System live
    </span>
  );
};

// Fade-in Animation on Scroll
const FadeInSection = ({ children }) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {children}
    </div>
  );
};

// Hover Glow Card
const GlowCard = ({ children, className }) => {
  return (
    <div className={`transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:-translate-y-1 ${className}`}>
      {children}
    </div>
  );
};

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white text-slate-900">
      {/* Animated Background Elements */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.08),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.08),_transparent_28%),linear-gradient(180deg,_#ffffff,_#f8fafc)]" />
      <div className="pointer-events-none absolute left-[-6rem] top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute right-[-4rem] top-40 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="pointer-events-none absolute bottom-20 left-1/2 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl animate-pulse" style={{ animationDuration: '5s' }} />

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 sm:px-8 lg:px-10">
        {/* Header with Sticky and Blur */}
        <header className="sticky top-6 z-50 flex items-center justify-between rounded-3xl border border-slate-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur-xl transition-all duration-300 hover:bg-white/95">
          <div className="flex items-center gap-3">
            <div className="group flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-400 shadow-[0_16px_45px_rgba(14,165,233,0.22)] transition-all duration-500 hover:scale-105 hover:shadow-xl">
              <span className="text-sm font-black tracking-[0.3em] text-white">CDS</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-sky-700">
                Command center
              </p>
              <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
                Crime Detection System
              </h1>
            </div>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <LivePulse />
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
            >
              Sign in
            </a>
          </div>
        </header>

        {/* Hero Section */}
        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:py-14">
          <div className="space-y-8">
            <FadeInSection>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm animate-in slide-in-from-left-5">
                <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                AI-assisted incident detection with real-time response
              </div>
            </FadeInSection>

            <FadeInSection>
              <div className="space-y-5">
                <h2 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-slate-900 sm:text-6xl lg:text-7xl">
                  Simple, modern monitoring for
                  <span className="block bg-gradient-to-r from-sky-600 via-cyan-600 to-emerald-600 bg-clip-text text-transparent animate-gradient-x bg-[length:200%_200%]">
                    real-time incident response.
                  </span>
                </h2>
                <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg animate-in slide-in-from-right-5">
                  A clean operations dashboard for live surveillance, AI analysis,
                  and incident escalation across every monitored zone.
                </p>
              </div>
            </FadeInSection>

            <FadeInSection>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="/login"
                  className="group inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(15,23,42,0.18)] transition-all duration-300 hover:bg-slate-800 hover:translate-y-[-2px] hover:shadow-xl"
                >
                  Enter console
                  <svg className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
                <a
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
                >
                  Open dashboard
                </a>
              </div>
            </FadeInSection>

            <FadeInSection>
              <div className="grid gap-4 sm:grid-cols-3">
                {metrics.map((item, idx) => (
                  <GlowCard key={item.label}>
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-slate-300">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                        {item.label}
                      </p>
                      <AnimatedCounter value={item.value} tone={item.tone} />
                    </div>
                  </GlowCard>
                ))}
              </div>
            </FadeInSection>
          </div>

          {/* Right Side Alert Panel with Animation */}
          <FadeInSection>
            <div className="relative">
              <div className="absolute -inset-4 rounded-[2rem] bg-sky-200/25 blur-2xl animate-pulse" />
              <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_30px_120px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition-all duration-500 hover:shadow-xl sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Threat overview
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                      Citywide pulse
                    </h3>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                    Updated 2m ago
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  <GlowCard>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 transition-all duration-300 hover:bg-rose-100">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Critical alerts</p>
                          <p className="mt-1 text-sm text-slate-600">
                            Escalated by pose and crowd signals
                          </p>
                        </div>
                        <span className="text-2xl font-semibold text-rose-600 animate-pulse">8</span>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-rose-100">
                        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 animate-shimmer" />
                      </div>
                    </div>
                  </GlowCard>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <GlowCard>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition-all duration-300 hover:bg-emerald-100">
                        <p className="text-sm font-medium text-emerald-700">Operator coverage</p>
                        <p className="mt-3 text-3xl font-semibold text-slate-900">92%</p>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-100">
                          <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 animate-slide-in" />
                        </div>
                      </div>
                    </GlowCard>

                    <GlowCard>
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 transition-all duration-300 hover:bg-sky-100">
                        <p className="text-sm font-medium text-sky-700">AI confidence</p>
                        <p className="mt-3 text-3xl font-semibold text-slate-900">High</p>
                        <p className="mt-4 text-sm leading-6 text-slate-600">
                          Stable pose analysis across multi-person scenes and mixed lighting.
                        </p>
                      </div>
                    </GlowCard>
                  </div>

                  <div className="grid gap-4">
                    {alerts.map((alert, idx) => (
                      <GlowCard key={alert.title}>
                        <div className={`rounded-2xl border p-4 transition-all duration-300 hover:shadow-md ${alert.containerClass}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className={`text-xs uppercase tracking-[0.24em] ${alert.labelClass}`}>
                                {alert.level}
                              </p>
                              <h4 className={`mt-2 text-base font-semibold ${alert.titleClass}`}>
                                {alert.title}
                              </h4>
                              <p className={`mt-1 text-sm ${alert.detailClass}`}>
                                {alert.detail}
                              </p>
                            </div>
                            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                              Live
                            </div>
                          </div>
                        </div>
                      </GlowCard>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </FadeInSection>
        </section>

        {/* Feature Section */}
        <FadeInSection>
          <section className="grid gap-4 pb-8 lg:grid-cols-3">
            {[
              {
                title: "Incident triage",
                text: "Group incoming alerts by severity and location for immediate response.",
                icon: "🚨",
              },
              {
                title: "Real-time intelligence",
                text: "Stream updates from the AI server into a single operational view.",
                icon: "🧠",
              },
              {
                title: "Operator workflow",
                text: "Keep dispatch, review, and escalation visible without switching context.",
                icon: "⚡",
              },
            ].map((item) => (
              <GlowCard key={item.title}>
                <div className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-slate-300 hover:shadow-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl transition-transform duration-300 group-hover:scale-110">{item.icon}</span>
                    <p className="text-lg font-semibold text-slate-900">{item.title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                </div>
              </GlowCard>
            ))}
          </section>
        </FadeInSection>
      </main>

      {/* Add custom keyframes for animations */}
      <style jsx>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(0%); }
        }
        @keyframes slide-in {
          0% { width: 0%; }
          100% { width: var(--width, 92%); }
        }
        .animate-gradient-x {
          animation: gradient-x 3s ease infinite;
        }
        .animate-shimmer {
          animation: shimmer 1s ease-out forwards;
        }
        .animate-slide-in {
          animation: slide-in 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
}