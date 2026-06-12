"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { LogIn, Building2, User, CheckCircle2, AlertCircle, Loader2, ArrowRight, Check } from "lucide-react";

export default function GameExitPage() {
  const router = useRouter();
  const params = useParams();
  const secureToken = (params?.secureToken as string) || "";

  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Check auth user
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
        setLoadingUser(false);
      })
      .catch(() => {
        setLoadingUser(false);
      });
  }, []);

  // Fetch active sessions if token and user exist
  useEffect(() => {
    if (loadingUser || !user || !secureToken) return;

    setLoadingSessions(true);
    setError("");

    fetch(`/api/player/qr-exit?token=${encodeURIComponent(secureToken)}`)
      .then(async (res) => {
        const data = await res.json();
        setLoadingSessions(false);
        if (res.ok && data.success) {
          setActiveSessions(data.activeSessions || []);
          // Auto select all active sessions by default
          setSelectedSessions((data.activeSessions || []).map((s: any) => s._id));
        } else {
          setError(data.message || "Failed to load active sessions.");
        }
      })
      .catch((err) => {
        setLoadingSessions(false);
        setError("Network error loading checkout sessions.");
        console.error(err);
      });
  }, [user, secureToken, loadingUser]);

  function handleToggleSelect(id: string) {
    setSelectedSessions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleCheckout(sessionsToCheckout: string[]) {
    if (sessionsToCheckout.length === 0 || submitting) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/player/qr-exit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionIds: sessionsToCheckout,
          token: secureToken,
        }),
      });

      const data = await res.json();
      setSubmitting(false);

      if (res.ok && data.success) {
        setSuccess("Checkout successful! Thank you for playing.");
        setTimeout(() => {
          if (user?.role === "COMPANY_EMPLOYEE") {
            router.push("/company/dashboard");
          } else {
            router.push("/player/dashboard");
          }
        }, 3000);
      } else {
        setError(data.message || "Checkout failed.");
      }
    } catch (err) {
      setSubmitting(false);
      setError("Failed to execute checkout request.");
      console.error(err);
    }
  }

  if (loadingUser) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-12 flex items-center justify-center">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-black/5 text-center flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-[var(--primary)] mb-3" size={32} />
          <p className="font-bold text-[var(--primary)]">Identifying player session...</p>
        </div>
      </main>
    );
  }

  // Not Logged In screen
  if (!user) {
    const redirectUrl = `/game/exit/${encodeURIComponent(secureToken)}`;
    const loginHref = `/auth/login?redirect=${encodeURIComponent(redirectUrl)}`;
    const corpLoginHref = `/company/login?redirect=${encodeURIComponent(redirectUrl)}`;

    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-12 flex items-center justify-center">
        <section className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl ring-1 ring-black/5 space-y-6">
          <div className="text-center mb-8">
            <span className="text-xs font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full">
              Checkout Station
            </span>
            <h1 className="text-3xl font-black text-[var(--primary)] mt-3">Exit Scanner</h1>
            <p className="text-sm font-bold text-[var(--text-muted)] mt-1.5 leading-relaxed">
              Please log in to your account to verify and end your active playing sessions.
            </p>
          </div>

          <div className="grid gap-4">
            <Link
              href={loginHref}
              className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                  <User size={20} />
                </span>
                <div className="text-left">
                  <p className="font-black text-sm text-[var(--primary)]">Regular Player</p>
                  <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Log in with your phone or email</p>
                </div>
              </div>
              <ArrowRight size={18} className="text-gray-450" />
            </Link>

            <Link
              href={corpLoginHref}
              className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <Building2 size={20} />
                </span>
                <div className="text-left">
                  <p className="font-black text-sm text-indigo-900">Corporate Employee</p>
                  <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Sign in with Employee ID / email</p>
                </div>
              </div>
              <ArrowRight size={18} className="text-gray-450" />
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-12 flex items-center justify-center">
      <section className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl ring-1 ring-black/5 space-y-6">
        <div className="text-center">
          <span className="text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full">
            Logged In as {user.role === "COMPANY_EMPLOYEE" ? "Corporate" : "Player"}
          </span>
          <h2 className="text-2xl font-black text-[var(--primary)] mt-3">Welcome, {user.name}</h2>
          <p className="text-xs font-bold text-[var(--text-muted)] mt-0.5">{user.email || user.phone}</p>
        </div>

        {success && (
          <div className="bg-emerald-50 border border-emerald-250 p-5 rounded-2xl text-center text-emerald-800 font-bold space-y-1.5">
            <CheckCircle2 className="mx-auto text-emerald-600 animate-bounce" size={28} />
            <p className="text-sm">{success}</p>
            <p className="text-[10px] font-normal text-emerald-600">Redirecting to your dashboard in 3s...</p>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-250 p-4 rounded-2xl text-center text-rose-800 font-bold flex items-center gap-2">
            <AlertCircle className="text-rose-600 shrink-0" size={18} />
            <p className="text-xs text-left">{error}</p>
          </div>
        )}

        {!success && (
          <div className="space-y-4">
            {loadingSessions ? (
              <div className="text-center py-6">
                <Loader2 className="animate-spin mx-auto text-gray-400" size={24} />
                <p className="text-xs text-gray-500 mt-2 font-bold">Scanning active courts...</p>
              </div>
            ) : activeSessions.length === 0 ? (
              <div className="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-200 text-center text-xs font-bold text-gray-500">
                No active sessions currently running.
              </div>
            ) : activeSessions.length === 1 ? (
              /* ONE ACTIVE SESSION - Directly show "End Session" */
              <div className="space-y-4">
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 text-center space-y-2">
                  <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Active Session Detected</p>
                  <h4 className="text-lg font-black text-[var(--primary)]">{activeSessions[0].gameName}</h4>
                  <p className="text-xs font-bold text-gray-650">Court: {activeSessions[0].court}</p>
                  <p className="text-[11px] text-gray-500 font-semibold">
                    Started: {new Date(activeSessions[0].startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                
                <button
                  onClick={() => handleCheckout([activeSessions[0]._id])}
                  disabled={submitting}
                  className="h-14 w-full rounded-full bg-red-600 font-black text-white hover:bg-red-750 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/10"
                >
                  {submitting ? "Ending Session..." : "End Session"}
                </button>
              </div>
            ) : (
              /* MULTIPLE ACTIVE SESSIONS */
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">
                  Select Session To End
                </h3>

                <div className="space-y-3">
                  {activeSessions.map((session) => {
                    const isSelected = selectedSessions.includes(session._id);
                    return (
                      <div
                        key={session._id}
                        onClick={() => handleToggleSelect(session._id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? "bg-indigo-50 border-indigo-250 ring-2 ring-indigo-50"
                            : "bg-white border-gray-100 hover:bg-gray-50"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-black text-[var(--primary)]">{session.gameName}</p>
                          <p className="text-[10px] font-bold text-[var(--text-muted)] mt-0.5">
                            Court: {session.court}
                          </p>
                          <p className="text-[10px] font-semibold text-gray-500">
                            Started: {new Date(session.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>

                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-5 h-5 accent-[var(--primary)] rounded cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-2 pt-2">
                  <button
                    onClick={() => handleCheckout(selectedSessions)}
                    disabled={selectedSessions.length === 0 || submitting}
                    className="h-12 w-full rounded-full bg-[var(--primary)] font-black text-white hover:opacity-95 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
                  >
                    {submitting ? "Ending Selection..." : "End Selected Sessions"}
                  </button>

                  <button
                    onClick={() => handleCheckout(activeSessions.map(s => s._id))}
                    disabled={submitting}
                    className="h-12 w-full rounded-full bg-red-600 font-black text-white hover:bg-red-750 transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? "Ending All..." : "End All Sessions"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
