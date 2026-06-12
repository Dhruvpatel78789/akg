"use client";

import Link from "next/link";

export default function CompanyRegisterPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-12 flex items-center justify-center">
      <section className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl ring-1 ring-black/5 text-center">
        <div className="mb-6">
          <span className="text-xs font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full">
            Registration Info
          </span>
        </div>
        <h1 className="text-3xl font-black text-[var(--primary)] mb-4">Corporate Accounts</h1>
        <p className="text-sm font-bold text-[var(--text-muted)] leading-relaxed mb-6">
          Corporate memberships and accounts on Akshar Game Zone are managed directly by your company's HR or administrative department.
        </p>
        <div className="bg-indigo-50/50 p-6 rounded-2xl mb-8 text-left border border-indigo-50 text-sm font-medium text-[var(--text-muted)] space-y-2">
          <p className="font-bold text-[var(--primary)] text-center mb-1">To get access:</p>
          <p>1. Contact your HR or Akshar Game Zone coordinator inside your company.</p>
          <p>2. Ask them to add your details to the employee roster list.</p>
          <p>3. Once added, you can log in immediately using your email, mobile, or Employee ID with your default password.</p>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href="/company/login"
            className="h-14 rounded-full bg-[var(--primary)] font-black text-white hover:opacity-95 flex items-center justify-center shadow-lg shadow-[var(--primary)]/20"
          >
            Back to Corporate Login
          </Link>
          <Link
            href="/"
            className="text-xs font-black text-[var(--primary)] hover:underline"
          >
            Go to Homepage
          </Link>
        </div>
      </section>
    </main>
  );
}
