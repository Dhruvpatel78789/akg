"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Coins, AlertCircle, Clock } from "lucide-react";

type Transaction = {
  _id: string;
  type: string;
  amount: number;
  coins: number;
  note: string;
  createdAt: string;
};

type UserData = {
  coins: number;
  coinsAvailable: number;
  coinsFrozen: number;
  coinsFrozenReason?: string;
  coinsFrozenAt?: string;
};

export default function CoinHistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/player/dashboard", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/auth/login?redirect=/player/coins/history");
        return;
      }
      const data = await res.json();
      if (res.ok && data?.user) {
        setUser(data.user);
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error("Failed to load coin history", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="font-black text-[var(--primary)] text-lg animate-pulse">Loading coin history...</p>
      </main>
    );
  }

  const availableCoins = user?.coinsAvailable ?? 0;
  const frozenCoins = user?.coinsFrozen ?? 0;
  const totalCoins = user?.coins ?? 0;

  return (
    <main className="min-h-screen bg-[var(--background)] pb-12">
      <section className="mx-auto w-full max-w-md px-4 py-4 md:max-w-2xl">
        <header className="flex items-center gap-4 pb-6">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/player/dashboard");
              }
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 hover:bg-gray-50 active:scale-95 transition-all"
          >
            <ChevronLeft size={24} className="text-[var(--primary)]" />
          </button>
          <h1 className="text-xl font-black text-[var(--primary)]">Coin Wallet & History</h1>
        </header>

        {/* Card for Balance stats */}
        <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 grid grid-cols-2 gap-4">
          <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/50 text-center">
            <Coins size={28} className="text-emerald-600 mx-auto mb-2 animate-bounce" />
            <p className="text-[10px] font-black text-gray-400 uppercase">Available Coins</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{availableCoins}</p>
          </div>

          <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50 text-center">
            <div className="relative inline-block mx-auto mb-2">
              <Coins size={28} className="text-blue-500" />
              {frozenCoins > 0 && <span className="absolute -top-1 -right-1 text-xs">❄️</span>}
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase">Frozen Coins</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{frozenCoins}</p>
          </div>

          {frozenCoins > 0 && (
            <div className="col-span-2 bg-amber-50 border border-amber-100 rounded-2xl p-3 flex gap-2 text-xs font-semibold text-amber-800">
              <AlertCircle size={16} className="shrink-0 text-amber-600" />
              <div>
                <p className="font-bold">Freeze Status: ACTIVE</p>
                <p className="text-[10px] text-amber-700/90 mt-0.5">
                  Reason: {user?.coinsFrozenReason || "Coins frozen due to plan expiry."}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* History Transactions List */}
        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h3 className="text-lg font-black text-[var(--primary)] flex items-center gap-2 border-b pb-3 mb-4">
            <Clock size={18} className="text-gray-400" />
            Transaction History
          </h3>

          {transactions.length === 0 ? (
            <p className="text-sm font-semibold text-gray-400 text-center py-6">No coin transactions found.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {transactions.map((t) => {
                const date = new Date(t.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                });
                return (
                  <div key={t._id} className="py-3 flex justify-between items-center text-xs font-bold text-gray-700">
                    <div className="space-y-0.5">
                      <p className="font-black text-gray-800">{t.note || t.type}</p>
                      <p className="text-[10px] font-medium text-gray-400">{date}</p>
                    </div>
                    <div className="text-right">
                      {t.coins > 0 ? (
                        <span className="text-sm font-black text-emerald-600">+{t.coins} Coins</span>
                      ) : t.coins < 0 ? (
                        <span className="text-sm font-black text-rose-600">{t.coins} Coins</span>
                      ) : (
                        <span className="text-sm font-black text-gray-400">0 Coins</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
