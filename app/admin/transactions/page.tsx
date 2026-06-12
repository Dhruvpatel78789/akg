"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, Download, FileSpreadsheet } from "lucide-react";

type TransactionItem = {
  _id: string;
  userId?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  type: "PLAN_PURCHASE" | "COINS_PURCHASE" | "SESSION_DEDUCTION" | "REFUND";
  amount?: number;
  coins?: number;
  paymentMode?: "coins" | "online" | "cash";
  transactionId?: string;
  refundAmount?: number;
  note?: string;
  createdAt: string;
};

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [paymentModeFilter, setPaymentModeFilter] = useState("ALL");

  async function loadTransactions() {
    try {
      const response = await fetch("/api/admin/transactions", {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        setTransactions(data.transactions || []);
      } else {
        setError(data.message || "Failed to load transactions");
      }
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError("Network error loading transactions");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
    const interval = setInterval(() => {
      loadTransactions();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const name = tx.userId?.name || "";
      const phone = tx.userId?.phone || "";
      const note = tx.note || "";
      const text = `${name} ${phone} ${note}`.toLowerCase();
      const matchesSearch = text.includes(searchQuery.toLowerCase());

      const matchesType = typeFilter === "ALL" || tx.type === typeFilter;
      
      const mode = tx.paymentMode || (tx.coins && tx.coins > 0 ? "coins" : "online");
      const matchesMode = paymentModeFilter === "ALL" || mode === paymentModeFilter;

      return matchesSearch && matchesType && matchesMode;
    });
  }, [transactions, searchQuery, typeFilter, paymentModeFilter]);

  function handleExportCSV() {
    const headers = [
      "User",
      "Phone",
      "Email",
      "Transaction Type",
      "Amount (INR)",
      "Coins",
      "Payment Mode",
      "Transaction ID",
      "Refund Amount",
      "Date",
      "Status",
      "Note"
    ];
    
    const rows = filteredTransactions.map((tx) => {
      const mode = tx.paymentMode || (tx.coins && tx.coins > 0 ? "coins" : "online");
      return [
        tx.userId?.name || "-",
        tx.userId?.phone || "-",
        tx.userId?.email || "-",
        tx.type,
        tx.amount || 0,
        tx.coins || 0,
        mode,
        tx.transactionId || "-",
        tx.refundAmount || 0,
        new Date(tx.createdAt).toLocaleString("en-IN"),
        "SUCCESS",
        tx.note || "-"
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <section className="min-w-0 pb-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-black text-[var(--primary)]">Transactions</h1>
          <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
            View all user transactions, memberships purchases, coins, and refunds.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={filteredTransactions.length === 0}
          className="flex h-12 items-center gap-2 rounded-full bg-[var(--primary)] px-6 text-xs font-black text-white hover:opacity-90 active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:pointer-events-none"
        >
          <FileSpreadsheet size={16} />
          Export CSV
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-white p-3 text-sm font-black text-red-500 ring-1 ring-black/5">
          {error}
        </p>
      )}

      {/* Search & Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl shadow-sm ring-1 ring-black/5">
        <div className="relative">
          <input
            type="text"
            placeholder="Search user, phone, note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-64 rounded-full bg-gray-50 pl-10 pr-4 text-xs font-bold outline-none border border-gray-200 focus:border-[var(--primary)] transition"
          />
          <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-full bg-gray-50 px-4 text-xs font-bold border border-gray-200 outline-none cursor-pointer"
        >
          <option value="ALL">All Types</option>
          <option value="PLAN_PURCHASE">Plan Purchase</option>
          <option value="COINS_PURCHASE">Coins Purchase</option>
          <option value="SESSION_DEDUCTION">Session Deduction</option>
          <option value="REFUND">Refund</option>
        </select>

        <select
          value={paymentModeFilter}
          onChange={(e) => setPaymentModeFilter(e.target.value)}
          className="h-10 rounded-full bg-gray-50 px-4 text-xs font-bold border border-gray-200 outline-none cursor-pointer"
        >
          <option value="ALL">All Payment Modes</option>
          <option value="coins">Coins</option>
          <option value="online">Online</option>
          <option value="cash">Cash</option>
        </select>
      </div>

      {loading ? (
        <p className="mt-8 font-black text-[var(--primary)]">Loading transactions...</p>
      ) : (
        <section className="mt-6 overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-b text-[var(--text-muted)]">
                  <th className="py-3">User</th>
                  <th>Contact</th>
                  <th>Transaction Type</th>
                  <th>Amount</th>
                  <th>Coins</th>
                  <th>Payment Mode</th>
                  <th>Transaction ID</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map((tx) => {
                  const mode = tx.paymentMode || (tx.coins && tx.coins > 0 ? "coins" : "online");
                  return (
                    <tr key={tx._id} className="border-b last:border-0 hover:bg-gray-50/50">
                      <td className="py-3 font-black text-[var(--primary)]">
                        {tx.userId?.name || "-"}
                      </td>
                      <td>
                        <p className="font-semibold">{tx.userId?.phone || "-"}</p>
                        <p className="text-xs text-gray-500">{tx.userId?.email || "-"}</p>
                      </td>
                      <td className="font-bold">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                          tx.type === "PLAN_PURCHASE" ? "bg-green-100 text-green-800" :
                          tx.type === "COINS_PURCHASE" ? "bg-yellow-100 text-yellow-800" :
                          tx.type === "SESSION_DEDUCTION" ? "bg-blue-100 text-blue-800" :
                          "bg-purple-100 text-purple-800"
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="font-black">
                        {tx.amount ? `₹${tx.amount}` : "₹0"}
                      </td>
                      <td className="font-black">{tx.coins || 0}</td>
                      <td className="capitalize font-semibold text-gray-600">
                        {mode}
                      </td>
                      <td className="font-mono text-xs text-gray-500">
                        {tx.transactionId || "-"}
                      </td>
                      <td>
                        {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-800">
                          SUCCESS
                        </span>
                      </td>
                      <td className="text-gray-600 text-xs font-semibold max-w-[200px] truncate" title={tx.note}>
                        {tx.note || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredTransactions.length === 0 && (
              <p className="mt-5 text-sm font-bold text-[var(--text-muted)]">
                No transactions recorded.
              </p>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
