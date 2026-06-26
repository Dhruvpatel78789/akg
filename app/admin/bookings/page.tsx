"use client";

import { useEffect, useState, useMemo } from "react";
import { Edit2, Trash2, Search, SlidersHorizontal, CheckSquare, Square, X, Eye, ShieldAlert } from "lucide-react";
import { formatToISTDate, formatToISTDateTimeString, getBookingDisplayStatus } from "@/lib/time";

type Booking = {
  _id: string;
  userId?: {
    _id: string;
    name?: string;
    phone?: string;
    email?: string;
    role?: string;
  };
  gameId?: string;
  gameName?: string;
  court?: string;
  startTime?: string;
  endTime?: string;
  exitedTime?: string;
  status?: string;
  coinCost?: number;
  price?: number;
  paymentMode?: string;
  paymentStatus?: string;
  transactionId?: string;
  playerType?: "MEMBER" | "VISITOR" | "COMPANY";
  companyId?: {
    _id: string;
    name: string;
  };
  companyEmployeeId?: {
    _id: string;
    name?: string;
    mobile?: string;
    email?: string;
    employeeId?: string;
  };
  gatewayPaymentStatus?: string;
  adminPaymentStatus?: string;
  effectivePaymentStatus?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paidAt?: string;
  adminOverrideBy?: any;
  adminOverrideAt?: string;
  autoEnded?: boolean;
  paymentMethod?: string;
};

type BookingRequest = {
  _id: string;
  userId?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  bookingId?: Booking;
  type: "CANCELLATION" | "TIME_CHANGE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedStartTime?: string;
  requestedEndTime?: string;
  reason?: string;
};

type BookingData = {
  advancedBookings: Booking[];
  ongoingSessions: Booking[];
  bookingHistory: Booking[];
  pendingPayments: Booking[];
  failedPayments: Booking[];
  cancellationRequests: BookingRequest[];
  timeChangeRequests: BookingRequest[];
};

const tabs = [
  "Advanced Booking",
  "Ongoing Sessions",
  "All Booking History",
  "Pending Payments",
  "Failed Payments",
  "Cancellation Requests",
  "Time Change Requests",
] as const;

type Tab = (typeof tabs)[number];

function formatDateTime(value?: string) {
  return formatToISTDateTimeString(value);
}

function getEndSuffix(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) return "";
  const sDateStr = formatToISTDate(startTime);
  const eDateStr = formatToISTDate(endTime);
  if (!sDateStr || !eDateStr) return "";
  const s = new Date(sDateStr + "T00:00:00Z");
  const e = new Date(eDateStr + "T00:00:00Z");
  const diffDays = Math.round((e.getTime() - s.getTime()) / (24 * 3600 * 1000));
  if (diffDays > 0) {
    return ` (+${diffDays} day${diffDays > 1 ? 's' : ''})`;
  }
  return "";
}

function mergeById<T extends { _id: string }>(current: T[], incoming: T[]): T[] {
  const incomingMap = new Map(incoming.map((item) => [item._id, item]));

  const updated = current
    .map((item) => incomingMap.get(item._id) || item)
    .filter((item) => incomingMap.has(item._id));

  const existingIds = new Set(current.map((item) => item._id));
  const added = incoming.filter((item) => !existingIds.has(item._id));

  return [...added, ...updated];
}

