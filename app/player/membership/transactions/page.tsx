"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Wallet, Calendar, Coins, ArrowUpRight, ArrowDownLeft, RefreshCcw } from "lucide-react";

type TransactionType = 
  | "PLAN_PURCHASE" 
  | "COINS_PURCHASE" 
  | "SESSION_DEDUCTION" 
  | "REFUND"
  | "OVERTIME" 
  | "RESCHEDULE" 
  | "CANCELLATION";

type Transaction = {
  _id: string;
  type: TransactionType;
  amount: number;
  coins: number;
  note: string;
  paymentMode: "coins" | "online" | "cash";
  transactionId?: string;
  refundAmount?: number;
  createdAt: string;
};

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTransactions() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/player/transactions", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success) {
        setTransactions(data.transactions || []);
      } else {
        setError(data.message || "Failed to load transactions");
      }
    } catch {
      setError("Network error loading transaction history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/player/dashboard");
    }
  }

  function getTransactionBadge(type: TransactionType) {
    switch (type) {
      case "PLAN_PURCHASE":
        return { label: "Membership", bg: "bg-purple-100 text-purple-800" };
      case "COINS_PURCHASE":
        return { label: "Coins Purchased", bg: "bg-yellow-100 text-yellow-800" };
      case "SESSION_DEDUCTION":
        return { label: "Session Booking", bg: "bg-blue-100 text-blue-800" };
      case "REFUND":
        return { label: "Refund", bg: "bg-emerald-100 text-emerald-800" };
      case "OVERTIME":
        return { label: "Overtime Charge", bg: "bg-amber-100 text-amber-800" };
      case "RESCHEDULE":
        return { label: "Reschedule Charge", bg: "bg-pink-100 text-pink-800" };
      case "CANCELLATION":
        return { label: "Cancellation Penalty", bg: "bg-rose-100 text-rose-800" };
      default:
        return { label: type, bg: "bg-gray-100 text-gray-800" };
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-4">
      <section className="mx-auto w-full max-w-md md:max-w-2xl lg:max-w-4xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
            >
              <ArrowLeft size={25} className="text-[var(--primary)]" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-[var(--primary)] flex items-center gap-2">
                <Wallet size={24} className="text-[var(--primary)]" />
                Coin History
              </h1>
              <p className="text-xs font-bold text-[var(--text-muted)]">
                Track your coin purchases, spends, refunds, and adjustments
              </p>
            </div>
          </div>

          <button
            onClick={loadTransactions}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 hover:bg-gray-50 active:scale-95 transition"
            title="Refresh list"
          >
            <RefreshCcw size={18} className="text-[var(--primary)]" />
          </button>
        </header>

        {/* Info warning */}
        {error && (
          <div className="mt-4 p-4 bg-rose-50 text-rose-800 font-bold rounded-2xl text-xs">
            {error}
          </div>
        )}

        {/* Transactions List */}
        <section className="mt-6 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--primary)]" />
              <p className="text-xs font-bold text-[var(--text-muted)]">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
              <h3 className="text-lg font-black text-[var(--primary)]">No Transactions Yet</h3>
              <p className="mt-2 text-xs font-bold text-[var(--text-muted)]">
                Purchases and session booking deductions will appear here.
              </p>
            </div>
          ) : (
            transactions.map((txn) => {
              const badge = getTransactionBadge(txn.type);
              const isIncome = txn.type === "REFUND" || txn.type === "COINS_PURCHASE";
              const isCoins = txn.paymentMode === "coins" || txn.coins > 0;

              return (
                <div
                  key={txn._id}
                  className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-black/5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl ${isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-500'}`}>
                      {isIncome ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${badge.bg}`}>
                          {badge.label}
                        </span>
                        {txn.paymentMode && (
                          <span className="text-[10px] font-bold text-gray-400 capitalize">
                            via {txn.paymentMode}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm font-black text-[var(--primary)] leading-tight">
                        {txn.note}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-400 font-semibold">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(txn.createdAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {txn.transactionId && <span>ID: {txn.transactionId}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end shrink-0">
                    <p className={`text-lg font-black ${isIncome ? "text-emerald-600" : "text-[var(--primary)]"}`}>
                      {isIncome ? "+" : "-"}
                      {isCoins ? `${txn.coins || 0} Coins` : `₹${txn.amount || 0}`}
                    </p>
                    {txn.refundAmount && txn.refundAmount > 0 ? (
                      <p className="text-[10px] text-emerald-600 font-bold">
                        Refunded: {isCoins ? `${txn.refundAmount} Coins` : `₹${txn.refundAmount}`}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </section>
    </main>
  );
}
