"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Suspense } from "react";

function CompanyLoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    identifier: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/company/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      setLoading(false);

      if (!response.ok) {
        setError(data?.message || "Login failed");
        return;
      }

      if (data?.user?.mustChangePassword) {
        router.push("/company/change-password");
      } else {
        router.push("/company/dashboard");
      }
    } catch (err) {
      setLoading(false);
      setError("Login request failed. Check server logs.");
      console.error(err);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-12 flex items-center justify-center">
      <section className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl ring-1 ring-black/5">
        <div className="text-center mb-8">
          <span className="text-xs font-black uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] px-3 py-1.5 rounded-full">
            Corporate Partner
          </span>
          <h1 className="text-4xl font-black text-[var(--primary)] mt-3">Akshar Game Zone Corporate</h1>
          <p className="text-sm font-bold text-[var(--text-muted)] mt-1">
            Sign in with your Employee ID, Mobile, or Email
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1">
            <label className="text-xs font-bold text-[var(--text-muted)] px-1">
              Employee ID, Mobile or Email
            </label>
            <input
              type="text"
              placeholder="e.g. EMP1234 or ramesh@company.com"
              value={form.identifier}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, identifier: event.target.value }))
              }
              required
              className="h-14 rounded-full bg-[var(--background)] px-5 font-bold outline-none ring-1 ring-black/5 focus:ring-[var(--primary)] transition-all"
            />
          </div>

          <div className="grid gap-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-bold text-[var(--text-muted)]">
                Password
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                required
                className="h-14 w-full rounded-full bg-[var(--background)] pl-5 pr-32 font-bold outline-none ring-1 ring-black/5 focus:ring-[var(--primary)] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-4 text-xs font-black text-[var(--primary)] flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <span>{showPassword ? "👁 Hide" : "👁 Show"}</span>
              </button>
            </div>
          </div>

          {error && <p className="text-sm font-bold text-red-500 text-center mt-2">{error}</p>}

          <button
            disabled={loading}
            className="h-14 rounded-full bg-[var(--primary)] font-black text-white hover:opacity-95 disabled:opacity-60 transition-opacity mt-4 flex items-center justify-center gap-2 shadow-lg shadow-[var(--primary)]/20"
          >
            {loading ? "Logging in..." : "Corporate Login"}
          </button>
        </form>

        <div className="mt-8 text-center border-t pt-6 border-gray-100">
          <p className="text-sm font-bold text-[var(--text-muted)]">
            New employee?{" "}
            <Link href="/company/register" className="text-[var(--primary)] underline decoration-2">
              Register
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default function CompanyLoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[var(--background)] px-4 py-12 flex items-center justify-center">
        <section className="w-full max-w-md text-center">
          <p className="font-black text-[var(--primary)]">Loading login page...</p>
        </section>
      </main>
    }>
      <CompanyLoginForm />
    </Suspense>
  );
}
