"use client";

import { useEffect, useState } from "react";
import { Search, Calendar, Clock, Phone, User as UserIcon, RefreshCw, XCircle, AlertTriangle, CheckCircle, Tag } from "lucide-react";
import { formatToISTTime } from "@/lib/time";

export default function AdminBookingIntentsPage() {
  const [intents, setIntents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal / Detail state
  const [selectedIntent, setSelectedIntent] = useState<any>(null);
  const [adminNote, setAdminNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchIntents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (sourceFilter) params.append("source", sourceFilter);
      if (dateFilter) params.append("date", dateFilter);

      const res = await fetch(`/api/admin/booking-intents?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setIntents(data.intents || []);
      } else {
        setMessage(data.message || "Failed to load booking intents");
      }
    } catch (err) {
      console.error(err);
      setMessage("Error loading intents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntents();
  }, [statusFilter, sourceFilter, dateFilter]);

  const handleUpdateIntentStatus = async (intentId: string, newStatus: string) => {
    if (!confirm(`Are you sure you want to mark this intent as ${newStatus}?`)) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/admin/booking-intents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId, status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(`Intent marked as ${newStatus} successfully!`);
        fetchIntents();
        if (selectedIntent && selectedIntent._id === intentId) {
          setSelectedIntent(data.intent);
        }
      } else {
        alert(data.message || "Failed to update status");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating status");
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedIntent) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/admin/booking-intents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId: selectedIntent._id, adminNote }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage("Admin review note updated successfully!");
        fetchIntents();
        setSelectedIntent(data.intent);
        setTimeout(() => setMessage(""), 3000);
      } else {
        alert(data.message || "Failed to save note");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving note");
    } finally {
      setUpdating(false);
    }
  };

  const filteredIntents = intents.filter((intent) => {
    const query = searchQuery.toLowerCase();
    return (
      intent.phone?.toLowerCase().includes(query) ||
      intent.customerName?.toLowerCase().includes(query) ||
      intent.gameName?.toLowerCase().includes(query) ||
      intent.razorpayOrderId?.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-black border border-emerald-100">CONFIRMED</span>;
      case "PAID":
        return <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-black border border-emerald-100">PAID</span>;
      case "PENDING_PAYMENT":
        return <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-black border border-amber-100">PENDING PAY</span>;
      case "FAILED":
        return <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-black border border-rose-100">FAILED</span>;
      case "EXPIRED":
        return <span className="bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full text-[10px] font-black border border-gray-100">EXPIRED</span>;
      case "ADMIN_REVIEW":
        return <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-[10px] font-black border border-purple-100">ADMIN REVIEW</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-[10px] font-bold">{status}</span>;
    }
  };

  const getSourceBadge = (source: string) => {
    if (source === "WHATSAPP") {
      return <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-[9px] font-black border border-green-100">WHATSAPP</span>;
    }
    return <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[9px] font-black border border-blue-100">VOICE AGENT</span>;
  };

  return (
    <section className="min-w-0 pb-10 text-left space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-[var(--primary)]">Booking Intents</h1>
          <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
            Review and manage incoming booking intents created via WhatsApp and voice channels.
          </p>
        </div>
        <button
          onClick={fetchIntents}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5 hover:bg-gray-50 active:scale-95 transition"
        >
          <RefreshCw size={18} className="text-[var(--primary)]" />
        </button>
      </div>

      {message && (
        <p className="rounded-xl bg-white p-3 text-sm font-black text-[var(--primary)] ring-1 ring-black/5">
          {message}
        </p>
      )}

      {/* Filters bar */}
      <div className="bg-white rounded-2xl p-4 ring-1 ring-black/5 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by phone, name, game..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-xl bg-gray-50 border pl-10 pr-4 text-xs font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl bg-gray-50 border px-3 text-xs font-bold outline-none"
        >
          <option value="">All Statuses</option>
          <option value="PENDING_PAYMENT">Pending Payment</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="ADMIN_REVIEW">Admin Review</option>
          <option value="FAILED">Failed</option>
          <option value="EXPIRED">Expired</option>
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-10 rounded-xl bg-gray-50 border px-3 text-xs font-bold outline-none"
        >
          <option value="">All Sources</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="VOICE">Voice Agent</option>
        </select>

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="h-10 rounded-xl bg-gray-50 border px-3 text-xs font-bold outline-none"
        />
      </div>

      {/* Table grid */}
      <div className="bg-white rounded-2xl ring-1 ring-black/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-gray-400 font-bold uppercase bg-gray-50">
                <th className="py-3 px-4">Customer</th>
                <th>Game / Placed</th>
                <th>Source</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Booking ID</th>
                <th className="px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredIntents.map((intent) => {
                const intentDate = new Date(intent.createdAt).toLocaleDateString("en-IN");
                return (
                  <tr key={intent._id} className="border-b last:border-0 hover:bg-gray-50 font-bold text-gray-700">
                    <td className="py-3 px-4">
                      <div className="font-black text-[var(--primary)]">{intent.customerName || "Voice/WA Guest"}</div>
                      <div className="text-[10px] text-gray-400">{intent.phone}</div>
                    </td>
                    <td>
                      <div>{intent.gameName}</div>
                      <div className="text-[10px] text-indigo-700">
                        {intent.date} @ {intent.startTime}
                      </div>
                    </td>
                    <td>{getSourceBadge(intent.source)}</td>
                    <td>₹{intent.price}</td>
                    <td>{getStatusBadge(intent.status)}</td>
                    <td>
                      {intent.bookingId ? (
                        <span className="bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 text-[9px] select-all font-mono">
                          {intent.bookingId}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedIntent(intent);
                            setAdminNote(intent.metadata?.adminNote || "");
                          }}
                          className="bg-gray-100 hover:bg-gray-200 text-[var(--primary)] px-2.5 py-1.5 rounded-lg transition"
                        >
                          View Details
                        </button>
                        {intent.status === "PENDING_PAYMENT" && (
                          <button
                            onClick={() => handleUpdateIntentStatus(intent._id, "EXPIRED")}
                            className="bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1.5 rounded-lg transition"
                          >
                            Expire
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredIntents.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 font-bold">
                    {loading ? "Loading results..." : "No booking intents matched filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL DIALOG MODAL */}
      {selectedIntent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-[2.5rem] p-6 shadow-2xl space-y-6 text-left ring-1 ring-black/5 animate-scale-in">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-xl font-black text-[var(--primary)] flex items-center gap-2">
                <Tag size={18} /> Booking Request Details
              </h3>
              <button
                onClick={() => setSelectedIntent(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-bold text-gray-700 bg-gray-50 p-4 rounded-2xl border">
              <div>
                <span className="text-[10px] text-gray-400 font-black block uppercase">Customer Name</span>
                <span className="text-sm text-[var(--primary)] font-black">{selectedIntent.customerName || "Guest User"}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-black block uppercase">Phone Number</span>
                <span className="text-sm text-[var(--primary)] font-black">{selectedIntent.phone}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-black block uppercase">Sport Game</span>
                <span>{selectedIntent.gameName}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-black block uppercase">Target Court</span>
                <span>{selectedIntent.metadata?.court || "Not assigned"}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-black block uppercase">Date & Time Slot</span>
                <span>{selectedIntent.date} ({selectedIntent.startTime} - {selectedIntent.endTime})</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-black block uppercase">Players Count</span>
                <span>{selectedIntent.playersCount} Players</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-black block uppercase">Razorpay Order ID</span>
                <span className="select-all font-mono bg-white px-1.5 py-0.5 rounded border">{selectedIntent.razorpayOrderId || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-black block uppercase">Expires At</span>
                <span className="text-rose-600">{formatToISTTime(selectedIntent.expiresAt)}</span>
              </div>
            </div>

            {/* Admin Note Section */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400">Admin Review Note</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Add audit/review comments for this channel booking request..."
                className="w-full p-3 text-xs font-bold rounded-xl border bg-gray-50 focus:ring-1 focus:ring-[var(--primary)] outline-none min-h-[80px]"
              />
              <button
                onClick={handleSaveNote}
                disabled={updating}
                className="bg-[var(--primary)] text-xs font-black text-white px-4 py-2 rounded-full hover:opacity-90 active:scale-95 transition"
              >
                Save Review Note
              </button>
            </div>

            <div className="flex gap-2 justify-end border-t pt-3">
              {selectedIntent.status === "ADMIN_REVIEW" && (
                <button
                  onClick={() => handleUpdateIntentStatus(selectedIntent._id, "CONFIRMED")}
                  disabled={updating}
                  className="bg-emerald-600 text-white text-xs font-black px-4 py-2.5 rounded-full hover:bg-emerald-700 transition"
                >
                  Manually Confirm Booking
                </button>
              )}
              <button
                onClick={() => setSelectedIntent(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black px-4 py-2.5 rounded-full transition"
              >
                Close Dialog
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
