"use client";

export const dynamic = "force-dynamic";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function MembershipPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const planId = params.id as string;
  const durationIndex = Number(searchParams.get("durationIndex") || 0);
  const startTime = searchParams.get("startTime") || "";
  const endTime = searchParams.get("endTime") || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function makePayment() {
  setLoading(true);
  setError("");

  try {
    const response = await fetch("/api/player/membership/purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        planId,
        durationIndex,
        startTime,
        endTime,
      }),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    setLoading(false);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        router.replace("/auth/login");
        return;
      }
      setError(data?.message || "Payment failed");
      return;
    }

    router.replace("/player/dashboard");
  } catch (error) {
    console.error(error);
    setLoading(false);
    setError("Payment request failed. Check terminal for API error.");
  }
}
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6">
      <section className="mx-auto max-w-md">
        <h1 className="text-4xl font-black text-[var(--primary)]">
          Payment
        </h1>

        <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <p className="text-sm font-bold text-[var(--text-muted)]">
            Testing payment mode. Razorpay will be added later.
          </p>

          {error && (
            <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-black text-red-500">
              {error}
            </p>
          )}

          <button
            onClick={makePayment}
            disabled={loading}
            className="mt-6 h-16 w-full rounded-full bg-[var(--primary)] text-lg font-black text-white disabled:opacity-60"
          >
            {loading ? "Processing..." : "Make Payment"}
          </button>
        </section>
      </section>
    </main>
  );
}