export default function AdminBookingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Advanced Booking");
  const [data, setData] = useState<BookingData>({
    advancedBookings: [],
    ongoingSessions: [],
    bookingHistory: [],
    pendingPayments: [],
    failedPayments: [],
    cancellationRequests: [],
    timeChangeRequests: [],
  });
  const [message, setMessage] = useState("");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [playerTypeFilter, setPlayerTypeFilter] = useState("ALL");

  // Columns visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    player: true,
    phone: true,
    playerType: true,
    game: true,
    court: true,
    start: true,
    end: true,
    exitTime: true,
    status: true,
    payment: true,
    actions: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Modals state
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [games, setGames] = useState<any[]>([]);
  
  useEffect(() => {
    fetch("/api/games")
      .then(res => res.json())
      .then(data => setGames(data.games || []))
      .catch(err => console.error(err));
  }, []);

  const selectedBookingGame = useMemo(() => {
    if (!editingBooking || !games.length) return null;
    const gId = typeof editingBooking.gameId === "object" && editingBooking.gameId !== null
      ? (editingBooking.gameId as any)._id
      : editingBooking.gameId;
    return games.find((g) => g._id === gId) || null;
  }, [editingBooking, games]);

  const fixedSlots = useMemo(() => {
    if (!selectedBookingGame || !selectedBookingGame.fixedSlotBooking) return [];
    const minDur = selectedBookingGame.duration || 60;
    const slots: string[] = [];
    for (let mins = 0; mins < 1440; mins += minDur) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
    return slots;
  }, [selectedBookingGame]);
  const [editForm, setEditForm] = useState({
    date: "",
    startTime: "",
    endTime: "",
    court: "",
  });

  const handleDateChange = (newDate: string) => {
    setEditForm(prev => {
      let nextStart = prev.startTime;
      if (selectedBookingGame && selectedBookingGame.fixedSlotBooking) {
        const todayStr = formatToISTDate(new Date());
        if (newDate === todayStr) {
          const now = new Date();
          const currentHours = now.getHours();
          const currentMinutes = now.getMinutes();
          const totalMinutes = currentHours * 60 + currentMinutes;
          
          const dur = selectedBookingGame.duration || 60;
          const remainder = totalMinutes % dur;
          const nextSlotMinutes = totalMinutes + (dur - remainder);
          const finalMinutes = nextSlotMinutes >= 1440 ? 0 : nextSlotMinutes;
          
          const h = Math.floor(finalMinutes / 60);
          const m = finalMinutes % 60;
          nextStart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        }
      }
      
      let nextEnd = prev.endTime;
      if (nextStart) {
        const durationMins = (editingBooking && editingBooking.endTime && editingBooking.startTime)
          ? Math.round((new Date(editingBooking.endTime).getTime() - new Date(editingBooking.startTime).getTime()) / 60000)
          : (selectedBookingGame?.duration || 60);
        const [sh, sm] = nextStart.split(":").map(Number);
        const totalMinutes = sh * 60 + sm + durationMins;
        const eh = Math.floor(totalMinutes / 60) % 24;
        const em = totalMinutes % 60;
        nextEnd = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
      }

      return {
        ...prev,
        date: newDate,
        startTime: nextStart,
        endTime: nextEnd
      };
    });
  };

  const handleStartTimeChange = (newStart: string) => {
    setEditForm(prev => {
      let nextEnd = prev.endTime;
      if (newStart) {
        const durationMins = (editingBooking && editingBooking.endTime && editingBooking.startTime)
          ? Math.round((new Date(editingBooking.endTime).getTime() - new Date(editingBooking.startTime).getTime()) / 60000)
          : (selectedBookingGame?.duration || 60);
        const [sh, sm] = newStart.split(":").map(Number);
        const totalMinutes = sh * 60 + sm + durationMins;
        const eh = Math.floor(totalMinutes / 60) % 24;
        const em = totalMinutes % 60;
        nextEnd = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
      }
      return {
        ...prev,
        startTime: newStart,
        endTime: nextEnd
      };
    });
  };

  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [refundAmount, setRefundAmount] = useState(0);

  const [selectedDetailsBooking, setSelectedDetailsBooking] = useState<Booking | null>(null);
  const [overrideForm, setOverrideForm] = useState({ newStatus: "PENDING", reason: "", password: "" });
  const [overrideError, setOverrideError] = useState("");
  const [overrideSuccess, setOverrideSuccess] = useState("");
  const [confirmEndModal, setConfirmEndModal] = useState<{
    bookingId: string;
    forceEnd: boolean;
    playerName: string;
  } | null>(null);
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Force End extra fields
  const [forceEndReason, setForceEndReason] = useState("");
  const [applyCharges, setApplyCharges] = useState(true);
  const [notifyUser, setNotifyUser] = useState(true);

  // Background refresh loaders
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function handleEndSession(
    bookingId: string, 
    forceEnd: boolean = false,
    options?: { reason: string; applyCharges: boolean; notifyUser: boolean }
  ) {
    try {
      const response = await fetch(`/api/admin/sessions/${bookingId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          forceEnd,
          reason: options?.reason || "",
          applyCharges: options?.applyCharges ?? true,
          notifyUser: options?.notifyUser ?? true,
        }),
      });
      const dataResult = await response.json();
      if (response.ok && dataResult.success) {
        setMessage(dataResult.message);
        // Row-level local state update
        setData((prev: any) => {
          const ongoing = prev.ongoingSessions.filter((s: any) => s._id !== bookingId);
          const updated = dataResult.booking;
          const history = updated ? [updated, ...prev.bookingHistory] : prev.bookingHistory;
          return {
            ...prev,
            ongoingSessions: ongoing,
            bookingHistory: history,
          };
        });
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(dataResult.message || "Failed to end session");
      }
    } catch (err) {
      console.error(err);
      setMessage("Error ending session");
    } finally {
      setConfirmEndModal(null);
      setForceEndReason("");
    }
  }

  async function loadBookings(isBackground = false) {
    if (!isBackground) {
      if (!data.advancedBookings?.length && !data.ongoingSessions?.length) {
        setInitialLoading(true);
      }
    } else {
      setRefreshing(true);
    }
    try {
      const response = await fetch("/api/admin/bookings", {
        cache: "no-store",
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Failed to load bookings: ", errText);
        return;
      }

      const result = await response.json();
      setData((prev: any) => {
        if (!prev || !prev.advancedBookings) {
          return {
            advancedBookings: result.advancedBookings || [],
            ongoingSessions: result.ongoingSessions || [],
            bookingHistory: result.bookingHistory || [],
            pendingPayments: result.pendingPayments || [],
            failedPayments: result.failedPayments || [],
            cancellationRequests: result.cancellationRequests || [],
            timeChangeRequests: result.timeChangeRequests || [],
          };
        }
        return {
          advancedBookings: mergeById(prev.advancedBookings, result.advancedBookings || []),
          ongoingSessions: mergeById(prev.ongoingSessions, result.ongoingSessions || []),
          bookingHistory: mergeById(prev.bookingHistory, result.bookingHistory || []),
          pendingPayments: mergeById(prev.pendingPayments, result.pendingPayments || []),
          failedPayments: mergeById(prev.failedPayments, result.failedPayments || []),
          cancellationRequests: mergeById(prev.cancellationRequests, result.cancellationRequests || []),
          timeChangeRequests: mergeById(prev.timeChangeRequests, result.timeChangeRequests || []),
        };
      });
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadBookings(false);
    const interval = setInterval(() => {
      loadBookings(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleProcessRequest(requestId: string, status: "APPROVED" | "REJECTED") {
    try {
      const response = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status }),
      });

      const resData = await response.json();
      if (!response.ok) {
        setMessage(resData.message || "Failed to process request");
        return;
      }

      setMessage(`Request successfully ${status.toLowerCase()}`);
      loadBookings();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setMessage("Failed to submit update decision");
    }
  }

  // Update Booking handler
  async function handleUpdateBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBooking) return;

    try {
      const combinedStart = new Date(`${editForm.date}T${editForm.startTime}`);
      const combinedEnd = new Date(`${editForm.date}T${editForm.endTime}`);

      const response = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: editingBooking._id,
          action: "UPDATE",
          startTime: combinedStart.toISOString(),
          endTime: combinedEnd.toISOString(),
          court: editForm.court,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        setMessage(resData.message || "Failed to update booking");
        return;
      }

      setMessage("Booking updated successfully");
      setEditingBooking(null);
      loadBookings();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setMessage("Failed to reschedule booking");
    }
  }

  // Cancel Booking handler
  async function handleCancelBooking() {
    if (!cancellingBooking) return;

    try {
      const response = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: cancellingBooking._id,
          action: "CANCEL",
          refundAmount,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        setMessage(resData.message || "Failed to cancel booking");
        return;
      }

      setMessage("Booking cancelled successfully and refund processed");
      setCancellingBooking(null);
      loadBookings();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setMessage("Failed to cancel booking");
    }
  }

  async function handleOverrideSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDetailsBooking) return;
    setSubmittingOverride(true);
    setOverrideError("");
    setOverrideSuccess("");

    try {
      const response = await fetch("/api/admin/payments/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payableId: selectedDetailsBooking._id,
          payableType: "Booking",
          newStatus: overrideForm.newStatus,
          reason: overrideForm.reason,
          password: overrideForm.password,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setOverrideSuccess("Payment status overridden successfully!");
        // Update local state or reload
        loadBookings();
        setSelectedDetailsBooking(data.payable);
        // Auto-close modal after brief delay
        setTimeout(() => {
          setSelectedDetailsBooking(null);
          setOverrideSuccess("");
        }, 800);
        // Clear password and reason
        setOverrideForm(prev => ({ ...prev, password: "", reason: "" }));
      } else {
        setOverrideError(data.message || "Failed to override payment status");
      }
    } catch (err: any) {
      setOverrideError(err.message || "Connection error performing override");
    } finally {
      setSubmittingOverride(false);
    }
  }

  // Filtering helper
  const getFilteredBookings = (bookings: Booking[]) => {
    return bookings.filter((b) => {
      const name = b.userId?.name || "";
      const phone = b.userId?.phone || "";
      const game = b.gameName || "";
      const text = `${name} ${phone} ${game}`.toLowerCase();
      const matchesSearch = text.includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || (b.status && b.status.toUpperCase() === statusFilter);

      const matchesPlayerType =
        playerTypeFilter === "ALL" ||
        (playerTypeFilter === "VISITOR" && (b.userId?.role === "VISITOR" || b.playerType === "VISITOR")) ||
        (playerTypeFilter === "COMPANY" && (b.companyId !== undefined || b.playerType === "COMPANY")) ||
        (playerTypeFilter === "MEMBER" && (b.userId?.role !== "VISITOR" && b.playerType !== "VISITOR" && !b.companyId));

      return matchesSearch && matchesStatus && matchesPlayerType;
    });
  };

  const activeBookingsList = useMemo(() => {
    if (activeTab === "Advanced Booking") return getFilteredBookings(data.advancedBookings);
    if (activeTab === "Ongoing Sessions") return getFilteredBookings(data.ongoingSessions);
    if (activeTab === "All Booking History") return getFilteredBookings(data.bookingHistory);
    if (activeTab === "Pending Payments") return getFilteredBookings(data.pendingPayments);
    if (activeTab === "Failed Payments") return getFilteredBookings(data.failedPayments);
    return [];
  }, [activeTab, data, searchQuery, statusFilter, playerTypeFilter]);

  const toggleColumn = (col: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({ ...prev, [col]: !prev[col] }));
  };

  return (
    <section className="min-w-0 pb-10">
      <h1 className="text-4xl font-black text-[var(--primary)] flex items-center gap-2">
        Bookings
        {refreshing && <span className="text-xs text-gray-400 font-normal animate-pulse ml-2">(Refreshing...)</span>}
      </h1>
      <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
        Manage bookings, active sessions, history and user requests.
      </p>

      {message && (
        <p className="mt-4 rounded-xl bg-white p-3 text-sm font-black text-[var(--primary)] ring-1 ring-black/5 animate-fade-in">
          {message}
        </p>
      )}

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-2 text-xs font-black ${
              activeTab === tab
                ? "bg-[var(--primary)] text-white"
                : "bg-white text-[var(--primary)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Controls: Search, Filters, Columns toggle */}
      {activeTab !== "Cancellation Requests" && activeTab !== "Time Change Requests" && (
        <div className="mt-6 flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl shadow-sm ring-1 ring-black/5 justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by player, phone, game..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-64 rounded-full bg-gray-50 pl-10 pr-4 text-xs font-bold outline-none border border-gray-200 focus:border-[var(--primary)] transition"
              />
              <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-full bg-gray-50 px-4 text-xs font-bold border border-gray-200 outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="BOOKED">Booked</option>
              <option value="STARTED">Started</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Player Type Filter */}
            <select
              value={playerTypeFilter}
              onChange={(e) => setPlayerTypeFilter(e.target.value)}
              className="h-10 rounded-full bg-gray-50 px-4 text-xs font-bold border border-gray-200 outline-none cursor-pointer"
            >
              <option value="ALL">All Player Types</option>
              <option value="MEMBER">Member</option>
              <option value="VISITOR">Visitor</option>
              <option value="COMPANY">Company</option>
            </select>
          </div>

          {/* Column Toggle dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              className="h-10 flex items-center gap-2 rounded-full border border-gray-200 px-4 text-xs font-bold hover:bg-gray-50"
            >
              <SlidersHorizontal size={14} />
              Columns
            </button>

            {showColumnDropdown && (
              <div className="absolute right-0 top-12 z-50 w-48 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-black/5 grid gap-1">
                {Object.keys(visibleColumns).map((col) => (
                  <button
                    key={col}
                    onClick={() => toggleColumn(col as keyof typeof visibleColumns)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-black text-left text-[var(--primary)] hover:bg-gray-50 rounded-xl w-full"
                  >
                    {visibleColumns[col as keyof typeof visibleColumns] ? (
                      <CheckSquare size={16} className="text-[var(--primary)]" />
                    ) : (
                      <Square size={16} className="text-gray-300" />
                    )}
                    <span className="capitalize">{col.replace(/([A-Z])/g, " $1")}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bookings Tables */}
      <section className="mt-5 overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        {initialLoading ? (
          <p className="py-10 text-center text-sm font-bold text-[var(--text-muted)] animate-pulse">
            Loading bookings...
          </p>
        ) : activeTab === "Cancellation Requests" ? (
          <RequestTable requests={data.cancellationRequests} onProcess={handleProcessRequest} />
        ) : activeTab === "Time Change Requests" ? (
          <RequestTable requests={data.timeChangeRequests} onProcess={handleProcessRequest} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b text-[var(--text-muted)]">
                  {visibleColumns.player && <th className="py-3">Player</th>}
                  {visibleColumns.phone && <th>Phone</th>}
                  {visibleColumns.playerType && <th>Player Type</th>}
                  {visibleColumns.game && <th>Game</th>}
                  {visibleColumns.court && <th>Court</th>}
                  {visibleColumns.start && <th>Start</th>}
                  {visibleColumns.end && <th>End</th>}
                  {visibleColumns.exitTime && <th>Exit Time</th>}
                  {visibleColumns.status && <th>Status</th>}
                  {visibleColumns.payment && <th>Payment Details</th>}
                  {visibleColumns.actions && <th>Actions</th>}
                </tr>
              </thead>

              <tbody>
                {activeBookingsList.map((booking) => {
                  return (
                    <tr key={booking._id} className="border-b last:border-0 hover:bg-gray-50">
                    {visibleColumns.player && (
                      <td className="py-3 font-black text-[var(--primary)]">
                        {booking.companyEmployeeId ? booking.companyEmployeeId.name : (booking.userId?.name || "-")}
                      </td>
                    )}
                    {visibleColumns.phone && <td>{booking.companyEmployeeId ? booking.companyEmployeeId.mobile : (booking.userId?.phone || "-")}</td>}
                    {visibleColumns.playerType && (
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          booking.companyId ? "bg-blue-100 text-blue-800" :
                          (booking.userId?.role === "VISITOR" || booking.playerType === "VISITOR") ? "bg-amber-100 text-amber-800" : "bg-purple-100 text-purple-800"
                        }`}>
                          {booking.companyId ? booking.companyId.name :
                           (booking.userId?.role === "VISITOR" || booking.playerType === "VISITOR") ? "VISITOR" : "MEMBER"}
                        </span>
                      </td>
                    )}
                    {visibleColumns.game && <td>{booking.gameName || "-"}</td>}
                    {visibleColumns.court && <td>{booking.court || "-"}</td>}
                    {visibleColumns.start && <td>{formatDateTime(booking.startTime)}</td>}
                    {visibleColumns.end && <td>{formatDateTime(booking.endTime)}{getEndSuffix(booking.startTime, booking.endTime)}</td>}
                    {visibleColumns.exitTime && <td>{formatDateTime(booking.exitedTime)}</td>}
                    {visibleColumns.status && (
                      <td>
                        {(() => {
                          const derivedStatus = getBookingDisplayStatus(booking);
                          const style = 
                            derivedStatus === "Booked" || derivedStatus === "Confirmed"
                              ? "bg-blue-100 text-blue-800"
                              : derivedStatus === "Started"
                              ? "bg-yellow-100 text-yellow-800"
                              : derivedStatus === "Completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : derivedStatus === "Pending Payment"
                              ? "bg-amber-100 text-amber-800 animate-pulse"
                              : "bg-rose-100 text-rose-800";
                          return (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-black uppercase ${style}`}>
                              {derivedStatus}
                            </span>
                          );
                        })()}
                      </td>
                    )}
                    {visibleColumns.payment && (
                      <td className="text-xs">
                        {booking.coinCost && booking.coinCost > 0 ? (
                          <p className="font-bold text-yellow-600">{booking.coinCost} Coins</p>
                        ) : (
                          <>
                            <p className="font-semibold text-gray-700">₹{booking.price || 0} ({booking.paymentMethod || booking.paymentMode || "online"})</p>
                            {booking.transactionId && <p className="text-[10px] text-gray-400">Txn: {booking.transactionId}</p>}
                          </>
                        )}
                        <div className="mt-1 space-y-0.5">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">Method: </span>
                            <span className="font-bold text-gray-700">{booking.paymentMethod || (booking.coinCost ? "COINS" : "ONLINE")}</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mt-1">
                            {booking.paymentMethod === "PAY_AT_COUNTER" && booking.paymentStatus === "PENDING" ? (
                              <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase bg-rose-200 text-rose-800 animate-pulse border border-rose-300">
                                Pending Counter Payment
                              </span>
                            ) : (
                              <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                                booking.paymentStatus === "PAID" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}>
                                {booking.paymentStatus || "PENDING"}
                              </span>
                            )}
                            
                            {booking.paymentMethod !== "PAY_AT_COUNTER" && (
                              <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase bg-gray-100 text-gray-600 border border-gray-200">
                                GW: {booking.gatewayPaymentStatus || "PENDING"}
                              </span>
                            )}
                            <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase bg-gray-100 text-gray-600 border border-gray-200">
                              Admin: {booking.adminPaymentStatus || "PENDING"}
                            </span>
                          </div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td>
                        <div className="flex gap-1.5 items-center">
                          <button
                            onClick={() => {
                              setSelectedDetailsBooking(booking);
                              setOverrideForm({ newStatus: booking.adminPaymentStatus || "PENDING", reason: "", password: "" });
                              setOverrideError("");
                              setOverrideSuccess("");
                            }}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition"
                            title="View Payment & Override"
                          >
                            <Eye size={16} />
                          </button>
                          {booking.status !== "CANCELLED" && booking.status !== "COMPLETED" ? (
                            <>
                              {booking.status === "STARTED" && (
                                <>
                                  <button
                                    onClick={() => setConfirmEndModal({ bookingId: booking._id, forceEnd: false, playerName: booking.companyEmployeeId?.name || booking.userId?.name || "Guest Visitor" })}
                                    className="px-2.5 py-1 text-[11px] font-black bg-emerald-600 hover:opacity-90 text-white rounded-full transition"
                                    title="End Play Session"
                                  >
                                    End
                                  </button>
                                  <button
                                    onClick={() => setConfirmEndModal({ bookingId: booking._id, forceEnd: true, playerName: booking.companyEmployeeId?.name || booking.userId?.name || "Guest Visitor" })}
                                    className="px-2.5 py-1 text-[11px] font-black bg-rose-600 hover:opacity-90 text-white rounded-full transition"
                                    title="Force End Play Session"
                                  >
                                    Force End
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => {
                                  setEditingBooking(booking);
                                  const d = new Date(booking.startTime || "");
                                  const startStr = d.toTimeString().slice(0, 5);
                                  const endStr = new Date(booking.endTime || "").toTimeString().slice(0, 5);
                                  setEditForm({
                                    date: d.toISOString().split("T")[0],
                                    startTime: startStr,
                                    endTime: endStr,
                                    court: booking.court || "",
                                  });
                                }}
                                className="p-2 text-gray-600 hover:text-[var(--primary)] hover:bg-gray-100 rounded-full transition"
                                title="Reschedule / Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setCancellingBooking(booking);
                                  setRefundAmount(booking.coinCost || booking.price || 0);
                                }}
                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-full transition"
                                title="Cancel & Refund"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {activeBookingsList.length === 0 && (
              <p className="mt-5 text-sm font-bold text-[var(--text-muted)]">
                No bookings found.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Edit Booking Dialog Modal */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl relative animate-fade-in space-y-4">
            <button
              onClick={() => setEditingBooking(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-black text-[var(--primary)]">Reschedule Booking</h3>
            <p className="text-xs font-bold text-gray-500">
              Editing booking for {editingBooking.userId?.name || "Player"} - {editingBooking.gameName}
            </p>

            <form onSubmit={handleUpdateBooking} className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Date</span>
                <input
                  type="date"
                  required
                  value={editForm.date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="h-12 border border-gray-200 rounded-xl px-4 text-sm font-bold outline-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Start Time</span>
                  {selectedBookingGame?.fixedSlotBooking ? (
                    <select
                      required
                      value={editForm.startTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      className="h-12 border border-gray-200 rounded-xl px-4 text-sm font-bold outline-none cursor-pointer"
                    >
                      <option value="">Select Slot</option>
                      {fixedSlots.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="time"
                      required
                      value={editForm.startTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      className="h-12 border border-gray-200 rounded-xl px-4 text-sm font-bold outline-none"
                    />
                  )}
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">End Time</span>
                  <input
                    type="time"
                    required
                    value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                    className="h-12 border border-gray-200 rounded-xl px-4 text-sm font-bold outline-none"
                  />
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Court Selection</span>
                <input
                  type="text"
                  required
                  placeholder="Court A, Court B, etc."
                  value={editForm.court}
                  onChange={(e) => setEditForm({ ...editForm, court: e.target.value })}
                  className="h-12 border border-gray-200 rounded-xl px-4 text-sm font-bold outline-none"
                />
              </label>

              <button
                type="submit"
                className="mt-2 h-12 bg-[var(--primary)] text-white font-black text-xs rounded-xl hover:opacity-90 transition active:scale-98"
              >
                Save Updates
              </button>
            </form>
          </div>
        </div>
      )}

      {/* End Session Confirmation Modal */}
      {confirmEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl relative text-left">
            <h3 className="text-lg font-black text-[var(--primary)]">
              {confirmEndModal.forceEnd ? "Force End Session Override" : "Confirm Ending Session"}
            </h3>
            
            {!confirmEndModal.forceEnd ? (
              <p className="mt-2 text-sm text-gray-600">
                Are you sure you want to end the session for <span className="font-black text-[var(--primary)]">{confirmEndModal.playerName}</span>?
              </p>
            ) : (
              <div className="mt-4 space-y-4 text-left">
                <p className="text-xs font-bold text-gray-500 uppercase">Administrative Override Fields</p>
                
                <div className="space-y-1">
                  <label className="text-xs font-black text-[var(--primary)]">Reason (Required)</label>
                  <input
                    type="text"
                    value={forceEndReason}
                    onChange={(e) => setForceEndReason(e.target.value)}
                    placeholder="e.g. Stuck court slot, incorrect start, user left early"
                    className="w-full h-10 border rounded-xl px-3 text-xs font-bold focus:border-[var(--primary)] outline-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                  <span className="text-xs font-black text-[var(--primary)]">Apply overtime charges?</span>
                  <input
                    type="checkbox"
                    checked={applyCharges}
                    onChange={(e) => setApplyCharges(e.target.checked)}
                    className="h-4 w-4 text-[var(--primary)] border-gray-300 rounded focus:ring-[var(--primary)]"
                  />
                </div>

                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                  <span className="text-xs font-black text-[var(--primary)]">Notify user?</span>
                  <input
                    type="checkbox"
                    checked={notifyUser}
                    onChange={(e) => setNotifyUser(e.target.checked)}
                    className="h-4 w-4 text-[var(--primary)] border-gray-300 rounded focus:ring-[var(--primary)]"
                  />
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setConfirmEndModal(null);
                  setForceEndReason("");
                }}
                className="px-4 py-2 border rounded-full text-xs font-black hover:bg-gray-50 active:scale-95 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmEndModal.forceEnd) {
                    if (!forceEndReason.trim()) {
                      alert("Reason is required to force end.");
                      return;
                    }
                    handleEndSession(confirmEndModal.bookingId, true, {
                      reason: forceEndReason,
                      applyCharges,
                      notifyUser,
                    });
                  } else {
                    handleEndSession(confirmEndModal.bookingId, false);
                  }
                }}
                className={`px-4 py-2 rounded-full text-xs font-black text-white hover:opacity-90 active:scale-95 transition ${
                  confirmEndModal.forceEnd ? "bg-rose-600" : "bg-emerald-600"
                }`}
              >
                Confirm End
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel & Refund Action Modal */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl relative animate-fade-in space-y-4">
            <button
              onClick={() => setCancellingBooking(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-black text-rose-600">Cancel & Process Refund</h3>
            
            <div className="p-4 bg-gray-50 rounded-2xl space-y-2 text-xs font-bold text-gray-700">
              <p className="text-[10px] uppercase font-black tracking-wider text-gray-400 mb-1">Payment Details</p>
              
              {cancellingBooking.coinCost && cancellingBooking.coinCost > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span>Payment Mode:</span>
                    <span className="font-black">Coin Wallet</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Coins Used:</span>
                    <span className="font-black text-yellow-600">{cancellingBooking.coinCost} Coins</span>
                  </div>
                </>
              ) : cancellingBooking.paymentMode === "cash" ? (
                <>
                  <div className="flex justify-between">
                    <span>Payment Mode:</span>
                    <span className="font-black">Cash</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount Paid:</span>
                    <span className="font-black">₹{cancellingBooking.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Collected Status:</span>
                    <span className="font-black uppercase text-emerald-600">{cancellingBooking.paymentStatus || "PAID"}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span>Payment Mode:</span>
                    <span className="font-black uppercase">{cancellingBooking.paymentMode || "online"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount Paid:</span>
                    <span className="font-black">₹{cancellingBooking.price}</span>
                  </div>
                  {cancellingBooking.transactionId && (
                    <div className="flex justify-between">
                      <span>Transaction ID:</span>
                      <span className="font-semibold text-gray-500">{cancellingBooking.transactionId}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <label className="grid gap-1">
              <span className="text-[10px] font-black uppercase text-gray-400">Refund Amount / Coins</span>
              <input
                type="number"
                min={0}
                max={cancellingBooking.coinCost || cancellingBooking.price || 0}
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
                className="h-12 border border-gray-200 rounded-xl px-4 text-sm font-bold outline-none"
              />
              <span className="text-[10px] text-gray-400 font-semibold">Enter coins to refund (for coin bookings) or rupees (for cash/online).</span>
            </label>

            <button
              onClick={handleCancelBooking}
              className="mt-2 w-full h-12 bg-rose-600 text-white font-black text-xs rounded-xl hover:opacity-90 transition active:scale-98"
            >
              Confirm Cancellation
            </button>
          </div>
         </div>
      )}

      {/* Booking & Payment Details Modal (Includes Override) */}
      {selectedDetailsBooking && (
        <div
          onClick={() => setSelectedDetailsBooking(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-xl relative animate-fade-in space-y-4 my-8"
          >
            <button
              onClick={() => setSelectedDetailsBooking(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-black text-[var(--primary)]">Booking & Payment Details</h3>
            
            {/* Booking info */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-2xl border">
              <div>
                <p className="text-[10px] uppercase font-black text-gray-400">Player</p>
                <p className="font-bold text-gray-800">{selectedDetailsBooking.companyEmployeeId ? selectedDetailsBooking.companyEmployeeId.name : (selectedDetailsBooking.userId?.name || "-")}</p>
                <p className="text-gray-500">{selectedDetailsBooking.companyEmployeeId ? selectedDetailsBooking.companyEmployeeId.mobile : (selectedDetailsBooking.userId?.phone || "-")}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-black text-gray-400">Game & Court</p>
                <p className="font-bold text-gray-800">{selectedDetailsBooking.gameName}</p>
                <p className="text-gray-500">Court: {selectedDetailsBooking.court || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-black text-gray-400">Timings</p>
                <p className="text-gray-700">Start: {formatDateTime(selectedDetailsBooking.startTime)}</p>
                <p className="text-gray-700">End: {formatDateTime(selectedDetailsBooking.endTime)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-black text-gray-400">Exited Time</p>
                <p className="text-gray-700">{selectedDetailsBooking.exitedTime ? formatDateTime(selectedDetailsBooking.exitedTime) : "Not Exited"}</p>
              </div>
            </div>

            {/* Payment Details */}
            <div className="space-y-2.5 border-t pt-4">
              <h4 className="text-sm font-black text-[var(--primary)]">Payment Trackers</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-bold text-gray-400 block uppercase text-[9px]">Payment Method</span>
                  <span className="font-black text-gray-700">{selectedDetailsBooking.paymentMethod || (selectedDetailsBooking.coinCost ? "COINS" : "ONLINE")}</span>
                </div>
                <div>
                  <span className="font-bold text-gray-400 block uppercase text-[9px]">Gateway Status</span>
                  <span className="font-black text-gray-700">{selectedDetailsBooking.gatewayPaymentStatus || "PENDING"}</span>
                </div>
                <div>
                  <span className="font-bold text-gray-400 block uppercase text-[9px]">Admin Status</span>
                  <span className="font-black text-gray-700">{selectedDetailsBooking.adminPaymentStatus || "PENDING"}</span>
                </div>
                <div className="col-span-2 p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-indigo-800 uppercase text-[9px] block">Effective Payment Status</span>
                    <span className="text-sm font-black text-indigo-900">{selectedDetailsBooking.effectivePaymentStatus || "PENDING"}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-black ${
                    selectedDetailsBooking.effectivePaymentStatus === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {selectedDetailsBooking.effectivePaymentStatus === "PAID" ? "PAID" : "UNPAID"}
                  </span>
                </div>
                {selectedDetailsBooking.razorpayOrderId && (
                  <div className="col-span-2 bg-gray-50 p-2.5 rounded-lg text-[10px] font-semibold text-gray-650 space-y-1">
                    <p>Razorpay Order ID: <span className="font-mono text-gray-900 select-all">{selectedDetailsBooking.razorpayOrderId}</span></p>
                    {selectedDetailsBooking.razorpayPaymentId && (
                      <p>Razorpay Payment ID: <span className="font-mono text-gray-900 select-all">{selectedDetailsBooking.razorpayPaymentId}</span></p>
                    )}
                    {selectedDetailsBooking.paidAt && (
                      <p>Paid At: <span className="text-gray-900">{formatDateTime(selectedDetailsBooking.paidAt)}</span></p>
                    )}
                  </div>
                )}
                {selectedDetailsBooking.adminOverrideBy && (
                  <div className="col-span-2 bg-amber-50 border border-amber-150 p-3 rounded-lg text-[10px] text-amber-900">
                    <p className="font-bold">Manual override applied:</p>
                    <p className="mt-1">By: {selectedDetailsBooking.adminOverrideBy?.name || "Administrator"}</p>
                    {selectedDetailsBooking.adminOverrideAt && (
                      <p>At: {formatDateTime(selectedDetailsBooking.adminOverrideAt)}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Admin Payment Status Override Form */}
            {selectedDetailsBooking.playerType !== "COMPANY" && (
              <form onSubmit={handleOverrideSubmit} className="border-t pt-4 space-y-3">
                <h4 className="text-sm font-black text-[var(--primary)] flex items-center gap-1.5 text-amber-700">
                  <ShieldAlert size={16} />
                  <span>Manual Payment Status Override</span>
                </h4>
                
                {overrideError && <p className="text-xs font-black text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">{overrideError}</p>}
                {overrideSuccess && <p className="text-xs font-black text-emerald-600 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">{overrideSuccess}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-[10px] font-black uppercase text-gray-400">Target Status</span>
                    <select
                      value={overrideForm.newStatus}
                      onChange={(e) => setOverrideForm({ ...overrideForm, newStatus: e.target.value })}
                      className="h-10 border border-gray-200 rounded-xl px-3 text-xs font-bold outline-none"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="PAID">PAID</option>
                      <option value="FAILED">FAILED</option>
                      <option value="WAIVED">WAIVED</option>
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] font-black uppercase text-gray-400">Admin Password</span>
                    <input
                      type="password"
                      required
                      placeholder="Enter password to sign"
                      value={overrideForm.password}
                      onChange={(e) => setOverrideForm({ ...overrideForm, password: e.target.value })}
                      className="h-10 border border-gray-200 rounded-xl px-3 text-xs font-bold outline-none"
                    />
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Reason / Logs note</span>
                  <textarea
                    placeholder="Enter reason for override..."
                    value={overrideForm.reason}
                    onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                    className="h-16 border border-gray-200 rounded-xl p-3 text-xs font-bold outline-none resize-none"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submittingOverride}
                  className="w-full h-11 bg-amber-600 hover:opacity-95 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/10 active:scale-98"
                >
                  {submittingOverride ? "Verifying..." : "Apply Manual Override"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function RequestTable({
  requests,
  onProcess,
}: {
  requests: BookingRequest[];
  onProcess: (id: string, status: "APPROVED" | "REJECTED") => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] text-left text-sm">
        <thead>
          <tr className="border-b text-[var(--text-muted)]">
            <th className="py-3">Player</th>
            <th>Phone</th>
            <th>Game</th>
            <th>Current Time</th>
            <th>Requested Time</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {requests.map((request) => (
            <tr key={request._id} className="border-b last:border-0 hover:bg-gray-50/50">
              <td className="py-3 font-black text-[var(--primary)]">
                {request.userId?.name || "-"}
              </td>
              <td>{request.userId?.phone || "-"}</td>
              <td>{request.bookingId?.gameName || "-"}</td>
              <td>
                {formatDateTime(request.bookingId?.startTime)} -{" "}
                {formatDateTime(request.bookingId?.endTime)}
                {getEndSuffix(request.bookingId?.startTime, request.bookingId?.endTime)}
              </td>
              <td>
                {formatDateTime(request.requestedStartTime)} -{" "}
                {formatDateTime(request.requestedEndTime)}
                {getEndSuffix(request.requestedStartTime, request.requestedEndTime)}
              </td>
              <td>{request.reason || "-"}</td>
              <td>
                <span className={`rounded-full px-2 py-1 text-[11px] font-black ${
                  request.status === "PENDING" ? "bg-amber-100 text-amber-800" :
                  request.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
                  "bg-rose-100 text-rose-800"
                }`}>
                  {request.status}
                </span>
              </td>
              <td>
                {request.status === "PENDING" ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onProcess(request._id, "APPROVED")}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white active:scale-95 transition-all"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onProcess(request._id, "REJECTED")}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-black text-white active:scale-95 transition-all"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-gray-400">Processed</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {requests.length === 0 && (
        <p className="mt-5 text-sm font-bold text-[var(--text-muted)]">
          No requests found.
        </p>
      )}
    </div>
  );
}