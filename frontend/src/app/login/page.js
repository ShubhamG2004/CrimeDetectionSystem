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
  const [loginType, setLoginType] = useState("admin"); // admin | operator
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 🔐 1️⃣ Firebase Authentication
      const userCred = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const uid = userCred.user.uid;

      // 🧭 2️⃣ Decide collection based on login type
      const collectionName =
        loginType === "operator" ? "operators" : "users";

      const userRef = doc(db, collectionName, uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError(
          loginType === "operator"
            ? "No operator account found"
            : "No admin account found"
        );
        await auth.signOut();
        setLoading(false);
        return;
      }

      const data = userSnap.data();

      // 💾 3️⃣ Store role + uid
      localStorage.setItem("role", data.role || loginType);
      localStorage.setItem("uid", uid);

      // 🚀 4️⃣ Redirect
      if (loginType === "admin") {
        router.push("/dashboard/admin");
      } else {
        router.push("/dashboard/operator");
      }

    } catch (err) {
      console.error(err);
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
          <p className="text-red-500 text-sm mb-3">
            {error}
          </p>
        )}

        {/* LOGIN TYPE */}
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
