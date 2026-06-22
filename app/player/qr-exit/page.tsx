"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert, CheckCircle, ArrowRight, Play, Home } from "lucide-react";
import Link from "next/link";

function QrExitForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadActiveSessions() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/player/qr-exit?token=${token}`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok && data.success) {
        setSessions(data.activeSessions || []);
        // Pre-select all by default
        setSelectedIds((data.activeSessions || []).map((s: any) => s._id));
      } else {
        if (response.status === 401) {
          // Redirect to register/login page first with correct parameter redirections
          router.replace(`/auth/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return;
        }
        setError(data.message || "Failed to load scan parameters.");
      }
    } catch {
      setError("Network connection issue verifying scan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadActiveSessions();
    } else {
      setError("Invalid QR code scanner context.");
      setLoading(false);
    }
  }, [token]);

  function toggleSelect(id: string) {
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    } else {
      setSelectedIds((prev) => [...prev, id]);
    }
  }

  const [animatingText, setAnimatingText] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  async function handleCheckout(bypassConfirm = false) {
    if (selectedIds.length === 0) {
      setError("Please select at least one active game session to end.");
      return;
    }

    if (!bypassConfirm && sessions.length === 1) {
      setShowConfirmModal(true);
      return;
    }

    setShowConfirmModal(false);
    setSubmitting(true);
    setError("");
    setSuccess("");
    
    // Show QR Scan Success / Ending Animation
    setAnimatingText("Session Ending...");
    await new Promise(r => setTimeout(r, 1200));

    try {
      const response = await fetch("/api/player/qr-exit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: selectedIds, token }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setAnimatingText("Session Ended Successfully");
        await new Promise(r => setTimeout(r, 1000));
        setSuccess(data.message || "Session ended successfully!");
        setSessions((prev) => prev.filter((s) => !selectedIds.includes(s._id)));
      } else {
        setError(data.message || "Checkout failed");
      }
    } catch {
      setError("Connection failed processing scan exit.");
    } finally {
      setAnimatingText("");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8">
      <section className="mx-auto max-w-md">
        <header className="flex items-center justify-between pb-4">
          <h1 className="text-3xl font-black text-[var(--primary)]">Exit Station</h1>
          <Link
            href="/"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
          >
            <Home size={23} className="text-[var(--primary)]" />
          </Link>
        </header>

        {loading ? (
          <p className="mt-8 font-black text-[var(--primary)] animate-pulse text-center">Verifying scanned token...</p>
        ) : animatingText ? (
          <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-black/5 text-center space-y-4 flex flex-col items-center justify-center min-h-[200px]">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-150 border-t-emerald-500" />
            <h2 className="text-xl font-black text-emerald-600 animate-pulse">{animatingText}</h2>
          </div>
        ) : error ? (
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
              <ShieldAlert size={36} />
            </div>
            <h2 className="text-xl font-black text-[var(--primary)]">Checkout Failed</h2>
            <p className="text-sm font-semibold text-[var(--text-muted)] leading-relaxed">
              {error}
            </p>
          </div>
        ) : success ? (
          <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle size={36} />
            </div>
            <h2 className="text-xl font-black text-[var(--primary)]">Checkout Complete</h2>
            <p className="text-sm font-semibold text-[var(--text-muted)] leading-relaxed">
              {success}
            </p>
            <Link
              href="/"
              className="mt-4 h-12 w-full rounded-full bg-[var(--primary)] text-sm font-black text-white hover:opacity-95 flex items-center justify-center"
            >
              Back to Home Screen
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-4">
              <p className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">
                Scanner Action Required
              </p>
              
              {sessions.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm font-bold text-gray-500">You do not have any currently running active sessions on courts.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-[var(--primary)]">
                    {sessions.length === 1 ? "Active Session" : "Select Session To End"}
                  </h3>
                  
                  <div className="grid gap-3">
                    {sessions.map((s) => {
                      const isSelected = selectedIds.includes(s._id);
                      return (
                        <div
                          key={s._id}
                          onClick={() => toggleSelect(s._id)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected ? "border-[var(--primary)] bg-emerald-50/20" : "border-gray-100"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all ${
                              isSelected ? "bg-[var(--primary)] border-[var(--primary)] text-white" : "border-gray-300"
                            }`}>
                              {isSelected && <span className="text-[10px] font-bold">✓</span>}
                            </span>
                            <div>
                              <p className="text-sm font-black text-[var(--primary)]">{s.gameName} (Court: {s.court || "N/A"})</p>
                              <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                                Started: {new Date(s.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {sessions.length > 1 && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedIds(sessions.map((s) => s._id))}
                        className="flex-1 h-9 bg-gray-50 rounded-lg text-xs font-bold text-[#03210f] hover:bg-gray-100"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="flex-1 h-9 bg-gray-50 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100"
                      >
                        Clear All
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setSelectedIds(sessions.map((s) => s._id));
                          setAnimatingText("Session Ending...");
                          await new Promise(r => setTimeout(r, 1200));

                          // Perform checkout for all
                          setSubmitting(true);
                          try {
                            const response = await fetch("/api/player/qr-exit", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ sessionIds: sessions.map((s) => s._id), token }),
                            });
                            const data = await response.json();
                            if (response.ok && data.success) {
                              setAnimatingText("Session Ended Successfully");
                              await new Promise(r => setTimeout(r, 1000));
                              setSuccess(data.message || "All sessions ended successfully!");
                              setSessions([]);
                            } else {
                              setError(data.message || "Checkout failed");
                            }
                          } catch {
                            setError("Connection failed processing scan exit.");
                          } finally {
                            setAnimatingText("");
                            setSubmitting(false);
                          }
                        }}
                        className="flex-1 h-9 bg-red-50 rounded-lg text-xs font-black text-red-650 hover:bg-red-100 border border-red-200"
                      >
                        End All Sessions
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => handleCheckout(false)}
                    disabled={submitting || selectedIds.length === 0}
                    className="w-full h-14 bg-red-650 text-white rounded-full font-black text-sm hover:opacity-90 transition flex items-center justify-center gap-2"
                  >
                    <Play size={16} />
                    <span>{sessions.length === 1 ? "End Session" : "End Selected Session(s)"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Single Session Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl text-center space-y-4">
            <h3 className="text-lg font-black text-[var(--primary)]">End Session</h3>
            <p className="text-sm font-semibold text-gray-500 leading-relaxed">
              Are you sure you want to end this session?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 h-12 bg-gray-150 text-gray-800 font-black text-xs rounded-xl hover:bg-gray-200 transition active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCheckout(true)}
                className="flex-1 h-12 bg-red-600 text-white font-black text-xs rounded-xl hover:bg-red-700 transition active:scale-95"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function QrExitPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[var(--background)] px-4 py-8">
        <section className="mx-auto max-w-md">
          <p className="font-black text-[var(--primary)] animate-pulse text-center">Loading scanner payload...</p>
        </section>
      </main>
    }>
      <QrExitForm />
    </Suspense>
  );
}
