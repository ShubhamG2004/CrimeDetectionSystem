"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import AnimatedStat from "@/components/landing/AnimatedStat";
import DetectionSkeleton from "@/components/landing/DetectionSkeleton";
import SectionHeader from "@/components/landing/SectionHeader";
import {
  ArrowRight,
  BellRing,
  BrainCircuit,
  Camera,
  CheckCircle2,
  Code2,
  Cloud,
  Github,
  Linkedin,
  Radar,
  ShieldAlert,
  Siren,
  Workflow,
} from "lucide-react";

const featureItems = [
  {
    icon: Radar,
    title: "Real-Time Detection",
    description:
      "Continuous frame analysis identifies suspicious behavior in milliseconds.",
  },
  {
    icon: ShieldAlert,
    title: "Weapon Detection",
    description:
      "AI models detect weapons and high-risk objects with high confidence scoring.",
  },
  {
    icon: Camera,
    title: "Live Camera Monitoring",
    description:
      "Monitor ESP32 and CCTV feeds from one responsive command center.",
  },
  {
    icon: BellRing,
    title: "Smart Alerts",
    description:
      "Prioritized real-time notifications routed to the right team instantly.",
  },
  {
    icon: Cloud,
    title: "Cloud Storage",
    description:
      "Secure cloud logs, incidents, and media snapshots for fast post-event review.",
  },
  {
    icon: BrainCircuit,
    title: "Context-Aware AI",
    description:
      "Reasoning layer reduces false positives using scene and motion context.",
  },
];

const workflowSteps = [
  {
    id: "01",
    title: "Capture Video",
    description: "Live feeds stream from surveillance cameras to the processing layer.",
    icon: Camera,
  },
  {
    id: "02",
    title: "AI Detection",
    description: "Pose and object models detect threat signals and suspicious activity.",
    icon: ShieldAlert,
  },
  {
    id: "03",
    title: "Context Analysis",
    description: "Reasoning engine evaluates interactions, zones, and incident severity.",
    icon: Workflow,
  },
  {
    id: "04",
    title: "Alert Generation",
    description: "The system dispatches real-time alerts and updates dashboards instantly.",
    icon: Siren,
  },
];

const stackItems = ["Next.js", "Node.js", "Firebase", "OpenCV", "YOLOv8", "Socket.IO"];

