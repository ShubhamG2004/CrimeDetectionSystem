"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginType, setLoginType] = useState("admin"); // UI validation only
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      /* ===============================
         1️⃣ FIREBASE AUTH LOGIN
         =============================== */
      const userCred = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCred.user;
      const uid = user.uid;

      /* ===============================
         2️⃣ FORCE TOKEN REFRESH (CRITICAL)
         =============================== */
      const tokenResult = await user.getIdTokenResult(true);
      const role = tokenResult.claims?.role;

      if (!role) {
        setError("User role not assigned. Contact admin.");
        await auth.signOut();
        return;
      }

      /* ===============================
         3️⃣ UI ROLE VALIDATION (SAFE)
         =============================== */
      if (loginType !== role) {
        setError(
          role === "admin"
            ? "Please login as Admin"
            : "Please login as Operator"
        );
        await auth.signOut();
        return;
      }

      /* ===============================
         4️⃣ VERIFY PROFILE EXISTS
         =============================== */
      const collectionName =
        role === "operator" ? "operators" : "users";

      const profileSnap = await getDoc(
        doc(db, collectionName, uid)
      );

      if (!profileSnap.exists()) {
        setError(
          role === "operator"
            ? "Operator profile not found"
            : "Admin profile not found"
        );
        await auth.signOut();
        return;
      }

      /* ===============================
         5️⃣ STORE SESSION (UI ONLY)
         =============================== */
      localStorage.setItem("role", role);
      localStorage.setItem("uid", uid);

      /* ===============================
         6️⃣ REDIRECT (CLAIM-BASED)
         =============================== */
      if (role === "admin") {
        router.replace("/dashboard/admin");
      } else {
        router.replace("/dashboard/operator");
      }
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded-lg shadow-md w-80"
      >
        <h2 className="text-xl font-bold mb-4 text-center">
          🔐 Login
        </h2>

        {error && (
          <p className="text-red-500 text-sm mb-3 text-center">
            {error}
          </p>
        )}

        {/* UI ROLE SELECT (VALIDATION ONLY) */}
        <label className="text-sm font-semibold text-gray-700 mb-1 block">
          Login As
        </label>
        <select
          value={loginType}
          onChange={(e) => setLoginType(e.target.value)}
          className="w-full p-2 border rounded mb-3 text-gray-800"
        >
          <option value="admin">Admin</option>
          <option value="operator">Operator</option>
        </select>

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 border rounded mb-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 border rounded mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
