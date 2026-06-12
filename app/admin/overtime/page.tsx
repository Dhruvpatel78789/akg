"use client";

import { useEffect, useState } from "react";
import { Clock, CheckCircle2, AlertCircle, RefreshCw, Eye, ShieldAlert, Sparkles, Building2, User2 } from "lucide-react";

type AdditionalCharge = {
  _id: string;
  userId?: {
    name?: string;
    phone?: string;
    email?: string;
    role?: string;
  };
  bookingId?: {
    _id?: string;
    gameName?: string;
    startTime?: string;
    endTime?: string;
    exitedTime?: string;
    playersCount?: number;
    price?: number;
    playerType?: string;
    autoEnded?: boolean;
  };
  amount: number;
  additionalUnits?: number;
  reason: string;
  status: "PENDING" | "AWAITING_SETTLEMENT" | "COLLECTED" | "WAIVED" | "SETTLED" | "PAID";
  createdAt: string;
  settledAt?: string;
};

type CompanyOvertime = {
  _id: string;
  playerName: string;
  mobile: string;
  userType: string;
  companyId?: {
    name?: string;
  };
  companyEmployeeId?: {
    employeeId?: string;
  };
  gameName: string;
  court: string;
  startTime: string;
  endTime: string;
  exitedTime?: string;
  bookedDurationMinutes: number;
  actualDurationMinutes?: number;
  billableSessionUnits?: number;
  bookingId?: {
    _id?: string;
    autoEnded?: boolean;
  };
  companyOvertimeStatus: "PENDING" | "REVIEWED" | "INCLUDED";
  createdAt: string;
};

