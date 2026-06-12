"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

type FieldErrors = {
  name?: string[];
  phone?: string[];
  email?: string[];
  password?: string[];
  confirmPassword?: string[];
};

export default function BuyPlanRegisterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [checkingUser, setCheckingUser] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    async function checkUser() {
      const response = await fetch("/api/auth/me");
      const data = await response.json();

      if (data.user) {
        router.push(`/player/membership/plan/${id}/configure`);
        return;
      }

      setCheckingUser(false);
    }

    checkUser();
  }, [id, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setFieldErrors({});
    setGeneralError("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const data = await response.json();

    if (!response.ok) {
      setGeneralError(data.message || "Account creation failed");
      setFieldErrors(data.errors || {});
      return;
    }

    router.push(`/player/membership/plan/${id}/configure`);
  }

  function inputClass(error?: string[]) {
    return `h-14 rounded-full bg-white px-5 font-bold outline-none ring-1 ${
      error ? "ring-red-500" : "ring-black/5"
    }`;
  }

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-4">
        <p className="font-black text-[var(--primary)]">
          Checking account...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-4">
      <section className="mx-auto w-full max-w-md">
        <header>
          <Link
            href={`/player/membership/plan/${id}`}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
          >
            <ArrowLeft size={28} className="text-[var(--primary)]" />
          </Link>
        </header>

        <section className="mt-7">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
            Step 1
          </p>

          <h1 className="mt-2 text-4xl font-black text-[var(--primary)]">
            Account Details
          </h1>

          <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
            Create your account to continue buying this plan.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
          <div>
            <input
              placeholder="Name"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              className={inputClass(fieldErrors.name)}
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs font-bold text-red-500">
                {fieldErrors.name[0]}
              </p>
            )}
          </div>

          <div>
            <input
              placeholder="Mobile Number"
              value={form.phone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phone: event.target.value }))
              }
              className={inputClass(fieldErrors.phone)}
            />
            {fieldErrors.phone && (
              <p className="mt-1 text-xs font-bold text-red-500">
                {fieldErrors.phone[0]}
              </p>
            )}
          </div>

          <div>
            <input
              placeholder="Email ID"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              className={inputClass(fieldErrors.email)}
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs font-bold text-red-500">
                {fieldErrors.email[0]}
              </p>
            )}
          </div>

          <div>
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
                className={`${inputClass(fieldErrors.password)} w-full pr-14`}
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                {showPassword ? (
                  <EyeOff size={22} className="text-[var(--primary)]" />
                ) : (
                  <Eye size={22} className="text-[var(--primary)]" />
                )}
              </button>
            </div>

            {fieldErrors.password && (
              <p className="mt-1 text-xs font-bold text-red-500">
                {fieldErrors.password[0]}
              </p>
            )}
          </div>

          <div>
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
                className={`${inputClass(fieldErrors.confirmPassword)} w-full pr-14`}
              />

              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                {showConfirmPassword ? (
                  <EyeOff size={22} className="text-[var(--primary)]" />
                ) : (
                  <Eye size={22} className="text-[var(--primary)]" />
                )}
              </button>
            </div>

            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-xs font-bold text-red-500">
                {fieldErrors.confirmPassword[0]}
              </p>
            )}
          </div>

          <section className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-black text-[var(--primary)]">
              Verification
            </p>

            <div className="mt-3 grid gap-2 text-xs font-bold text-[var(--text-muted)]">
              <p>Email verification: mocked as verified for now.</p>
              <p>Phone verification: mocked as verified for now.</p>
            </div>
          </section>

          {generalError && (
            <p className="text-sm font-bold text-red-500">{generalError}</p>
          )}

          <button className="h-14 rounded-full bg-[var(--primary)] text-sm font-black text-white">
            Next
          </button>
        </form>
      </section>
    </main>
  );
}