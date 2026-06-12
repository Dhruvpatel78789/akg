"use client";

import { useEffect, useState } from "react";
import { Wallet, Calendar, Plus, Trash2, Printer, Check, CheckSquare, X } from "lucide-react";

type Company = {
  _id: string;
  name: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  billingAddress: string;
  discountPercentage: number;
};

type CompanyBillItem = {
  sessionEntryId: string;
  employeeName: string;
  employeeId: string;
  gameName: string;
  date: string;
  startTime: string;
  endTime: string;
  actualDuration: number;
  billableUnits: number;
  originalRate?: number;
  gameDiscount?: number;
  amount: number;
};

type CompanyBill = {
  _id: string;
  companyId: {
    _id: string;
    name: string;
    contactPerson: string;
    email: string;
  };
  billingPeriodStart: string;
  billingPeriodEnd: string;
  totalPlayers: number;
  totalSessions: number;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  letterPadHeader?: string;
  status: string;
  items: CompanyBillItem[];
};

const cardClass =
  "rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-[0_18px_45px_rgba(0,48,22,0.08)] backdrop-blur-2xl";

const fieldClass =
  "h-12 w-full min-w-0 rounded-2xl border border-black/5 bg-white/75 px-4 font-bold text-[var(--primary)] outline-none shadow-inner focus:ring-1 focus:ring-[var(--primary)]";

