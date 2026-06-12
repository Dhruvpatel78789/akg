"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CompanyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user && data.user.role === "COMPANY_EMPLOYEE") {
          router.replace("/company/dashboard");
        } else {
          router.replace("/company/login");
        }
      })
      .catch(() => {
        router.replace("/company/login");
      });
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <p className="font-black text-[var(--primary)] text-lg animate-pulse">Redirecting...</p>
    </main>
  );
}
