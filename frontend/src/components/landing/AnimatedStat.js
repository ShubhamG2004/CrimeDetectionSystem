"use client";

import { useEffect, useState } from "react";

export default function AnimatedStat({ value, suffix, label }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let frameId;
    let startTime;
    const duration = 1400;

    const tick = (time) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      setCount(Math.floor(progress * value));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return (
    <div className="rounded-2xl border border-slate-900/10 bg-white/80 p-4 shadow-[0_8px_25px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <p className="text-3xl font-semibold text-slate-900 sm:text-4xl">
        {count}
        <span className="text-orange-600">{suffix}</span>
      </p>
      <p className="mt-2 text-sm text-slate-600">{label}</p>
    </div>
  );
}