const stats = [
  { label: "Detection Accuracy", value: 99, suffix: "%" },
  { label: "Live Cameras", value: 120, suffix: "+" },
  { label: "Alert Latency", value: 2, suffix: "s" },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

export default function HomePage() {
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f6f4] text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(249,115,22,0.2),transparent_38%),radial-gradient(circle_at_82%_18%,rgba(15,23,42,0.08),transparent_30%),linear-gradient(180deg,#f7f7f5,#ecece7)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.25] [background-image:linear-gradient(rgba(2,6,23,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(2,6,23,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />

      <motion.div
        aria-hidden
        animate={{ y: [0, 24, 0], x: [0, -16, 0] }}
        transition={{ duration: 12, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        className="pointer-events-none absolute -left-24 top-28 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl"
      />
      <motion.div
        aria-hidden
        animate={{ y: [0, -30, 0], x: [0, 18, 0] }}
        transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        className="pointer-events-none absolute -right-16 top-40 h-80 w-80 rounded-full bg-slate-900/10 blur-3xl"
      />

      <main className="relative mx-auto w-full max-w-7xl px-6 pb-14 pt-6 sm:px-10 lg:px-12">
        <header className="sticky top-5 z-50 rounded-2xl border border-slate-900/10 bg-white/80 px-5 py-4 shadow-[0_16px_55px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 font-semibold text-white shadow-[0_0_30px_rgba(249,115,22,0.35)]">
                CDS
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-orange-600">Smart Surveillance</p>
                <p className="text-sm font-medium text-slate-900 sm:text-base">Crime Detection System</p>
              </div>
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              <span className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                LIVE MONITORING
              </span>
              <Link
                href="/login"
                className="rounded-full border border-slate-900/20 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-orange-500/40 hover:bg-orange-50"
              >
                Sign In
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-10 pb-16 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.7 }}
            className="space-y-7"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
              AI Security Platform
            </span>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              AI-Powered Real-Time Crime Detection System
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Detect threats from live surveillance, reason over context, and trigger immediate alerts through a unified cloud-based monitoring platform.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_35px_rgba(234,88,12,0.35)] transition hover:translate-y-[-2px] hover:shadow-[0_20px_45px_rgba(234,88,12,0.35)]"
              >
                View Live Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-slate-900/20 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:border-orange-500/40 hover:bg-orange-50"
              >
                Get Started
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
              {stats.map((item) => (
                <AnimatedStat key={item.label} value={item.value} suffix={item.suffix} label={item.label} />
              ))}
            </div>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-r from-orange-500/20 to-slate-900/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white/80 p-5 shadow-[0_28px_70px_rgba(15,23,42,0.2)] backdrop-blur-2xl sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Command Feed</p>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Operational
                </span>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-slate-900/10 bg-gradient-to-b from-slate-900 to-slate-800 p-4">
                <div className="h-56 rounded-xl bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.35),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(244,63,94,0.2),transparent_30%),linear-gradient(160deg,#111827,#1f2937)]" />
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY }}
                  className="absolute left-[16%] top-[28%] h-24 w-20 rounded-md border-2 border-red-400/90"
                >
                  <span className="absolute -top-6 left-0 rounded bg-red-500 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
                    WEAPON 98%
                  </span>
                </motion.div>
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2.8, repeat: Number.POSITIVE_INFINITY }}
                  className="absolute right-[18%] top-[34%] h-28 w-24 rounded-md border-2 border-amber-300/90"
                >
                  <span className="absolute -top-6 left-0 rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
                    LOITERING
                  </span>
                </motion.div>
                <span className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  Live
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                <DetectionSkeleton />
                <DetectionSkeleton />
              </div>
            </div>
          </motion.div>
        </section>

        <section className="pb-16">
          <SectionHeader
            eyebrow="Core Capabilities"
            title="Built For Modern, Intelligent Surveillance"
            description="A complete AI security workflow covering detection, monitoring, reasoning, and incident response at scale."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  key={item.title}
                  variants={fadeInUp}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  className="group rounded-2xl border border-slate-900/10 bg-white/70 p-6 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-orange-500/40 hover:shadow-[0_20px_40px_rgba(234,88,12,0.18)]"
                >
                  <div className="mb-4 inline-flex rounded-xl border border-orange-500/25 bg-orange-50 p-3 text-orange-600 transition group-hover:border-orange-500/50 group-hover:bg-orange-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
                </motion.article>
              );
            })}
          </div>
        </section>

        <section className="pb-16">
          <SectionHeader
            eyebrow="How It Works"
            title="End-To-End Threat Intelligence Pipeline"
            description="From camera ingestion to actionable alerts, every step is optimized for speed and reliability."
          />
          <div className="relative mt-10">
            <div className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-orange-500/50 to-transparent md:block lg:hidden" />
            <div className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-orange-500/50 via-slate-900/20 to-transparent lg:block" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {workflowSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.id}
                    variants={fadeInUp}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.45, delay: index * 0.1 }}
                    className="relative rounded-2xl border border-slate-900/10 bg-white/70 p-5 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl"
                  >
                    <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-orange-600">STEP {step.id}</p>
                    <div className="mb-4 inline-flex rounded-lg border border-orange-500/25 bg-orange-50 p-2 text-orange-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="pb-16">
          <SectionHeader
            eyebrow="Live Preview"
            title="Monitoring Interface Snapshot"
            description="A premium command-view simulation with live status indicators and AI overlays."
          />
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6 }}
            className="mt-10 overflow-hidden rounded-3xl border border-slate-900/10 bg-white/80 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-2xl sm:p-6"
          >
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="relative overflow-hidden rounded-2xl border border-slate-900/15 bg-slate-900/80 p-3">
                <div className="h-72 rounded-xl bg-[linear-gradient(135deg,#0f172a_0%,#0b1120_50%,#111827_100%)] sm:h-80" />
                <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-red-500/35 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  Live Feed
                </span>
                <div className="absolute inset-0">
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2.5 }}
                    className="absolute left-[14%] top-[30%] h-24 w-20 rounded-md border-2 border-red-400"
                  />
                  <motion.div
                    animate={{ opacity: [0.35, 1, 0.35] }}
                    transition={{ repeat: Number.POSITIVE_INFINITY, duration: 3 }}
                    className="absolute right-[20%] top-[38%] h-24 w-20 rounded-md border-2 border-orange-300"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-900/10 bg-white/80 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">Recent Detections</h3>
                <div className="mt-4 space-y-3">
                  {[
                    "Weapon detected - Sector B02",
                    "Suspicious gathering - Metro Gate 3",
                    "Restricted entry - Parking Zone",
                  ].map((item) => (
                    <div key={item} className="rounded-xl border border-slate-900/10 bg-white p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Verified by AI
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="pb-16">
          <SectionHeader
            eyebrow="Technology"
            title="Engineered With Reliable Modern Stack"
            description="Production-grade technologies power real-time processing, streaming, and cloud intelligence."
          />
          <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stackItems.map((item, index) => (
              <motion.div
                key={item}
                variants={fadeInUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="flex items-center justify-center rounded-xl border border-slate-900/10 bg-white px-3 py-4 text-sm font-semibold text-slate-800 backdrop-blur-xl transition hover:border-orange-500/40 hover:text-orange-700"
              >
                {item === "Node.js" ? <Code2 className="mr-2 h-4 w-4" /> : null}
                {item}
              </motion.div>
            ))}
          </div>
        </section>

        <section className="pb-16">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl border border-slate-900/10 bg-gradient-to-r from-orange-100 via-white to-slate-100 p-8 shadow-[0_20px_55px_rgba(15,23,42,0.15)] backdrop-blur-xl"
          >
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-orange-400/20 blur-3xl" />
            <h3 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Secure Your Environment with AI</h3>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Deploy proactive monitoring with intelligent detection, instant alerts, and real-time situational awareness.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Start Monitoring
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </section>

        <footer className="border-t border-slate-900/10 py-8">
          <div className="flex flex-col gap-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-900">Crime Detection System</p>
              <p className="mt-1">Designed and developed by Shubham Gavade</p>
              <p className="mt-1 text-xs text-slate-500">{year} All rights reserved.</p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-900/15 bg-white px-3 py-2 text-slate-700 transition hover:border-orange-500/40 hover:text-orange-700"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-900/15 bg-white px-3 py-2 text-slate-700 transition hover:border-orange-500/40 hover:text-orange-700"
              >
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}