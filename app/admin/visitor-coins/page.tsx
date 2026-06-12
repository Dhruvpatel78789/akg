"use client";

import { useEffect, useState } from "react";
import { Coins, Search, Plus, Trash2, History, Percent, Save, Loader2, CreditCard } from "lucide-react";

interface Visitor {
  _id: string;
  name: string;
  phone: string;
  email: string;
  rewardCoins: number;
  visitCount: number;
  totalAmountSpent: number;
}

interface CoinTxn {
  _id: string;
  type: string;
  coins: number;
  amount: number;
  note: string;
  createdAt: string;
}

export default function VisitorCoinsPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [adjustingCoins, setAdjustingCoins] = useState(false);
  const [message, setMessage] = useState("");
  
  // Coin Adjust Input
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [coinAction, setCoinAction] = useState<"ADD" | "DEDUCT">("ADD");
  const [coinAmount, setCoinAmount] = useState("");
  const [coinReason, setCoinReason] = useState("");
  const [history, setHistory] = useState<CoinTxn[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Settings Input
  const [maxVisitorCoinUsagePercentage, setMaxVisitorCoinUsagePercentage] = useState(20);

  async function loadData() {
    setLoading(true);
    try {
      const visitorsRes = await fetch("/api/admin/visitors");
      const visitorsData = await visitorsRes.json();
      if (visitorsData.success) {
        setVisitors(visitorsData.visitors || []);
      }

      const settingsRes = await fetch("/api/admin/settings");
      const settingsData = await settingsRes.json();
      if (settingsData.success) {
        setMaxVisitorCoinUsagePercentage(settingsData.settings.maxVisitorCoinUsagePercentage ?? 20);
      }
    } catch {
      setMessage("Error loading details");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadHistory(id: string) {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/visitors/${id}/history`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
      }
    } catch {
      console.error("Failed to load coin history");
    } finally {
      setLoadingHistory(false);
    }
  }

  function handleSelectVisitor(visitor: Visitor) {
    setSelectedVisitor(visitor);
    loadHistory(visitor._id);
  }

  async function handleUpdateSettings(e: React.FormEvent) {
    e.preventDefault();
    setUpdatingSettings(true);
    setMessage("");

    try {
      // First, fetch current settings so we don't overwrite other configurations
      const currentRes = await fetch("/api/admin/settings");
      const currentData = await currentRes.json();
      const currentSettings = currentData.success ? currentData.settings : {};

      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...currentSettings,
          maxVisitorCoinUsagePercentage: Number(maxVisitorCoinUsagePercentage),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setMessage("Global Visitor Coin Usage Cap updated successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(data.message || "Failed to update settings");
      }
    } catch {
      setMessage("Network error saving settings");
    } finally {
      setUpdatingSettings(false);
    }
  }

  async function handleAdjustCoins(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVisitor) return;
    if (!coinAmount || Number(coinAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setAdjustingCoins(true);
    try {
      const response = await fetch(`/api/admin/visitors/${selectedVisitor._id}/coins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: coinAction,
          amount: Number(coinAmount),
          reason: coinReason,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert(data.message);
        setCoinAmount("");
        setCoinReason("");
        // Reload details
        loadHistory(selectedVisitor._id);
        const updatedVisitors = visitors.map(v => 
          v._id === selectedVisitor._id 
            ? { ...v, rewardCoins: data.user.rewardCoins } 
            : v
        );
        setVisitors(updatedVisitors);
        setSelectedVisitor(prev => prev ? { ...prev, rewardCoins: data.user.rewardCoins } : null);
      } else {
        alert(data.message || "Failed to adjust coins");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setAdjustingCoins(false);
    }
  }

  const filteredVisitors = visitors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.phone.includes(search)
  );

  return (
    <section className="min-w-0 pb-10">
      <div>
        <h1 className="text-4xl font-black text-[var(--primary)] flex items-center gap-3">
          <Coins size={36} className="text-[var(--primary)]" />
          Visitor Coins & Rewards
        </h1>
        <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
          Manage coin rewards for standard guests, track transaction history, and define payment percentage boundaries.
        </p>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-white p-3 text-sm font-black text-[var(--primary)] ring-1 ring-black/5">
          {message}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        {/* Visitors Search & List */}
        <div className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col min-h-[500px]">
          <h3 className="text-lg font-black text-[var(--primary)] border-b pb-2 flex items-center gap-2 mb-4">
            <Search size={18} />
            Search Guests
          </h3>

          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by name or mobile number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 bg-gray-50 rounded-xl pl-10 pr-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 flex-1">
              <Loader2 size={24} className="animate-spin text-[var(--primary)]" />
            </div>
          ) : filteredVisitors.length === 0 ? (
            <p className="text-xs font-bold text-gray-400 py-10 text-center flex-1">No visitors matched your criteria.</p>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs font-semibold text-gray-600">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase text-[10px]">
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Phone</th>
                    <th className="pb-3">Reward Balance</th>
                    <th className="pb-3">Visits Count</th>
                    <th className="pb-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisitors.map((v) => (
                    <tr
                      key={v._id}
                      onClick={() => handleSelectVisitor(v)}
                      className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/50 cursor-pointer transition ${
                        selectedVisitor?._id === v._id ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      <td className="py-3.5 font-black text-[var(--primary)]">{v.name}</td>
                      <td className="py-3.5">{v.phone}</td>
                      <td className="py-3.5 font-bold text-emerald-600">{v.rewardCoins} Coins</td>
                      <td className="py-3.5">{v.visitCount} visits</td>
                      <td className="py-3.5">
                        <span className="text-[10px] font-black text-[var(--primary)] hover:underline">
                          Configure
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Configurations & Wallet Details */}
        <div className="space-y-6">
          {/* Usage Percentage Limit config */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <form onSubmit={handleUpdateSettings} className="space-y-4">
              <h3 className="text-sm font-black text-[var(--primary)] border-b pb-2 flex items-center gap-2">
                <Percent size={16} />
                Global Usage Rule
              </h3>
              
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-100 text-[11px] leading-relaxed text-amber-800 font-medium">
                Set the maximum percentage of booking costs that a guest is allowed to cover using reward coins (e.g. 20%).
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">Visitor Coin Usage Cap (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={maxVisitorCoinUsagePercentage}
                  onChange={(e) => setMaxVisitorCoinUsagePercentage(Number(e.target.value))}
                  className="w-full h-11 bg-gray-50 rounded-xl px-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)]"
                />
              </div>

              <button
                type="submit"
                disabled={updatingSettings}
                className="w-full h-11 rounded-full bg-[var(--primary)] text-white text-xs font-black hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2"
              >
                {updatingSettings ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {updatingSettings ? "Saving Settings..." : "Save Rule config"}
              </button>
            </form>
          </div>

          {/* Adjustments Form */}
          {selectedVisitor && (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-4">
              <h3 className="text-sm font-black text-[var(--primary)] border-b pb-2 flex items-center gap-2">
                <Coins size={16} />
                Adjust Coins for {selectedVisitor.name}
              </h3>

              <div className="flex justify-between items-center text-xs font-bold bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-500">Current Reward Balance:</span>
                <span className="text-sm font-black text-emerald-600">{selectedVisitor.rewardCoins} Coins</span>
              </div>

              <form onSubmit={handleAdjustCoins} className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Select Action</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["ADD", "DEDUCT"] as const).map((action) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => setCoinAction(action)}
                        className={`h-9 rounded-lg text-xs font-bold transition ${
                          coinAction === action
                            ? "bg-[var(--primary)] text-white font-black"
                            : "bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-100"
                        }`}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Coins Count</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={coinAmount}
                    onChange={(e) => setCoinAmount(e.target.value)}
                    placeholder="Enter reward coins"
                    className="w-full h-10 bg-gray-50 rounded-xl px-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Reason / Note</label>
                  <textarea
                    value={coinReason}
                    onChange={(e) => setCoinReason(e.target.value)}
                    placeholder="Reason for this change"
                    className="w-full h-16 bg-gray-50 rounded-xl p-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={adjustingCoins}
                  className="w-full h-10 mt-3 rounded-full bg-[var(--primary)] text-white text-xs font-black hover:opacity-90 active:scale-95 transition flex items-center justify-center"
                >
                  {adjustingCoins ? "Processing..." : "Confirm Adjustment"}
                </button>
              </form>

              {/* History summary */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="text-[10px] font-black uppercase text-gray-400 block mb-1 flex items-center gap-1">
                  <History size={12} /> Recent History
                </span>

                {loadingHistory ? (
                  <p className="text-[10px] text-gray-400 animate-pulse font-bold text-center">Loading logs...</p>
                ) : history.length === 0 ? (
                  <p className="text-[10px] text-gray-400 font-bold text-center">No coin history found.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {history.map((h) => (
                      <div key={h._id} className="p-2 border border-gray-100 bg-gray-50/70 rounded-lg text-[10px] flex justify-between items-start">
                        <div>
                          <p className="font-bold text-gray-700">{h.note}</p>
                          <p className="text-gray-400 mt-0.5">{new Date(h.createdAt).toLocaleDateString("en-IN")}</p>
                        </div>
                        <span className={`font-black shrink-0 ${h.coins > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {h.coins > 0 ? `+${h.coins}` : h.coins}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
