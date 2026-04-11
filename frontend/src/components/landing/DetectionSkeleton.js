"use client";

export default function DetectionSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <div className="h-3 w-2/5 animate-pulse rounded bg-white/10" />
      <div className="h-2.5 w-full animate-pulse rounded bg-white/5" />
      <div className="h-2.5 w-4/5 animate-pulse rounded bg-white/5" />
    </div>
  );
}
