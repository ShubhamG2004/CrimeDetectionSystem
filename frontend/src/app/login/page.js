"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Shield, User, Lock, Mail } from "lucide-react";
import { ROLES, getDefaultRouteByRole } from "@/lib/roles";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginType, setLoginType] = useState(ROLES.ADMIN);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const roleOptions = [
    {
      key: ROLES.ADMIN,
      label: "Admin",
      description: "Governance and platform control",
      icon: Shield,
    },
    {
      key: ROLES.OPERATOR,
      label: "Operator",
      description: "Real-time monitoring and response",
      icon: User,
    },
    {
      key: ROLES.FIELD_OPERATOR,
      label: "Field Operator",
      description: "Camera deployment and maintenance",
      icon: User,
    },
  ];

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const user = userCred.user;
      const uid = user.uid;

      const tokenResult = await user.getIdTokenResult(true);
      const role = tokenResult.claims?.role;

      if (!role) {
        setError("User role not assigned. Contact admin.");
        await auth.signOut();
        return;
      }

      if (loginType !== role) {
        const roleLabel =
          role === ROLES.ADMIN
            ? "Admin"
            : role === ROLES.FIELD_OPERATOR
              ? "Field Operator"
              : "Operator";

        setError(`Please login as ${roleLabel}`);
        await auth.signOut();
        return;
      }

      let profileSnap;
      let profileReadBlocked = false;

      if (role === ROLES.OPERATOR) {
        profileSnap = await getDoc(doc(db, "operators", uid));
      } else if (role === ROLES.FIELD_OPERATOR) {
        let usedFallback = false;

        try {
          profileSnap = await getDoc(doc(db, "field_operator", uid));
        } catch (fieldOpErr) {
          // Backward-compatibility while some environments still enforce old users-based rules.
          if ((fieldOpErr?.code || "").includes("permission-denied")) {
            try {
              profileSnap = await getDoc(doc(db, "users", uid));
              usedFallback = true;
            } catch (usersErr) {
              if ((usersErr?.code || "").includes("permission-denied")) {
                profileReadBlocked = true;
              } else {
                throw usersErr;
              }
            }
          } else {
            throw fieldOpErr;
          }
        }

        if (!profileReadBlocked && !usedFallback && !profileSnap?.exists()) {
          // If account has not been migrated yet, check legacy users collection.
          profileSnap = await getDoc(doc(db, "users", uid));
        }
      } else {
        profileSnap = await getDoc(doc(db, "users", uid));
      }

      if (!profileReadBlocked && !profileSnap?.exists()) {
        setError(
          role === ROLES.OPERATOR
            ? "Operator profile not found"
            : role === ROLES.FIELD_OPERATOR
              ? "Field operator profile not found"
              : "Admin profile not found"
        );
        await auth.signOut();
        return;
      }

      localStorage.setItem("role", role);
      localStorage.setItem("uid", uid);
      document.cookie = `role=${role}; path=/; max-age=86400; SameSite=Lax`;

      router.replace(getDefaultRouteByRole(role));
    } catch (err) {
      console.error("LOGIN ERROR:", err);

      if (err?.code === "auth/invalid-credential") {
        setError("Invalid email or password");
      } else if (err?.code === "permission-denied") {
        setError("Profile access denied. Please contact admin to verify Firestore rules.");
      } else if (err?.code === "unavailable") {
        setError("Service temporarily unavailable. Please try again.");
      } else {
        setError(err?.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-28 -left-24 h-80 w-80 rounded-full bg-slate-300/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-cyan-200/25 blur-3xl" />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 lg:p-10 xl:p-12 shadow-[0_25px_60px_rgba(15,23,42,0.14)]">
              <div className="max-w-xl mx-auto">
                <div className="mb-8">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    <Shield className="h-3.5 w-3.5" />
                    Verified access only
                  </div>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                    Sign in to continue
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Select your access role and enter your assigned credentials.
                  </p>
                </div>

                <div className="mb-7 grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-2">
                  {roleOptions.map((option) => {
                    const Icon = option.icon;
                    const active = loginType === option.key;

                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setLoginType(option.key)}
                        className={`rounded-xl px-3 py-3 text-sm transition-all flex items-center justify-center gap-2 border ${
                          active
                            ? "bg-white border-slate-300 text-slate-900 shadow-sm"
                            : "bg-transparent border-transparent text-slate-600 hover:bg-white/70"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>

                {error && (
                  <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-800 focus:ring-2 focus:ring-slate-800/15"
                        placeholder="name@organization.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-800 focus:ring-2 focus:ring-slate-800/15"
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <svg className="mr-3 h-5 w-5 animate-spin text-white" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Signing in...
                      </div>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </form>

                <div className="mt-8 border-t border-slate-200 pt-5">
                  <p className="text-center text-sm text-slate-600">
                    Need account support?{" "}
                    <a href="#" className="font-medium text-slate-900 hover:text-black">
                      Contact system administrator
                    </a>
                  </p>
                </div>
              </div>
        </div>
      </div>
    </div>
  );
}
