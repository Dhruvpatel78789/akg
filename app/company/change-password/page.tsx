"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CompanyChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/company/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPassword }),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      setLoading(false);

      if (!response.ok) {
        setError(data?.message || "Failed to change password");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.replace("/company/dashboard");
      }, 2000);
    } catch (err) {
      setLoading(false);
      setError("Failed to change password. Please try again.");
      console.error(err);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-12 flex items-center justify-center">
      <section className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl ring-1 ring-black/5">
        <div className="text-center mb-8">
          <span className="text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 px-3 py-1.5 rounded-full">
            Action Required
          </span>
          <h1 className="text-3xl font-black text-[var(--primary)] mt-3">Reset Password</h1>
          <p className="text-sm font-bold text-[var(--text-muted)] mt-1">
            You are logging in for the first time. Please set a new secure password.
          </p>
        </div>

        {success ? (
          <div className="bg-emerald-50 text-emerald-800 p-6 rounded-2xl text-center font-bold">
            <p className="text-lg">✓ Password changed!</p>
            <p className="text-sm font-normal mt-1">Redirecting you to dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-1">
              <label className="text-xs font-bold text-[var(--text-muted)] px-1">
                New Password (minimum 8 characters)
              </label>
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                className="h-14 rounded-full bg-[var(--background)] px-5 font-bold outline-none ring-1 ring-black/5 focus:ring-[var(--primary)] transition-all"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-bold text-[var(--text-muted)] px-1">
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                className="h-14 rounded-full bg-[var(--background)] px-5 font-bold outline-none ring-1 ring-black/5 focus:ring-[var(--primary)] transition-all"
              />
            </div>

            {error && <p className="text-sm font-bold text-red-500 text-center mt-2">{error}</p>}

            <button
              disabled={loading}
              className="h-14 rounded-full bg-[var(--primary)] font-black text-white hover:opacity-95 disabled:opacity-60 transition-opacity mt-4 flex items-center justify-center gap-2 shadow-lg shadow-[var(--primary)]/20"
            >
              {loading ? "Saving password..." : "Update Password"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
