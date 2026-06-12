"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirect =
    searchParams.get("redirect") || "/player/dashboard";

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    dob: "",
    password: "",
    confirmPassword: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function validateClient() {
    const errors: Record<string, string> = {};

    if (form.name.trim().length < 3) {
      errors.name = "Name must be at least 3 characters";
    }

    if (form.name.trim().length > 50) {
      errors.name = "Name cannot be more than 50 characters";
    }

    // Phone: Numeric only, exactly 10 digits
    if (!/^\d{10}$/.test(form.phone.trim())) {
      errors.phone = "Phone number must be exactly 10 digits, numeric only";
    }

    // Email: Contains @, contains ., valid domain format, no spaces
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.email.includes(" ")) {
      errors.email = "Enter a valid email address without spaces (e.g. user@domain.com)";
    }

    if (form.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setError("");
    setFieldErrors({});

    if (!validateClient()) return;

    setLoading(true);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const data = await response.json();

    setLoading(false);

    if (!response.ok) {
      const errors: Record<string, string> = {};

      Object.entries(data.errors || {}).forEach(([key, value]) => {
        if (Array.isArray(value) && value[0]) {
          errors[key] = String(value[0]);
        }
      });

      setFieldErrors(errors);
      setError(data.message || "Registration failed");
      return;
    }

    setShowSuccessAnimation(true);

    setTimeout(() => {
      router.push(redirect);
    }, 1200);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6">
      <section className="mx-auto max-w-md">
        <h1 className="text-6xl font-black text-[var(--primary)]">
          Register
        </h1>

        <form onSubmit={handleSubmit} className="mt-12 grid gap-5">
          <FieldError message={fieldErrors.name}>
            <input
              type="text"
              placeholder="Name"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              className={`h-16 w-full rounded-full bg-white px-6 text-lg font-bold outline-none ring-1 ${
                fieldErrors.name ? "ring-red-400" : "ring-black/5"
              }`}
            />
          </FieldError>

          <FieldError message={fieldErrors.phone}>
            <input
              type="tel"
              placeholder="Phone"
              value={form.phone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phone: event.target.value }))
              }
              className={`h-16 w-full rounded-full bg-white px-6 text-lg font-bold outline-none ring-1 ${
                fieldErrors.phone ? "ring-red-400" : "ring-black/5"
              }`}
            />
          </FieldError>

          <FieldError message={fieldErrors.email}>
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              className={`h-16 w-full rounded-full bg-white px-6 text-lg font-bold outline-none ring-1 ${
                fieldErrors.email ? "ring-red-400" : "ring-black/5"
              }`}
            />
          </FieldError>

          <FieldError message={fieldErrors.dob}>
            <div className="relative grid gap-1.5">
              <span className="text-xs font-black uppercase text-[var(--text-muted)] ml-3">Date of Birth (Optional)</span>
              <input
                type="date"
                value={form.dob}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, dob: event.target.value }))
                }
                className={`h-16 w-full rounded-full bg-white px-6 text-lg font-bold outline-none ring-1 ${
                  fieldErrors.dob ? "ring-red-400" : "ring-black/5"
                }`}
              />
              <p className="text-xs font-bold text-teal-600 animate-pulse ml-3">
                🎁 Add your birth date to receive birthday offers, exclusive discounts and special rewards.
              </p>
            </div>
          </FieldError>

          <FieldError message={fieldErrors.password}>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                className={`h-16 w-full rounded-full bg-white px-6 pr-36 text-lg font-bold outline-none ring-1 ${
                  fieldErrors.password ? "ring-red-400" : "ring-black/5"
                }`}
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-[var(--primary)] flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <span>{showPassword ? "👁 Hide" : "👁 Show Password"}</span>
              </button>
            </div>
          </FieldError>

          <FieldError message={fieldErrors.confirmPassword}>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    confirmPassword: event.target.value,
                  }))
                }
                className={`h-16 w-full rounded-full bg-white px-6 pr-36 text-lg font-bold outline-none ring-1 ${
                  fieldErrors.confirmPassword
                    ? "ring-red-400"
                    : "ring-black/5"
                }`}
              />

              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-[var(--primary)] flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <span>{showConfirmPassword ? "👁 Hide" : "👁 Show Password"}</span>
              </button>
            </div>
          </FieldError>

          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-500">
              {error}
            </p>
          )}

          <button
            disabled={loading || showSuccessAnimation}
            className="mt-2 flex h-16 items-center justify-center gap-2 rounded-full bg-[var(--primary)] text-lg font-black text-white disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={22} />
                Checking...
              </>
            ) : showSuccessAnimation ? (
              <>
                <UserPlus className="animate-bounce" size={24} />
                Creating Account...
              </>
            ) : (
              "Next"
            )}
          </button>
        </form>

        <p className="mt-7 text-base font-bold text-[var(--text-muted)]">
          Already have an account?{" "}
          <Link
            href={`/auth/login?redirect=${encodeURIComponent(redirect)}`}
            className="font-black text-[var(--primary)]"
          >
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[var(--background)] px-4 py-6">
        <section className="mx-auto max-w-md">
          <p className="font-black text-[var(--primary)]">Loading registration page...</p>
        </section>
      </main>
    }>
      <RegisterForm />
    </Suspense>
  );
}

function FieldError({
  children,
  message,
}: {
  children: React.ReactNode;
  message?: string;
}) {
  return (
    <div>
      {children}
      {message && (
        <p className="mt-2 px-4 text-xs font-black text-red-500">
          {message}
        </p>
      )}
    </div>
  );
}