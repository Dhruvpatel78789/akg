"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirect = searchParams.get("redirect");
  const isPurchaseFlow =
    redirect?.startsWith("/player/membership/payment/") ||
    redirect?.startsWith("/player/membership/configure/");

  const [form, setForm] = useState({
    identifier: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
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

      if (redirect) {
        router.replace(redirect);
        return;
      }

      if (data?.user?.mustChangePassword) {
        router.replace("/player/profile?changePasswordRequired=true");
        return;
      }

      if (data?.user?.role === "ADMIN" || data?.user?.hasRoleProfile) {
        router.replace("/admin/dashboard");
      } else {
        router.replace("/player/dashboard");
      }
    } catch (err) {
      setLoading(false);
      setError("Login request failed. Check terminal for API error.");
      console.error(err);
    }
  }

  const registerHref =
    isPurchaseFlow && redirect
      ? `/auth/register?redirect=${encodeURIComponent(redirect)}`
      : "/auth/register";

  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6">
      <section className="mx-auto max-w-md">
        <h1 className="text-4xl font-black text-[var(--primary)]">Login</h1>

        {isPurchaseFlow && (
          <p className="mt-3 rounded-2xl bg-white p-4 text-sm font-bold text-[var(--primary)] ring-1 ring-black/5">
            Login to continue your plan purchase.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
          <input
            type="text"
            placeholder="Mobile Number or Email"
            value={form.identifier}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, identifier: event.target.value }))
            }
            className="h-14 rounded-full bg-white px-5 font-bold outline-none ring-1 ring-black/5"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              className="h-14 w-full rounded-full bg-white pl-5 pr-32 font-bold outline-none ring-1 ring-black/5"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-4 top-4 text-xs font-black text-[var(--primary)] flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <span>{showPassword ? "👁 Hide" : "👁 Show Password"}</span>
            </button>
          </div>

          {error && <p className="text-sm font-bold text-red-500">{error}</p>}

          <button
            disabled={loading}
            className="h-14 rounded-full bg-[var(--primary)] font-black text-white disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-5 text-sm font-bold text-[var(--text-muted)]">
          No account?{" "}
          <Link href={registerHref} className="text-[var(--primary)]">
            Register
          </Link>
        </p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[var(--background)] px-4 py-6">
        <section className="mx-auto max-w-md">
          <p className="font-black text-[var(--primary)]">Loading login page...</p>
        </section>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}