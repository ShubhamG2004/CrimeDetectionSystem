"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getDefaultRouteByRole } from "@/lib/roles";

export default function DashboardRouter() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const role = localStorage.getItem("role");
      router.replace(getDefaultRouteByRole(role));
    });

    return () => unsub();
  }, [router]);

  return (
    <div className="app-shell flex items-center justify-center">
      <p className="text-slate-600">Redirecting...</p>
    </div>
  );
}