export default function AdminOvertimePage() {
  const [charges, setCharges] = useState<AdditionalCharge[]>([]);
  const [companyOvertime, setCompanyOvertime] = useState<CompanyOvertime[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "AUTO_EXITED" | "PENDING" | "SETTLED" | "WAIVED">("ALL");

  async function loadData() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/additional-charges", { cache: "no-store" });
      const data = await response.json();
      if (response.ok && data.success) {
        setCharges(data.charges || []);
        setCompanyOvertime(data.companyOvertime || []);
      } else {
        setMessage(data.message || "Failed to load data");
      }
    } catch {
      setMessage("Error fetching additional charges and company overtime data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleAction(chargeId: string, status: "COLLECTED" | "WAIVED" | "SETTLED") {
    try {
      const response = await fetch("/api/admin/additional-charges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId, status }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setMessage(`Charge successfully marked as ${status.toLowerCase()}`);
        loadData();
        setTimeout(() => setMessage(""), 3500);
      } else {
        setMessage(data.message || "Operation failed");
      }
    } catch {
      setMessage("Connection error performing action");
    }
  }

  async function handleCompanyAction(companyEntryId: string, companyOvertimeStatus: "REVIEWED" | "INCLUDED") {
    try {
      const response = await fetch("/api/admin/additional-charges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyEntryId, companyOvertimeStatus }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setMessage(`Company overtime entry successfully updated to ${companyOvertimeStatus.toLowerCase()}`);
        loadData();
        setTimeout(() => setMessage(""), 3500);
      } else {
        setMessage(data.message || "Operation failed");
      }
    } catch {
      setMessage("Connection error updating company overtime status");
    }
  }

  function getDurationString(start?: string, end?: string) {
    if (!start || !end) return "-";
    const mins = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / (60 * 1000));
    return `${mins} min`;
  }

  // Filtering lists based on activeTab
  const filteredCharges = charges.filter((c) => {
    if (activeTab === "AUTO_EXITED") return c.bookingId?.autoEnded === true;
    if (activeTab === "PENDING") return c.status === "PENDING" || c.status === "AWAITING_SETTLEMENT";
    if (activeTab === "SETTLED") return c.status === "SETTLED" || c.status === "COLLECTED" || c.status === "PAID";
    if (activeTab === "WAIVED") return c.status === "WAIVED";
    return true;
  });

  const filteredCompanyOvertime = companyOvertime.filter((co) => {
    if (activeTab === "AUTO_EXITED") return co.bookingId?.autoEnded === true;
    if (activeTab === "PENDING") return co.companyOvertimeStatus === "PENDING";
    if (activeTab === "SETTLED") return co.companyOvertimeStatus === "REVIEWED" || co.companyOvertimeStatus === "INCLUDED";
    if (activeTab === "WAIVED") return false; // Company overtime entries are never "waived" in the traditional sense, they are marked reviewed or included
    return true;
  });

  return (
    <section className="min-w-0 pb-10 px-4 md:px-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-[var(--primary)] flex items-center gap-2">
            <Clock className="text-indigo-600" size={36} />
            <span>Overtime & Auto-Exited</span>
          </h1>
          <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
            Review and settle overtime session charges and corporate entries.
          </p>
        </div>
        <button
          onClick={loadData}
          className="rounded-full bg-white border border-gray-250 px-5 py-2.5 text-xs font-black text-[var(--primary)] flex items-center gap-2 hover:bg-gray-50 active:scale-95 transition-all shadow-sm w-max"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-indigo-600" : ""} />
          Refresh
        </button>
      </header>

      {message && (
        <div className="mt-4 rounded-2xl bg-indigo-50 border border-indigo-150 p-4 text-sm font-black text-indigo-900 animate-fade-in flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-150 pb-3">
        {(["ALL", "AUTO_EXITED", "PENDING", "SETTLED", "WAIVED"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-2 text-xs font-black transition-all ${
              activeTab === tab
                ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/10"
                : "bg-white text-[var(--primary)] hover:bg-gray-50 border border-gray-200"
            }`}
          >
            {tab === "ALL" && "All Entries"}
            {tab === "AUTO_EXITED" && "Auto-Exited"}
            {tab === "PENDING" && "Pending"}
            {tab === "SETTLED" && "Settled / Billed"}
            {tab === "WAIVED" && "Waived"}
          </button>
        ))}
      </div>

      {/* Main content tables */}
      <section className="mt-6 space-y-6">
        {loading ? (
          <p className="text-sm font-bold text-[var(--text-muted)] py-8 animate-pulse text-center">Loading overtime records...</p>
        ) : (
          <div className="space-y-8">
            {/* 1. Non-Company Additional Charges */}
            {filteredCharges.length > 0 && (
              <div className="overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <div className="mb-4 flex items-center gap-2">
                  <User2 size={18} className="text-emerald-600" />
                  <h2 className="text-lg font-black text-[var(--primary)]">Visitor / Member Overtime Charges</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-left text-sm">
                    <thead>
                      <tr className="border-b text-[var(--text-muted)]">
                        <th className="py-3">Player</th>
                        <th>Game & Court</th>
                        <th>Booked / Actual</th>
                        <th>Additional Units</th>
                        <th>Amount</th>
                        <th>Auto Ended</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCharges.map((charge) => {
                        const count = charge.bookingId?.playersCount || 1;
                        const bookedMins = getDurationString(charge.bookingId?.startTime, charge.bookingId?.endTime);
                        const actualMins = getDurationString(charge.bookingId?.startTime, charge.bookingId?.exitedTime);
                        return (
                          <tr key={charge._id} className="border-b last:border-0 hover:bg-gray-50/50">
                            <td className="py-3">
                              <p className="font-black text-[var(--primary)]">{charge.userId?.name || "N/A"}</p>
                              <p className="text-xs text-gray-500 font-bold">{charge.userId?.phone || ""}</p>
                              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-150 px-1.5 py-0.5 rounded font-black mt-1 inline-block uppercase">
                                {charge.bookingId?.playerType || "MEMBER"}
                              </span>
                            </td>
                            <td>
                              <p className="font-bold text-gray-750">{charge.bookingId?.gameName || "Game session"}</p>
                              <p className="text-xs text-gray-500">{count} Player(s)</p>
                            </td>
                            <td>
                              <p className="font-semibold text-gray-700">Booked: {bookedMins}</p>
                              <p className="font-black text-indigo-700 mt-0.5">Actual: {actualMins}</p>
                            </td>
                            <td className="font-bold text-center">{charge.additionalUnits || 1} Unit(s)</td>
                            <td className="font-black text-rose-600 text-base">₹{charge.amount}</td>
                            <td>
                              {charge.bookingId?.autoEnded ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-full border border-rose-150">
                                  <ShieldAlert size={12} /> Yes
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-gray-400">No</span>
                              )}
                            </td>
                            <td>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-black inline-flex items-center gap-1 ${
                                charge.status === "PENDING" || charge.status === "AWAITING_SETTLEMENT" ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" :
                                charge.status === "WAIVED" ? "bg-gray-100 text-gray-700" :
                                "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                              }`}>
                                {charge.status}
                              </span>
                            </td>
                            <td>
                              <div className="flex gap-1.5">
                                {(charge.status === "PENDING" || charge.status === "AWAITING_SETTLEMENT") && (
                                  <>
                                    <button
                                      onClick={() => handleAction(charge._id, "COLLECTED")}
                                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-black text-white hover:opacity-90 active:scale-95 transition"
                                    >
                                      Collect
                                    </button>
                                    <button
                                      onClick={() => handleAction(charge._id, "WAIVED")}
                                      className="rounded-lg bg-gray-500 px-3 py-1.5 text-xs font-black text-white hover:opacity-90 active:scale-95 transition"
                                    >
                                      Waive
                                    </button>
                                    <button
                                      onClick={() => handleAction(charge._id, "SETTLED")}
                                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:opacity-90 active:scale-95 transition"
                                    >
                                      Settle
                                    </button>
                                  </>
                                )}
                                {charge.status === "WAIVED" && <span className="text-xs font-bold text-gray-400">Waived</span>}
                                {(charge.status === "SETTLED" || charge.status === "COLLECTED" || charge.status === "PAID") && (
                                  <span className="text-xs font-bold text-emerald-600">Sattled & Paid</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. Company Overtime child entries */}
            {filteredCompanyOvertime.length > 0 && (
              <div className="overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <div className="mb-4 flex items-center gap-2">
                  <Building2 size={18} className="text-blue-600" />
                  <h2 className="text-lg font-black text-[var(--primary)]">Corporate Employees Overtime Entries</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-left text-sm">
                    <thead>
                      <tr className="border-b text-[var(--text-muted)]">
                        <th className="py-3">Employee</th>
                        <th>Company</th>
                        <th>Game & Court</th>
                        <th>Booked / Actual</th>
                        <th>Billable Units</th>
                        <th>Auto Ended</th>
                        <th>Billing Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompanyOvertime.map((entry) => {
                        const bookedMins = entry.bookedDurationMinutes || 60;
                        const actualMins = entry.actualDurationMinutes || 60;
                        return (
                          <tr key={entry._id} className="border-b last:border-0 hover:bg-gray-50/50">
                            <td className="py-3">
                              <p className="font-black text-[var(--primary)]">{entry.playerName}</p>
                              <p className="text-xs text-gray-500 font-bold">{entry.mobile}</p>
                              <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-150 px-1.5 py-0.5 rounded font-black mt-1 inline-block">
                                ID: {entry.companyEmployeeId?.employeeId || "N/A"}
                              </span>
                            </td>
                            <td>
                              <p className="font-bold text-gray-700">{entry.companyId?.name || "Corporate Partner"}</p>
                            </td>
                            <td>
                              <p className="font-bold text-gray-755">{entry.gameName}</p>
                              <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold text-gray-650">{entry.court}</span>
                            </td>
                            <td>
                              <p className="font-semibold text-gray-500">Booked: {bookedMins}m</p>
                              <p className="font-black text-indigo-700 mt-0.5">Actual: {actualMins}m</p>
                            </td>
                            <td className="font-bold text-center">{entry.billableSessionUnits || 1} Unit(s)</td>
                            <td>
                              {entry.bookingId?.autoEnded ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-full border border-rose-150">
                                  <ShieldAlert size={12} /> Yes
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-gray-400">No</span>
                              )}
                            </td>
                            <td>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-black inline-flex items-center gap-1 ${
                                entry.companyOvertimeStatus === "PENDING" ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" :
                                entry.companyOvertimeStatus === "REVIEWED" ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" :
                                "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                              }`}>
                                {entry.companyOvertimeStatus === "PENDING" ? "Pending" :
                                 entry.companyOvertimeStatus === "REVIEWED" ? "Reviewed" : "Included in Bill"}
                              </span>
                            </td>
                            <td>
                              <div className="flex gap-1.5">
                                {entry.companyOvertimeStatus === "PENDING" && (
                                  <>
                                    <button
                                      onClick={() => handleCompanyAction(entry._id, "REVIEWED")}
                                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:opacity-90 active:scale-95 transition"
                                    >
                                      Mark Reviewed
                                    </button>
                                    <button
                                      onClick={() => handleCompanyAction(entry._id, "INCLUDED")}
                                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:opacity-90 active:scale-95 transition"
                                    >
                                      Include in Bill
                                    </button>
                                  </>
                                )}
                                {entry.companyOvertimeStatus === "REVIEWED" && (
                                  <button
                                    onClick={() => handleCompanyAction(entry._id, "INCLUDED")}
                                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:opacity-90 active:scale-95 transition"
                                  >
                                    Include in Bill
                                  </button>
                                )}
                                {entry.companyOvertimeStatus === "INCLUDED" && (
                                  <span className="text-xs font-bold text-emerald-600">Included</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {filteredCharges.length === 0 && filteredCompanyOvertime.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl ring-1 ring-black/5">
                <Clock className="mx-auto text-gray-300" size={48} />
                <p className="mt-4 text-sm font-bold text-[var(--text-muted)]">
                  No overtime entries matching filters were found.
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