export default function AdminCompanyBillingPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [bills, setBills] = useState<CompanyBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);

  // Invoice generator inputs
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [letterPadHeader, setLetterPadHeader] = useState("");

  const [message, setMessage] = useState("");
  const [viewingBill, setViewingBill] = useState<CompanyBill | null>(null);

  async function loadMetadata() {
    try {
      const res = await fetch("/api/admin/companies");
      const data = await res.json();
      setCompanies(data.companies || []);
      if (data.companies && data.companies.length > 0) {
        setSelectedCompanyId(data.companies[0]._id);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadSettings() {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (res.ok && data.success) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadBills() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/company-billing/bills");
      const data = await res.json();
      if (res.ok) {
        setBills(data.bills || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMetadata();
    loadBills();
    loadSettings();
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("/api/admin/company-billing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          startDate,
          endDate,
          letterPadHeader,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessage("Invoice generated successfully");
        setViewingBill(data.bill);
        loadBills();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(data.message || "Failed to generate invoice");
      }
    } catch (err) {
      console.error(err);
      setMessage("Error generating invoice");
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const res = await fetch(`/api/admin/company-billing/bills/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        loadBills();
        if (viewingBill && viewingBill._id === id) {
          setViewingBill((prev) => prev ? { ...prev, status: newStatus } : null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    try {
      const res = await fetch(`/api/admin/company-billing/bills/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage("Invoice deleted");
        setViewingBill(null);
        loadBills();
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <section className="min-w-0 pb-12">
      <div className="mb-8">
        <h1 className="text-5xl font-black text-[var(--primary)]">Corporate Billing</h1>
        <p className="text-sm font-bold text-[var(--text-muted)] mt-1">
          Generate monthly itemized invoices for corporate clients with letter pad options.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-2xl border border-white/60 bg-white/70 p-4 text-sm font-black text-[var(--primary)] shadow-sm backdrop-blur-2xl">
          {message}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* Billing Form Generator */}
        <div className="space-y-6">
          <form onSubmit={handleGenerate} className={cardClass}>
            <div className="flex items-center gap-2 mb-5">
              <Wallet className="text-indigo-650" size={24} />
              <h2 className="text-2xl font-black text-[var(--primary)]">Generate Bill</h2>
            </div>

            <div className="space-y-4">
              <label className="grid gap-1">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">Select Company</span>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  required
                  className={fieldClass}
                >
                  <option value="">Choose Company</option>
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className={fieldClass}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">End Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className={fieldClass}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">Letter Pad Header</span>
                <textarea
                  placeholder="e.g. AKSHAR GAME ZONE TURFS & ARENAS&#10;123 Stadium Road, Bangalore&#10;Tel: +91 99999 88888"
                  value={letterPadHeader}
                  onChange={(e) => setLetterPadHeader(e.target.value)}
                  className="h-24 w-full rounded-2xl border border-black/5 bg-white/75 p-4 font-bold text-[var(--primary)] outline-none shadow-inner resize-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </label>

              <button className="h-12 w-full rounded-2xl bg-[var(--primary)] text-sm font-black text-white hover:opacity-95 transition mt-4">
                Calculate & Generate
              </button>
            </div>
          </form>

          {/* Past Invoices Sidebar List */}
          <div className={cardClass}>
            <h3 className="text-lg font-black text-[var(--primary)] mb-4">Invoice Roster</h3>
            {loading ? (
              <p className="text-xs text-gray-500 font-bold">Loading past bills...</p>
            ) : bills.length === 0 ? (
              <p className="text-xs text-gray-500 font-bold">No generated bills yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {bills.map((bill) => (
                  <div
                    key={bill._id}
                    onClick={() => setViewingBill(bill)}
                    className={`p-3 rounded-xl border border-black/5 cursor-pointer hover:bg-white/60 transition ${
                      viewingBill?._id === bill._id ? "bg-white/80 border-indigo-200 ring-2 ring-indigo-50" : "bg-white/30"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="text-xs font-black text-[var(--primary)] truncate w-32">
                        {bill.companyId?.name || "Unknown Company"}
                      </h4>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        bill.status === "PAID"
                          ? "bg-emerald-50 text-emerald-700"
                          : bill.status === "SENT"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        {bill.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-bold mt-1">
                      ₹{bill.totalAmount} (Sessions: {bill.totalSessions})
                    </p>
                    <p className="text-[9px] text-gray-400 font-semibold mt-0.5">
                      Period: {new Date(bill.billingPeriodStart).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - {new Date(bill.billingPeriodEnd).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Invoice Visual Details Container */}
        <div>
          {viewingBill ? (
            <div className={`${cardClass} space-y-6 relative printable-area`}>
              {/* Dynamic printable letterhead backdrop */}
              {settings?.billingLetterheadUrl && (
                <div className="print-letterhead hidden">
                  <img src={settings.billingLetterheadUrl} alt="Letterhead Background" />
                </div>
              )}
              {/* Printable overlay style */}
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  .printable-area, .printable-area * {
                    visibility: visible;
                  }
                  .printable-area {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    background: white !important;
                    box-shadow: none !important;
                    border: none !important;
                    padding: 0 !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                  .print-letterhead {
                    display: block !important;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: -10;
                    pointer-events: none;
                  }
                  .print-letterhead img {
                    width: 100%;
                    height: 100%;
                    object-fit: fill;
                    opacity: 0.20;
                  }
                }
              `}} />

              {/* Header Letterpad pad render block */}
              {viewingBill.letterPadHeader ? (
                <div className="border-b-2 border-black pb-5 text-center text-xs font-bold font-mono whitespace-pre-wrap leading-relaxed text-gray-800 bg-gray-50 p-4 rounded-2xl ring-1 ring-black/5">
                  {viewingBill.letterPadHeader}
                </div>
              ) : (
                <div className="border-b-2 border-dashed border-gray-200 pb-5 text-center">
                  <h3 className="text-2xl font-black text-[var(--primary)]">Akshar Game Zone Invoice Statement</h3>
                  <p className="text-xs font-bold text-[var(--text-muted)]">CORPORATE OUTSTANDING BILL</p>
                </div>
              )}

              {/* Bill meta & dates */}
              <div className="grid grid-cols-2 gap-4 text-xs font-bold text-gray-700">
                <div>
                  <p className="text-[10px] uppercase text-[var(--text-muted)] font-black">Billed To</p>
                  <p className="text-sm font-black text-[var(--primary)] mt-0.5">{viewingBill.companyId?.name}</p>
                  <p className="text-gray-500">{viewingBill.companyId?.contactPerson || viewingBill.companyId?.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-[var(--text-muted)] font-black">Billing Period</p>
                  <p className="mt-0.5 text-gray-800">
                    {new Date(viewingBill.billingPeriodStart).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} - {new Date(viewingBill.billingPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <p className="text-[10px] uppercase text-[var(--text-muted)] font-black mt-2">Invoice Status</p>
                  <p className="font-black text-indigo-750">{viewingBill.status}</p>
                </div>
              </div>

              {/* Summary table grouped by Game */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase text-[var(--text-muted)] font-black">Game Breakdown</p>
                <div className="overflow-x-auto border border-black/5 rounded-2xl bg-white/40 mb-4">
                  <table className="w-full text-left text-xs font-semibold">
                    <thead>
                      <tr className="border-b border-black/10 bg-black/5 text-[var(--text-muted)] font-black">
                        <th className="p-3">Game</th>
                        <th className="p-3 text-right">Sessions Played</th>
                        <th className="p-3 text-right">Billable Units</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(
                        viewingBill.items.reduce((acc: any, item) => {
                          const key = item.gameName;
                          if (!acc[key]) {
                            acc[key] = { gameName: item.gameName, count: 0, units: 0, amount: 0 };
                          }
                          acc[key].count += 1;
                          acc[key].units += item.billableUnits;
                          acc[key].amount += item.amount;
                          return acc;
                        }, {})
                      ).map((group: any, idx) => (
                        <tr key={idx} className="border-b border-black/5 hover:bg-white/30">
                          <td className="p-3 font-bold">{group.gameName}</td>
                          <td className="p-3 text-right font-mono">{group.count}</td>
                          <td className="p-3 text-right font-mono">{group.units}</td>
                          <td className="p-3 text-right font-bold">₹{group.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sessions itemized table */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase text-[var(--text-muted)] font-black">Itemized Session Logs</p>
                <div className="overflow-x-auto border border-black/5 rounded-2xl bg-white/40">
                  <table className="w-full min-w-[750px] text-left text-xs font-semibold">
                    <thead>
                      <tr className="border-b border-black/10 bg-black/5 text-[var(--text-muted)] font-black">
                        <th className="p-3">Employee</th>
                        <th className="p-3">ID</th>
                        <th className="p-3">Game</th>
                        <th className="p-3">Date & Time</th>
                        <th className="p-3 text-right">Rate</th>
                        <th className="p-3 text-right">Game Disc</th>
                        <th className="p-3 text-right">Units</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingBill.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-black/5 hover:bg-white/30">
                          <td className="p-3 font-bold">{item.employeeName}</td>
                          <td className="p-3 font-mono">{item.employeeId}</td>
                          <td className="p-3">{item.gameName}</td>
                          <td className="p-3">
                            {new Date(item.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}{" "}
                            ({new Date(item.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })})
                          </td>
                          <td className="p-3 text-right font-mono">₹{item.originalRate || item.amount / (item.billableUnits || 1)}</td>
                          <td className="p-3 text-right font-mono text-rose-600">-₹{item.gameDiscount || 0}</td>
                          <td className="p-3 text-right font-mono">{item.billableUnits}</td>
                          <td className="p-3 text-right font-bold">₹{item.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial summary calculations */}
              <div className="flex justify-end pt-4 border-t border-black/5">
                <div className="w-72 space-y-2 text-xs font-bold">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal (Standard Pricing):</span>
                    <span>₹{viewingBill.subtotalAmount}</span>
                  </div>
                  <div className="flex justify-between text-rose-655">
                    <span>Discount Deducted (Game + Company):</span>
                    <span className="text-rose-600">-₹{viewingBill.discountAmount}</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-[var(--primary)] border-t pt-2 border-black/10">
                    <span>Total Amount:</span>
                    <span>₹{viewingBill.totalAmount}</span>
                  </div>
                </div>
              </div>

              {/* Billing lifecycle status actions */}
              <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-black/5 no-print">
                <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Set Invoice Status:</span>
                <button
                  onClick={() => handleStatusChange(viewingBill._id, "GENERATED")}
                  className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold rounded-xl text-xs transition"
                >
                  DRAFT
                </button>
                <button
                  onClick={() => handleStatusChange(viewingBill._id, "SENT")}
                  className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition"
                >
                  SENT
                </button>
                <button
                  onClick={() => handleStatusChange(viewingBill._id, "PAID")}
                  className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition"
                >
                  PAID
                </button>
                <button
                  onClick={() => handleStatusChange(viewingBill._id, "CANCELLED")}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition"
                >
                  CANCELLED
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white hover:opacity-95 rounded-xl text-xs font-black transition"
                >
                  <Printer size={14} />
                  <span>Print Invoice</span>
                </button>
                <button
                  onClick={() => handleDelete(viewingBill._id)}
                  className="flex items-center justify-center h-9 w-9 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-full transition"
                  title="Delete Invoice"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div className={`${cardClass} min-h-[400px] flex flex-col items-center justify-center text-center text-[var(--text-muted)] font-bold`}>
              <Wallet size={48} className="text-indigo-250 mb-3 animate-pulse" />
              <p className="text-lg">No Statement Selected</p>
              <p className="text-xs max-w-xs mt-1">Select an invoice from the roster, or run the generator to create a new draft invoice statement.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
