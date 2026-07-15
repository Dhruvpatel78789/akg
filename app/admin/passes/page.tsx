"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, Search, Calendar, Clock, User, Phone, ShieldCheck, X, RefreshCw, Info } from "lucide-react";
import { formatToISTDate, formatToISTDateTimeString, formatToISTTime, parseIST } from "@/lib/time";

type Booking = {
  _id: string;
  userId?: {
    name: string;
    phone: string;
    email?: string;
  };
  gameId?: string;
  gameName: string;
  court: string;
  startTime: string;
  endTime: string;
  playersCount: number;
  price: number;
  coinCost?: number;
  paymentMode?: string;
  status: string;
  paymentMethod?: string;
  paymentStatus: string;
  effectivePaymentStatus: string;
  razorpayOrderId?: string;
};

type Game = {
  _id: string;
  name: string;
  duration: number;
  maximumDuration: number;
  fixedSlotBooking?: boolean;
};

export default function AdminPassesPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"passes" | "payments">("passes");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showOldPending, setShowOldPending] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Create Pass Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    phone: "",
    email: "",
    dob: "",
    gameId: "",
    court: "Court A",
    date: "",
    startTime: "",
    durationMinutes: 60,
    playersCount: 1,
    paymentMethod: "PAY_AT_COUNTER",
    paymentStatus: "PENDING",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  
  // Live clock synchronization states with server drift safety
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isTimeChangedByUser, setIsTimeChangedByUser] = useState(false);

  useEffect(() => {
    let drift = 0;
    fetch("/api/time")
      .then((res) => res.json())
      .then((data) => {
        if (data.serverTime) {
          drift = new Date(data.serverTime).getTime() - Date.now();
          setCurrentTime(new Date(Date.now() + drift));
        }
      })
      .catch((e) => console.error("Error syncing server time:", e));

    const timer = setInterval(() => {
      setCurrentTime(new Date(Date.now() + drift));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch current user & role details
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const canCreatePass = useMemo(() => {
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    const profile = user.roleProfile;
    if (!profile) return false;

    const perm = profile.permissions?.find((p: any) => p.section === "passes");
    if (!perm) return false;

    const subSectionsObj = perm.subSections instanceof Map
      ? Object.fromEntries(perm.subSections)
      : perm.subSections || {};

    return !!subSectionsObj.createPasses?.view || !!subSectionsObj.createPasses?.edit;
  }, [user]);

  async function loadData(isBackground = false) {
    if (!isBackground) setInitialLoading(true);
    else setRefreshing(true);

    try {
      const [passesRes, gamesRes] = await Promise.all([
        fetch("/api/admin/passes", { cache: "no-store" }),
        fetch("/api/games", { cache: "no-store" }),
      ]);

      const passesData = await passesRes.json();
      const gamesData = await gamesRes.json();

      if (passesRes.ok && passesData.success) {
        setBookings(passesData.bookings || []);
      }
      if (gamesRes.ok && gamesData.success) {
        setGames(gamesData.games || []);
        if (gamesData.games?.length > 0 && !createForm.gameId) {
          setCreateForm((prev) => ({ ...prev, gameId: gamesData.games[0]._id }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const getPassStatus = (booking: Booking) => {
    const isPaid = booking.effectivePaymentStatus === "PAID" || booking.paymentStatus === "PAID";
    const now = new Date();
    const startTime = new Date(booking.startTime);
    const endTime = new Date(booking.endTime);

    if (booking.status === "CANCELLED") return "CANCELLED";
    if (booking.status === "COMPLETED") return "COMPLETED";

    if (!isPaid) {
      if (booking.paymentStatus === "FAILED") {
        return "FAILED";
      }
      return "PENDING_PAYMENT";
    }

    if (booking.status === "STARTED") {
      if (now > endTime) {
        return "OVERTIME";
      }
      return "ACTIVE";
    }

    if (booking.status === "BOOKED") {
      if (startTime > now) {
        return "ADVANCE";
      }
      return "ACTIVE";
    }

    return booking.status;
  };

  const processedBookings = useMemo(() => {
    return bookings.map((b) => ({
      ...b,
      derivedStatus: getPassStatus(b),
    }));
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const now = new Date();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    let result = processedBookings.filter((b) => {
      const term = searchQuery.toLowerCase();
      const matchesSearch =
        b.userId?.name?.toLowerCase().includes(term) ||
        b.userId?.phone?.includes(term) ||
        b.gameName?.toLowerCase().includes(term) ||
        b.court?.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      const isPassTabStatus = ["ADVANCE", "ACTIVE", "OVERTIME"].includes(b.derivedStatus);

      // Passes & Sessions (Active & Upcoming) tab
      if (activeTab === "passes") {
        if (!isPassTabStatus) return false;
        // Don't display completed entries (where endTime is in the past, or booking status is COMPLETED)
        if (new Date(b.endTime) < now || b.status === "COMPLETED" || b.derivedStatus === "COMPLETED") {
          return false;
        }
      }

      // Payments & History tab
      if (activeTab === "payments") {
        if (b.status === "COMPLETED" || b.derivedStatus === "COMPLETED" || b.status === "CANCELLED" || b.derivedStatus === "CANCELLED") {
          return false;
        }
        if (new Date(b.endTime) < now) {
          return false;
        }

        const isCompletedPass = isPassTabStatus && (new Date(b.endTime) < now || b.status === "COMPLETED" || b.derivedStatus === "COMPLETED");
        if (isPassTabStatus && !isCompletedPass) return false;

        // Hide pending payment entries of 2 days back unless showOldPending is true
        if (b.derivedStatus === "PENDING_PAYMENT") {
          const bookingTime = new Date(b.startTime);
          if (bookingTime < twoDaysAgo && !showOldPending) {
            return false;
          }
        }
      }

      if (statusFilter !== "ALL" && b.derivedStatus !== statusFilter) return false;

      return true;
    });

    // Date-wise sorting: Today's passes on top.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    result.sort((a, b) => {
      const aTime = new Date(a.startTime).getTime();
      const bTime = new Date(b.startTime).getTime();

      const aIsToday = aTime >= todayStart.getTime() && aTime <= todayEnd.getTime();
      const bIsToday = bTime >= todayStart.getTime() && bTime <= todayEnd.getTime();

      if (aIsToday && !bIsToday) return -1;
      if (!aIsToday && bIsToday) return 1;

      // Otherwise sort:
      // Active/upcoming passes tab -> ascending order (closest times first)
      // Payments history tab -> descending order (most recent first)
      if (activeTab === "passes") {
        return aTime - bTime;
      } else {
        return bTime - aTime;
      }
    });

    return result;
  }, [processedBookings, activeTab, searchQuery, statusFilter, showOldPending]);

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validationError) {
      alert(validationError);
      return;
    }
    setIsSubmitting(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessage("Pass created successfully!");
        setShowCreateModal(false);
        sessionStorage.removeItem("adminBookingDraft");
        loadData();
        setCreateForm({
          name: "",
          phone: "",
          email: "",
          dob: "",
          gameId: games[0]?._id || "",
          court: "Court A",
          date: new Date().toLocaleDateString("en-CA"),
          startTime: "12:00",
          durationMinutes: 60,
          playersCount: 1,
          paymentMethod: "PAY_AT_COUNTER",
          paymentStatus: "PENDING",
        });
        setIsTimeChangedByUser(false);
      } else {
        alert(data.message || "Failed to create pass");
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred while creating pass.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedGame = useMemo(() => {
    return games.find((g) => g._id === createForm.gameId) || null;
  }, [games, createForm.gameId]);

  const isPastTime = useMemo(() => {
    if (!createForm.date || !createForm.startTime) return false;
    const bookingStart = parseIST(createForm.date, createForm.startTime);
    return bookingStart.getTime() < currentTime.getTime() - 2 * 60 * 1000;
  }, [createForm.date, createForm.startTime, currentTime]);

  // Synchronize startTime live to current time / nearest slot
  useEffect(() => {
    if (isTimeChangedByUser) return;
    const todayStr = formatToISTDate(currentTime);
    const targetDate = createForm.date || todayStr;
    if (targetDate === todayStr) {
      let nextStart = "";
      if (selectedGame?.fixedSlotBooking) {
        const minDur = selectedGame.duration || 60;
        const timeStr = formatToISTTime(currentTime);
        const [currentHours, currentMinutes] = timeStr.split(":").map(Number);
        const totalMinutes = currentHours * 60 + currentMinutes;
        const remainder = totalMinutes % minDur;
        const nextSlotMinutes = totalMinutes + (minDur - remainder);
        const finalMinutes = nextSlotMinutes >= 1440 ? 0 : nextSlotMinutes;
        
        const h = Math.floor(finalMinutes / 60);
        const m = finalMinutes % 60;
        nextStart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      } else {
        nextStart = formatToISTTime(currentTime);
      }
      if (createForm.startTime !== nextStart) {
        setCreateForm((prev) => ({ ...prev, startTime: nextStart }));
      }
    }
  }, [currentTime, createForm.date, selectedGame, isTimeChangedByUser, createForm.startTime]);

  // Validate start time is not in past
  useEffect(() => {
    if (createForm.date && createForm.startTime) {
      if (isPastTime && isTimeChangedByUser) {
        setValidationError("Selected start time is now in the past. Please choose a future time.");
      } else {
        setValidationError("");
      }
    }
  }, [isPastTime, isTimeChangedByUser, createForm.date, createForm.startTime]);

  // Load draft on mount
  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA");
    setCreateForm((prev) => ({ ...prev, date: today }));

    try {
      const saved = sessionStorage.getItem("adminBookingDraft");
      if (saved) {
        const draft = JSON.parse(saved);
        setCreateForm((prev) => ({
          ...prev,
          name: draft.name || "",
          phone: draft.phone || "",
          email: draft.email || "",
          dob: draft.dob || "",
          gameId: draft.gameId || prev.gameId,
          court: draft.court || "Court A",
          date: draft.date || today,
          startTime: draft.startTime || "",
          durationMinutes: draft.durationMinutes || 60,
          playersCount: draft.playersCount || 1,
          paymentMethod: draft.paymentMethod || "PAY_AT_COUNTER",
          paymentStatus: draft.paymentStatus || "PENDING",
        }));
        setIsTimeChangedByUser(true);
        setShowCreateModal(true);
      }
    } catch (e) {
      console.error("Error restoring admin booking draft:", e);
    }
  }, [games]);

  // Autosave draft details
  useEffect(() => {
    if (createForm.name || createForm.phone || createForm.email) {
      sessionStorage.setItem("adminBookingDraft", JSON.stringify(createForm));
    }
  }, [createForm]);

  // Helper parser
  function parseIST(dateStr: string, timeStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hr, min] = timeStr.split(":").map(Number);
    return new Date(y, m - 1, d, hr, min);
  }

  const getStatusBadgeStyle = (derivedStatus: string) => {
    switch (derivedStatus) {
      case "ADVANCE":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "ACTIVE":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "OVERTIME":
        return "bg-rose-100 text-rose-800 border-rose-250 animate-pulse";
      case "PENDING_PAYMENT":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "FAILED":
        return "bg-red-100 text-red-800 border-red-200";
      case "CANCELLED":
        return "bg-gray-150 text-gray-700 border-gray-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getCardStyle = (derivedStatus: string) => {
    switch (derivedStatus) {
      case "ADVANCE":
        return "border-l-[8px] border-blue-500 bg-blue-50/30 hover:shadow-blue-100/50 shadow-md";
      case "ACTIVE":
        return "border-l-[8px] border-emerald-500 bg-emerald-50/30 hover:shadow-emerald-100/50 shadow-md";
      case "OVERTIME":
        return "border-l-[8px] border-rose-500 bg-rose-50/50 hover:shadow-rose-100/50 shadow-lg ring-2 ring-rose-500/20";
      case "PENDING_PAYMENT":
        return "border-l-[8px] border-amber-500 bg-amber-50/30 hover:shadow-amber-100/50 shadow-md";
      case "FAILED":
        return "border-l-[8px] border-red-500 bg-red-50/10 shadow-sm";
      default:
        return "border-l-[8px] border-gray-400 bg-gray-50/55 shadow-sm";
    }
  };

  return (
    <section className="min-w-0 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[var(--primary)] flex items-center gap-3">
            Passes & Sessions
            {refreshing && <RefreshCw size={20} className="animate-spin text-gray-400" />}
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-bold text-[var(--text-muted)]">
            Create, display, and manage mobile-friendly visitor passes and check-ins.
          </p>
        </div>

        {canCreatePass && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-full bg-[var(--primary)] px-6 py-3 text-xs sm:text-sm font-black text-white hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 w-full md:w-auto"
          >
            <Plus size={16} />
            Create Pass
          </button>
        )}
      </div>

      {/* Tabs - 2-Column Grid to avoid horizontal scrolling */}
      <div className="mt-6 grid grid-cols-2 gap-2 border-b pb-1.5 w-full">
        <button
          onClick={() => {
            setActiveTab("passes");
            setStatusFilter("ALL");
          }}
          className={`py-3 text-center text-xs sm:text-sm font-black border-b-2 transition-all ${
            activeTab === "passes"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-gray-400 hover:text-gray-650"
          }`}
        >
          Active & Upcoming
        </button>
        <button
          onClick={() => {
            setActiveTab("payments");
            setStatusFilter("ALL");
          }}
          className={`py-3 text-center text-xs sm:text-sm font-black border-b-2 transition-all ${
            activeTab === "payments"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-gray-400 hover:text-gray-650"
          }`}
        >
          Payments & History
        </button>
      </div>

      {/* Search & Status Filters */}
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-4 rounded-2xl shadow-sm ring-1 ring-black/5">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by player, phone, game, court..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-xl bg-gray-50 pl-10 pr-4 text-xs font-bold outline-none border border-gray-200 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition"
          />
          <Search size={15} className="absolute left-3.5 top-3 text-gray-400" />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl bg-gray-50 px-3 text-xs font-bold border border-gray-200 outline-none cursor-pointer w-full sm:w-auto"
          >
            <option value="ALL">All Statuses</option>
            {activeTab === "passes" ? (
              <>
                <option value="ADVANCE">Advance Bookings</option>
                <option value="ACTIVE">Active Sessions</option>
                <option value="OVERTIME">Overtime Sessions</option>
              </>
            ) : (
              <>
                <option value="PENDING_PAYMENT">Pending Payments</option>
                <option value="FAILED">Failed Payments</option>
              </>
            )}
          </select>

          {activeTab === "payments" && (
            <button
              onClick={() => setShowOldPending(!showOldPending)}
              title={showOldPending ? "Hide older pending payments" : "Show older pending payments (older than 2 days)"}
              className={`h-10 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-black transition-all cursor-pointer ${
                showOldPending 
                  ? "bg-blue-50 border-blue-200 text-blue-600" 
                  : "bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-650"
              }`}
            >
              <Info size={16} />
              <span>{showOldPending ? "Showing Old Pending" : "Show Old Pending"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid view for passes (responsive card layout) */}
      <div className="mt-6">
        {initialLoading ? (
          <p className="py-10 text-center text-sm font-bold text-[var(--text-muted)] animate-pulse">
            Loading passes...
          </p>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl shadow-sm ring-1 ring-black/5">
            <Calendar size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-xs sm:text-sm font-black text-gray-500">No bookings or passes found matching parameters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredBookings.map((b) => (
              <div
                key={b._id}
                className={`rounded-2xl border border-gray-150 p-4 sm:p-5 transition-all space-y-4 overflow-hidden ${getCardStyle(b.derivedStatus)}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h4 className="font-black text-base sm:text-lg text-[var(--primary)] truncate">{b.userId?.name || "-"}</h4>
                    <p className="text-[10px] sm:text-xs text-gray-500 font-bold">{b.userId?.phone || "-"}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase border shrink-0 ${getStatusBadgeStyle(b.derivedStatus)}`}>
                    {b.derivedStatus.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[10px] sm:text-xs font-bold border-t pt-3 border-black/5">
                  <div>
                    <span className="text-[9px] sm:text-[10px] uppercase text-gray-400 font-black">Sport / Game</span>
                    <p className="text-xs sm:text-sm text-[var(--primary)] font-black truncate">{b.gameName}</p>
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-[10px] uppercase text-gray-400 font-black">Court</span>
                    <p className="text-xs sm:text-sm text-[var(--primary)] font-black truncate">{b.court}</p>
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-[10px] uppercase text-gray-400 font-black">Date</span>
                    <p className="text-xs sm:text-sm text-[var(--primary)] font-black">{formatToISTDate(b.startTime)}</p>
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-[10px] uppercase text-gray-400 font-black">Time Slot</span>
                    <p className="text-xs sm:text-sm text-[var(--primary)] font-black truncate">
                      {formatToISTDateTimeString(b.startTime).split(",")[1]?.trim()} - {formatToISTDateTimeString(b.endTime).split(",")[1]?.trim()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-[10px] uppercase text-gray-400 font-black">Details</span>
                    <p className="text-xs sm:text-sm text-[var(--primary)] font-black truncate">
                      {b.playersCount} Players / {Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000)}m
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-[10px] uppercase text-gray-400 font-black">
                      {(b.coinCost ?? 0) > 0 || b.paymentMode === "coins" ? "Paid by Coin" : "Total Cost"}
                    </span>
                    <p className="text-xs sm:text-sm text-rose-600 font-black">
                      {(b.coinCost ?? 0) > 0 || b.paymentMode === "coins" ? `${b.coinCost} Coins` : `₹${b.price}`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pass Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up max-h-[90vh] flex flex-col">
            <header className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-base sm:text-lg font-black text-[var(--primary)]">Create Visitor Pass</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="h-8 w-8 rounded-full bg-white flex items-center justify-center border shadow-sm text-gray-400 hover:text-gray-650 cursor-pointer"
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div>
                <h4 className="text-[10px] sm:text-xs font-black uppercase text-gray-400 tracking-wider mb-2">Player Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500">Player Name</span>
                    <input
                      type="text"
                      required
                      placeholder="Enter full name"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      className="h-10 rounded-xl bg-gray-50 px-3 text-xs font-semibold border border-gray-200 outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500">Phone Number</span>
                    <input
                      type="tel"
                      required
                      placeholder="10-digit mobile"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      className="h-10 rounded-xl bg-gray-50 px-3 text-xs font-semibold border border-gray-200 outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500">Email Address (Optional)</span>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      className="h-10 rounded-xl bg-gray-50 px-3 text-xs font-semibold border border-gray-200 outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500">Birthdate (Optional)</span>
                    <input
                      type="date"
                      value={createForm.dob}
                      onChange={(e) => setCreateForm({ ...createForm, dob: e.target.value })}
                      className="h-10 rounded-xl bg-gray-50 px-3 text-xs font-semibold border border-gray-200 outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-[10px] sm:text-xs font-black uppercase text-gray-400 tracking-wider mb-2">Session Settings</h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500">Game / Sport</span>
                    <select
                      value={createForm.gameId}
                      onChange={(e) => setCreateForm({ ...createForm, gameId: e.target.value })}
                      className="h-10 rounded-xl bg-gray-50 px-2 text-xs font-semibold border border-gray-200 outline-none cursor-pointer"
                    >
                      {games.map((g) => (
                        <option key={g._id} value={g._id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500">Court</span>
                    <input
                      type="text"
                      required
                      value={createForm.court}
                      onChange={(e) => setCreateForm({ ...createForm, court: e.target.value })}
                      className="h-10 rounded-xl bg-gray-50 px-3 text-xs font-semibold border border-gray-200 outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500">Date</span>
                    <input
                      type="date"
                      required
                      value={createForm.date}
                      onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
                      className="h-10 rounded-xl bg-gray-50 px-3 text-xs font-semibold border border-gray-200 outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500">Start Time</span>
                    <input
                      type="time"
                      required
                      value={createForm.startTime}
                      onChange={(e) => {
                        setCreateForm({ ...createForm, startTime: e.target.value });
                        setIsTimeChangedByUser(true);
                      }}
                      onClick={() => setIsTimeChangedByUser(true)}
                      onFocus={() => setIsTimeChangedByUser(true)}
                      className="h-10 rounded-xl bg-gray-50 px-3 text-xs font-semibold border border-gray-200 outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500">Duration (Minutes)</span>
                    <input
                      type="number"
                      required
                      min={15}
                      step={15}
                      value={createForm.durationMinutes}
                      onChange={(e) => setCreateForm({ ...createForm, durationMinutes: Number(e.target.value) })}
                      className="h-10 rounded-xl bg-gray-50 px-3 text-xs font-semibold border border-gray-200 outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500">Players Count</span>
                    <input
                      type="number"
                      required
                      min={1}
                      value={createForm.playersCount}
                      onChange={(e) => setCreateForm({ ...createForm, playersCount: Number(e.target.value) })}
                      className="h-10 rounded-xl bg-gray-50 px-3 text-xs font-semibold border border-gray-200 outline-none focus:border-[var(--primary)]"
                    />
                  </label>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-[10px] sm:text-xs font-black uppercase text-gray-400 tracking-wider mb-2">Payment Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500">Payment Mode</span>
                    <select
                      value={createForm.paymentMethod}
                      onChange={(e) => setCreateForm({ ...createForm, paymentMethod: e.target.value })}
                      className="h-10 rounded-xl bg-gray-50 px-2 text-xs font-semibold border border-gray-200 outline-none cursor-pointer"
                    >
                      <option value="PAY_AT_COUNTER">Pay at Counter</option>
                      <option value="RAZORPAY">Razorpay (Online)</option>
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500">Payment Status</span>
                    <select
                      value={createForm.paymentStatus}
                      onChange={(e) => setCreateForm({ ...createForm, paymentStatus: e.target.value })}
                      className="h-10 rounded-xl bg-gray-50 px-2 text-xs font-semibold border border-gray-200 outline-none cursor-pointer"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="PAID">Paid</option>
                    </select>
                  </label>
                </div>
              </div>

              {validationError && (
                <p className="text-xs font-bold text-red-500 rounded-xl bg-red-50 p-3">
                  {validationError}
                </p>
              )}

              <footer className="border-t pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-black border border-gray-200 text-gray-650 rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !!validationError}
                  className="px-5 py-2 text-xs font-black bg-[var(--primary)] text-white rounded-xl shadow-md active:scale-98 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck size={14} />
                  {isSubmitting ? "Creating..." : "Save Booking"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
