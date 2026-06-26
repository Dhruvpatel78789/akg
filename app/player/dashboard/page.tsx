// app/player/dashboard/page.tsx

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock3,
  Home,
  MapPin,
  Timer,
  Wallet,
  Coins,
  AlertCircle,
} from "lucide-react";
import jsQR from "jsqr";

type DashboardUser = {
  _id?: string;
  name: string;
  coins: number;
  dailyCoinSpendLimit: number;
  coinPlanExpiryDate?: string;
  totalCoinsInCycle?: number;
  canRescheduleFixedMembership?: boolean;
  phone?: string;
  email?: string;
  coinsAvailable?: number;
  coinsFrozen?: number;
};

type Booking = {
  _id: string;
  gameId?: {
    _id?: string;
    name?: string;
    bufferMinutes?: number;
    duration?: number;
    fixedSlotBooking?: boolean;
  };
  gameName?: string;
  court?: string;
  startTime?: string;
  endTime?: string;
  exitedTime?: string;
  status?: string;
  coinCost?: number;
  price?: number;
  rescheduled?: boolean;
  autoEnded?: boolean;
  additionalCharge?: {
    amount: number;
    reason: string;
    status: string;
    settledAt?: string;
  } | null;
};

type Membership = {
  _id: string;
  gameName?: string;
  membershipType?: "FIXED" | "FLEXIBLE" | "COINS";
  durationLabel?: string;
  status?: string;
  startDate?: string;
  createdAt?: string;
  totalDays?: number;
  days?: number;
  months?: number;
  startTime?: string;
  endTime?: string;
  price?: number;
};

type DashboardData = {
  user: DashboardUser;
  activeFixed: Membership | null;
  activeCoins: Membership | null;
  membershipDaysLeft: number;
  activeSession: Booking | null;
  activeSessions?: Booking[];
  todayUpcomingSessions: Booking[];
  calendarSessions: Booking[];
  playHistory: Booking[];
  totalPlaySeconds: number;
  currentPlaySeconds: number;
  serverTime?: string;
  pendingRescheduleRequestCount?: number;
  pendingCancellationRequestCount?: number;
  todayCoinsUsed?: number;
};

type CalendarDay = {
  id: string;
  date: number;
  monthOffset: -1 | 0 | 1;
  dateKey: string;
  hasSession: boolean;
  game?: string;
  time?: string;
  bookingIndicators: ("FIXED" | "COIN" | "ADVANCED" | "RESCHEDULED")[];
};

// Hardcoded promotions removed. Managed via Admin Panel.

function HamburgerIcon() {
  return (
    <div className="flex h-8 w-8 flex-col items-end justify-center gap-1.5">
      <span className="h-0.5 w-7 rounded-full bg-[var(--primary)]" />
      <span className="h-0.5 w-5 rounded-full bg-[var(--primary)]" />
      <span className="h-0.5 w-3 rounded-full bg-[var(--primary)]" />
    </div>
  );
}

function formatSeconds(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}
import {
  formatToISTDate,
  formatToISTTime,
  formatToISTDateTimeString,
  getBookingDisplayStatus,
} from "@/lib/time";

function formatTime(value?: string) {
  return formatToISTTime(value);
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

function formatDate(value?: string) {
  if (!value) return "";
  return formatToISTDateTimeString(value).split(",")[0];
}

function formatDateWithYear(value?: string) {
  if (!value) return "-";
  const dateStr = formatToISTDate(value);
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  const monthLabel = new Date(Number(y), Number(m) - 1, Number(d)).toLocaleString("en-IN", { month: "short" });
  return `${d} ${monthLabel} ${y}`;
}

function formatDateStr(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const monthLabel = new Date(Number(y), Number(m) - 1, Number(d)).toLocaleString("en-IN", { month: "short" });
  return `${d} ${monthLabel} ${y}`;
}

function FlipUnit({ value }: { value: string }) {
  return (
    <span
      key={value}
      className="animate-[flip_0.45s_ease-in-out] text-5xl font-black tabular-nums leading-none text-[var(--primary)]"
    >
      {value}
    </span>
  );
}

function toDateKey(date: Date) {
  return formatToISTDate(date);
}

function getCalendar(calendarSessions: Booking[]) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDate = now.getDate();

  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const createCalendarDay = (date: number, monthOffset: -1 | 0 | 1, idPrefix: string): CalendarDay => {
    const d = new Date(year, month + monthOffset, date);
    const dateKey = toDateKey(d);
    const matching = calendarSessions.filter((session) => {
      if (!session.startTime) return false;
      return toDateKey(new Date(session.startTime)) === dateKey;
    });

    // Classify booking types
    const indicators: ("FIXED" | "COIN" | "ADVANCED" | "RESCHEDULED")[] = [];
    matching.forEach((session) => {
      if (session.rescheduled) {
        indicators.push("RESCHEDULED");
      } else if (session.coinCost && session.coinCost > 0) {
        indicators.push("COIN");
      } else if (session.price && session.price > 0) {
        indicators.push("ADVANCED");
      } else {
        // Free / Fixed Booking under membership
        indicators.push("FIXED");
      }
    });

    return {
      id: `${idPrefix}-${date}`,
      date,
      monthOffset,
      dateKey,
      hasSession: matching.length > 0,
      game: matching[0]?.gameName,
      time: matching[0]?.startTime ? formatTime(matching[0].startTime) : undefined,
      bookingIndicators: indicators,
    };
  };

  const previousDays: CalendarDay[] = Array.from(
    { length: startOffset },
    (_, index) => {
      const date = previousMonthDays - startOffset + index + 1;
      return createCalendarDay(date, -1, "prev");
    }
  );

  const currentDays: CalendarDay[] = Array.from(
    { length: totalDays },
    (_, index) => {
      const date = index + 1;
      return createCalendarDay(date, 0, "current");
    }
  );

  const filledCount = previousDays.length + currentDays.length;
  const nextDaysNeeded = Math.ceil(filledCount / 7) * 7 - filledCount;

  const nextDays: CalendarDay[] = Array.from(
    { length: nextDaysNeeded },
    (_, index) => {
      const date = index + 1;
      return createCalendarDay(date, 1, "next");
    }
  );

  const allDays = [...previousDays, ...currentDays, ...nextDays];

  const todayIndex = allDays.findIndex(
    (day) => day.monthOffset === 0 && day.date === todayDate
  );

  const weekStartIndex = Math.floor(Math.max(0, todayIndex) / 7) * 7;

  return {
    monthName: now.toLocaleString("default", {
      month: "long",
      year: "numeric",
    }),
    days: allDays,
    weekDays: allDays.slice(weekStartIndex, weekStartIndex + 7),
  };
}

export default function PlayerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePromo, setActivePromo] = useState(0);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [localCurrentSeconds, setLocalCurrentSeconds] = useState(0);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingCharges, setPendingCharges] = useState<any[]>([]);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);
  
  // Notifications states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"notifications" | "payments">("notifications");
  const [notifExpanded, setNotifExpanded] = useState(false);

  // Expanded play history records trackers
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<string[]>([]);

  // Custom QR Exit Scanner state
  const [showQrScanModal, setShowQrScanModal] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  // Custom Reschedule modal state
  const [reschedulingSession, setReschedulingSession] = useState<Booking | null>(null);
  const [rescheduleStartTime, setRescheduleStartTime] = useState("");
  const [rescheduleEndTime, setRescheduleEndTime] = useState("");
  const [rescheduleError, setRescheduleError] = useState("");

  // Custom Cancel modal state
  const [cancellingSession, setCancellingSession] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");

  const [rescheduleValidationError, setRescheduleValidationError] = useState("");
  const [cancelValidationError, setCancelValidationError] = useState("");

  useEffect(() => {
    if (!reschedulingSession || !reschedulingSession.startTime) {
      setRescheduleValidationError("");
      return;
    }
    if (!rescheduleStartTime) {
      setRescheduleValidationError("Please select a new start time.");
      return;
    }
    const sessionDate = new Date(reschedulingSession.startTime);
    const today = new Date();
    if (sessionDate.toDateString() === today.toDateString()) {
      const [h, m] = rescheduleStartTime.split(":").map(Number);
      const chosenTime = new Date(sessionDate);
      chosenTime.setHours(h, m, 0, 0);
      if (chosenTime.getTime() < today.getTime() - 5 * 60 * 1000) {
        setRescheduleValidationError("Cannot reschedule to a past time.");
        return;
      }
    }
    setRescheduleValidationError("");
  }, [rescheduleStartTime, reschedulingSession]);

  useEffect(() => {
    if (!cancellingSession) {
      setCancelValidationError("");
      return;
    }
    if (cancelReason && cancelReason.trim().length < 3) {
      setCancelValidationError("Reason must be at least 3 characters.");
      return;
    }
    setCancelValidationError("");
  }, [cancelReason, cancellingSession]);

  async function loadNotifications() {
    try {
      const res = await fetch("/api/player/notifications");
      const data = await res.json();
      if (res.ok && data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  }

  async function handleClearNotification(id: string) {
    try {
      const res = await fetch(`/api/player/notifications/${id}/clear`, {
        method: "PATCH",
      });
      if (res.ok) {
        loadNotifications();
      }
    } catch (err) {
      console.error("Failed to clear notification", err);
    }
  }

  async function handleClearAllNotifications() {
    try {
      const res = await fetch(`/api/player/notifications/clear-all`, {
        method: "PATCH",
      });
      if (res.ok) {
        loadNotifications();
      }
    } catch (err) {
      console.error("Failed to clear all notifications", err);
    }
  }

  async function loadPendingCharges() {
    try {
      const res = await fetch("/api/player/pending-payments");
      const data = await res.json();
      if (res.ok && data.success) {
        setPendingCharges(data.charges || []);
      }
    } catch (err) {
      console.error("Failed to load pending charges", err);
    }
  }

  async function handlePayCharge(charge: any) {
    if (!charge) return;
    setScanMessage("Creating payment order...");
    try {
      const createOrderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: charge.amount,
          purpose: "ADDITIONAL_CHARGE",
          userId: data?.user?._id,
          metadata: { chargeId: charge._id },
        }),
      });

      const orderData = await createOrderRes.json();
      if (!createOrderRes.ok || !orderData.success) {
        setScanMessage(orderData.message || "Failed to create payment order");
        return;
      }

      // Check if it's a mock payment (fallback)
      if (orderData.orderId.startsWith("order_mock_")) {
        const verifyRes = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpayOrderId: orderData.orderId,
            razorpayPaymentId: "pay_mock_" + Math.random().toString(36).substring(2, 10),
            razorpaySignature: "mock_signature_bypass",
          }),
        });

        const verifyData = await verifyRes.json();
        if (verifyRes.ok && verifyData.success) {
          setScanMessage("Payment completed successfully (Mock Gateway)!");
          loadPendingCharges();
          loadNotifications();
          loadDashboard();
        } else {
          setScanMessage(verifyData.message || "Mock payment verification failed");
        }
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Akshar Game Zone",
        description: `Pay Additional Charge`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            setScanMessage("Verifying payment...");
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              setScanMessage("Payment verified successfully!");
              loadPendingCharges();
              loadNotifications();
              loadDashboard();
            } else {
              setScanMessage("Payment verification failed.");
            }
          } catch (err) {
            setScanMessage("Payment verification failed.");
          }
        },
        modal: {
          ondismiss: function () {
            setScanMessage("Payment cancelled.");
          },
        },
        prefill: {
          name: data?.user?.name || "",
          contact: data?.user?.phone || "",
          email: data?.user?.email || "",
        },
        theme: {
          color: "#03210f",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error(err);
      setScanMessage(err.message || "Payment processing failed");
    }
  }

  useEffect(() => {
    loadPendingCharges();
    loadNotifications();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  async function loadDashboard() {
    try {
      const response = await fetch("/api/player/dashboard", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/auth/login");
        return;
      }
      if (response.status === 403) {
        router.replace("/");
        return;
      }
      const result = await response.json();
      if (!result || !result.user) {
        router.replace("/auth/login");
        return;
      }

      // Visitor guard check: redirect inactive visitors to homepage
      if (result.user && result.user.role === "VISITOR") {
        const hasActiveSession = !!result.activeSession;
        const hasUpcomingBooking = (result.calendarSessions || []).some((s: any) => s.status === "BOOKED");
        if (!hasActiveSession && !hasUpcomingBooking) {
          if (!hasCheckedSession) {
            setHasCheckedSession(true);
            router.replace("/");
            return;
          }
        } else {
          setHasCheckedSession(true);
        }
      } else {
        setHasCheckedSession(true);
      }

      setData(result);
      setLocalCurrentSeconds(result.currentPlaySeconds || 0);

      const cal = getCalendar(result.calendarSessions || []);
      const todayKey = toDateKey(new Date());
      const todayItem = cal.weekDays.find((item) => item.dateKey === todayKey);
      
      setSelectedDay((prev) => {
        if (prev) {
          const found = cal.weekDays.find(d => d.dateKey === prev.dateKey);
          if (found) return found;
        }
        return todayItem ??
          cal.weekDays.find((item) => item.hasSession) ??
          cal.weekDays[0] ?? null;
      });

      setLoading(false);
    } catch {
      router.replace("/auth/login");
    }
  }

  useEffect(() => {
    loadDashboard();
    fetch("/api/promotions?placement=PLAYER_DASHBOARD_TOP")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.promotions) {
          setPromotions(data.promotions);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (promotions.length === 0) return;
    const timer = setInterval(() => {
      setActivePromo((prev) => (prev + 1) % promotions.length);
    }, 2500);

    return () => clearInterval(timer);
  }, [promotions]);

  const [localActiveSeconds, setLocalActiveSeconds] = useState<number[]>([]);

  // Synchronize local active seconds timers when data updates
  useEffect(() => {
    if (data?.activeSessions) {
      const now = new Date();
      setLocalActiveSeconds(
        data.activeSessions.map((session: any) => {
          return session.startTime
            ? Math.max(0, Math.floor((now.getTime() - new Date(session.startTime).getTime()) / 1000))
            : 0;
        })
      );
    } else {
      setLocalActiveSeconds([]);
    }
  }, [data?.activeSessions]);

  // Live timer tick for all active sessions
  useEffect(() => {
    if (!data?.activeSessions || data.activeSessions.length === 0) return;

    const timer = setInterval(() => {
      setLocalActiveSeconds((prev) => prev.map((s) => s + 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [data?.activeSessions]);

  const calendar = useMemo(
    () => getCalendar(data?.calendarSessions ?? []),
    [data?.calendarSessions]
  );

  const selectedDayDate = useMemo(() => {
    if (!selectedDay) return null;
    const [y, m, d] = selectedDay.dateKey.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDay]);

  const formattedSelectedDate = selectedDay?.dateKey || "";

  const selectedDaySessions = (!selectedDay || !data?.calendarSessions)
    ? []
    : data.calendarSessions.filter((session) => {
        if (!session.startTime) return false;
        return toDateKey(new Date(session.startTime)) === selectedDay.dateKey;
      });

  const fixedMembershipSession = useMemo(() => {
    if (
      !data?.activeFixed ||
      data.activeFixed.membershipType !== "FIXED" ||
      !selectedDayDate
    ) {
      return null;
    }

    const membership = data.activeFixed;
    const createdAt = new Date(membership.createdAt || data.serverTime || new Date()).getTime();
    const totalDays =
      membership.totalDays || ((membership.months || 0) * 30 + (membership.days || 0));

    const expiry = createdAt + totalDays * 24 * 60 * 60 * 1000;
    const time = selectedDayDate.getTime();

    const startOfPurchaseDay = new Date(createdAt);
    startOfPurchaseDay.setHours(0, 0, 0, 0);

    if (time >= startOfPurchaseDay.getTime() && time <= expiry) {
      const formatTimeSlot = (dStr?: string) => {
        if (!dStr) return "";
        return new Date(dStr).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        });
      };
      return {
        gameName: membership.gameName,
        time: `${formatTimeSlot(membership.startTime)} - ${formatTimeSlot(membership.endTime)}`,
      };
    }

    return null;
  }, [data, selectedDayDate]);

  const selectedDayFixedBooking = useMemo(() => {
    if (!data?.activeFixed || !selectedDay) return null;
    return (data.calendarSessions || []).find(session => {
      if (!session.startTime) return false;
      const isSameDay = toDateKey(new Date(session.startTime)) === selectedDay.dateKey;
      const isFixedBooking = session.price === 0 && session.coinCost === 0 && session.gameName === data?.activeFixed?.gameName;
      return isSameDay && isFixedBooking;
    });
  }, [data, selectedDay]);

  if (loading || !data || !selectedDay) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-4">
        <p className="font-black text-[var(--primary)]">Loading dashboard...</p>
      </main>
    );
  }

  if (!data?.user) {
    router.replace("/auth/login");
    return null;
  }

  const liveActiveTotalSeconds = localActiveSeconds.reduce((a, b) => a + b, 0);
  const serverActiveSeconds = (data.activeSessions || []).map((session: any) => {
    return session.startTime
      ? Math.max(0, Math.floor((new Date(data.serverTime || new Date()).getTime() - new Date(session.startTime).getTime()) / 1000))
      : 0;
  }).reduce((a: number, b: number) => a + b, 0);

  const totalTime = formatSeconds(
    data.totalPlaySeconds - serverActiveSeconds + liveActiveTotalSeconds
  );

  const currentTime = formatSeconds(localCurrentSeconds);

  const visibleCalendarDays = showFullCalendar
    ? calendar.days
    : calendar.weekDays;

  return (
    <main
      onClick={() => setShowHistory(false)}
      className={`min-h-screen bg-[var(--background)] px-4 py-4 ${data?.activeSession ? 'pb-28' : 'pb-6'}`}
    >
      <style jsx global>{`
        @keyframes flip {
          0% {
            transform: rotateX(90deg);
            opacity: 0.35;
          }
          100% {
            transform: rotateX(0deg);
            opacity: 1;
          }
        }
      `}</style>

      <section className="mx-auto w-full max-w-md md:max-w-2xl lg:max-w-4xl">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black text-[var(--primary)]">Hi!</p>
            <h1 className="text-3xl font-black leading-none text-[var(--primary)]">
              {data.user.name}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
            >
              <Home size={23} className="text-[var(--primary)]" />
            </Link>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
              >
                <HamburgerIcon />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-14 z-50 w-52 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-black/5">
                  <nav className="grid gap-1">
                    <Link
                      href="/player/dashboard"
                      className="block rounded-xl px-4 py-2.5 text-sm font-black text-[var(--primary)] hover:bg-gray-50"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/player/profile"
                      className="block rounded-xl px-4 py-2.5 text-sm font-black text-[var(--primary)] hover:bg-gray-50"
                    >
                      Profile
                    </Link>
                    <Link
                      href="/player/membership"
                      className="block rounded-xl px-4 py-2.5 text-sm font-black text-[var(--primary)] hover:bg-gray-50"
                    >
                      Membership & Coins
                    </Link>
                    <Link
                      href="/player/membership/transactions"
                      className="block rounded-xl px-4 py-2.5 text-sm font-black text-[var(--primary)] hover:bg-gray-50"
                    >
                      Coin History
                    </Link>
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/auth/logout", { method: "POST" });
                        if (res.ok) {
                          window.location.href = "/";
                        }
                      }}
                      className="block w-full rounded-xl px-4 py-2.5 text-left text-sm font-black text-red-500 hover:bg-gray-50"
                    >
                      Logout
                    </button>
                  </nav>
                </div>
              )}
            </div>

            <Link
              href="/player/membership/transactions"
              className="flex h-12 items-center gap-2 rounded-full bg-white px-3 shadow-sm ring-1 ring-black/5"
              title="Coin History"
            >
              <Coins size={23} className="text-[var(--primary)] animate-coin" />
              {data.user.coins > 0 && (
                <span className="text-sm font-black text-[var(--primary)]">
                  {data.user.coins}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Unified Dashboard Notifications & Pending Payments Area */}
        <section className="mt-6">
          <div className="bg-white rounded-[2rem] p-5 shadow-sm ring-1 ring-black/5">
            {/* Collapsed Header View */}
            {!notifExpanded ? (
              <div 
                onClick={() => setNotifExpanded(true)}
                className="flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[var(--primary)]">
                    <AlertCircle size={20} className="animate-pulse" />
                  </span>
                  <div className="overflow-hidden text-left">
                    <h3 className="text-sm font-black text-[var(--primary)] group-hover:text-emerald-700 transition">
                      {notifications.length > 0 ? notifications[0].title : "Notifications & Payments"}
                    </h3>
                    <p className="text-xs text-gray-500 font-bold truncate">
                      {notifications.length > 0 ? notifications[0].message : "No new notifications."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {pendingCharges.length > 0 && (
                    <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                      {pendingCharges.length} Pay
                    </span>
                  )}
                  {notifications.length > 1 && (
                    <span className="bg-gray-100 text-gray-600 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                      +{notifications.length - 1} more
                    </span>
                  )}
                  <span className="text-xs font-black text-emerald-600 group-hover:underline">View All</span>
                </div>
              </div>
            ) : (
              // Expanded Tabs View
              <div>
                <div className="flex items-center justify-between border-b pb-3 mb-4">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setActiveTab("notifications")}
                      className={`text-sm font-black pb-1 border-b-2 transition ${
                        activeTab === "notifications"
                          ? "border-[var(--primary)] text-[var(--primary)]"
                          : "border-transparent text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      Notifications ({notifications.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("payments")}
                      className={`text-sm font-black pb-1 border-b-2 transition ${
                        activeTab === "payments"
                          ? "border-[var(--primary)] text-[var(--primary)]"
                          : "border-transparent text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      Pending Payments ({pendingCharges.length})
                    </button>
                  </div>
                  <button
                    onClick={() => setNotifExpanded(false)}
                    className="text-xs font-black text-gray-400 hover:text-gray-600"
                  >
                    Collapse
                  </button>
                </div>

                {activeTab === "notifications" && (
                  <div className="space-y-3">
                    {notifications.length > 1 && (
                      <div className="flex justify-end">
                        <button
                          onClick={handleClearAllNotifications}
                          className="text-[11px] font-black text-rose-600 hover:underline"
                        >
                          Clear All
                        </button>
                      </div>
                    )}
                    {notifications.length === 0 ? (
                      <p className="text-xs text-gray-400 font-bold py-4 text-center">No new notifications.</p>
                    ) : (
                      <div className="grid gap-3 max-h-80 overflow-y-auto pr-1">
                        {notifications.map((notif) => (
                          <div 
                            key={notif._id} 
                            className="bg-gray-50 border border-gray-100 p-3.5 rounded-2xl flex items-start justify-between gap-3 text-left"
                          >
                            <div>
                              <h4 className="text-xs font-black text-[var(--primary)]">{notif.title}</h4>
                              <p className="text-[11px] text-gray-600 font-medium mt-1">{notif.message}</p>
                              <span className="text-[9px] text-gray-400 font-bold block mt-1">
                                {new Date(notif.createdAt).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                              </span>
                            </div>
                            {notif.clearable !== false && (
                              <button
                                onClick={() => handleClearNotification(notif._id)}
                                className="text-[10px] font-black text-gray-400 hover:text-rose-600 transition shrink-0"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "payments" && (
                  <div className="space-y-3">
                    {pendingCharges.length === 0 ? (
                      <p className="text-xs text-gray-400 font-bold py-4 text-center">No pending payments.</p>
                    ) : (
                      <div className="grid gap-3 max-h-80 overflow-y-auto pr-1">
                        {pendingCharges.map((charge) => (
                          <div 
                            key={charge._id} 
                            className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex flex-col justify-between md:flex-row md:items-center gap-3 text-left"
                          >
                            <div>
                              <h4 className="text-xs font-black text-rose-900">{charge.reason}</h4>
                              <p className="text-xs text-rose-800 font-bold mt-1">Amount: ₹{charge.amount}</p>
                              <p className="text-[10px] text-rose-600 font-semibold uppercase mt-0.5">
                                Status: {charge.status === "AWAITING_SETTLEMENT" ? "Awaiting Settlement" : "Pending"}
                              </p>
                            </div>
                            {charge.status === "PENDING" && (
                              <button
                                onClick={() => handlePayCharge(charge)}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition active:scale-95 cursor-pointer shadow-sm text-center shrink-0"
                              >
                                Pay Now
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Other Requests Pending Approval (Reschedule / Cancellation) */}
        {(data.pendingRescheduleRequestCount && data.pendingRescheduleRequestCount > 0) || (data.pendingCancellationRequestCount && data.pendingCancellationRequestCount > 0) ? (
          <section className="mt-4 space-y-2">
            {data.pendingRescheduleRequestCount && data.pendingRescheduleRequestCount > 0 ? (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
                <Clock3 className="text-blue-600 shrink-0" size={20} />
                <span className="text-xs font-black text-blue-800">Reschedule Request Pending Approval</span>
              </div>
            ) : null}

            {data.pendingCancellationRequestCount && data.pendingCancellationRequestCount > 0 ? (
              <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
                <AlertCircle className="text-orange-650 shrink-0" size={20} />
                <span className="text-xs font-black text-orange-850">Cancellation Request Pending Approval</span>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* 2. Ads / Offers Carousel */}
        {promotions.length > 0 && (
          <section className="relative mt-6 overflow-hidden rounded-[2rem]">
            <div
              className="flex h-40 transition-transform duration-700 ease-in-out"
              style={{
                width: `${promotions.length * 100}%`,
                transform: `translateX(-${
                  activePromo * (100 / promotions.length)
                }%)`,
              }}
            >
              {promotions.map((promo, idx) => {
                const bgStyle = promo.type === "TEXT"
                  ? (promo.backgroundColor || "linear-gradient(135deg, #D7E528, #F5F4EC)")
                  : "black";

                const content = (
                  <article
                    className="relative h-40 w-full overflow-hidden p-5 flex flex-col justify-end"
                    style={{
                      background: bgStyle,
                    }}
                  >
                    {/* Media backgrounds */}
                    {promo.type === "IMAGE" && promo.mediaUrl && (
                      <img
                        src={promo.mediaUrl}
                        alt={promo.altText || promo.title || "Ad"}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}

                    {promo.type === "VIDEO" && promo.mediaUrl && (
                      <video
                        src={promo.mediaUrl}
                        className="absolute inset-0 h-full w-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    )}

                    <div className="absolute inset-0 bg-black/10" />

                    <div className="relative z-10 text-left">
                      <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/60">
                        {promo.type === "TEXT" ? "Offer" : (promo.altText || "Offer")}
                      </p>

                      {promo.title && (
                        <h2 className="text-2xl font-black leading-tight text-white mt-1">
                          {promo.title}
                        </h2>
                      )}
                      {promo.subtitle && (
                        <p className="mt-1 text-sm font-semibold text-white/75">
                          {promo.subtitle}
                        </p>
                      )}
                    </div>
                  </article>
                );

                const elementStyle = {
                  width: `${100 / promotions.length}%`,
                };

                if (promo.ctaLink) {
                  return (
                    <Link
                      href={promo.ctaLink}
                      key={promo._id || idx}
                      style={elementStyle}
                      className="block h-40"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div
                    key={promo._id || idx}
                    style={elementStyle}
                    className="h-40"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. Total Playtime & compact Play History stopwatch link */}
        <section className="mt-7" onClick={(event) => event.stopPropagation()}>
          <p className="text-center text-xs font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
            Total Playtime
          </p>

          <div className="mt-3 flex justify-center">
            <div className="inline-flex flex-col">
              <div className="flex items-center gap-2">
                <FlipUnit value={totalTime.hours} />
                <span className="text-5xl font-black text-[var(--primary)]">
                  :
                </span>
                <FlipUnit value={totalTime.minutes} />
                <span className="text-5xl font-black text-[var(--primary)]">
                  :
                </span>
                <FlipUnit value={totalTime.seconds} />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-lg font-black tabular-nums text-[var(--primary)]">
                  {currentTime.hours}:{currentTime.minutes}:{currentTime.seconds}
                </p>

                <button
                  onClick={() => setShowHistory((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
                  title="Toggle Play History"
                >
                  <Clock3 size={21} className="text-[var(--primary)]" />
                </button>
              </div>
            </div>
          </div>

          {showHistory && (
            <section className="mt-5 rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-[var(--primary)]">
                  Play History
                </h3>

                <button
                  onClick={() => setShowHistory(false)}
                  className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-black text-white"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                {data.playHistory.length === 0 && (
                  <p className="text-sm font-bold text-[var(--text-muted)]">
                    No play history yet.
                  </p>
                )}

                {data.playHistory.map((item) => {
                  const isExpanded = expandedHistoryIds.includes(item._id);
                  const durationMins = item.startTime && item.exitedTime 
                    ? Math.round((new Date(item.exitedTime).getTime() - new Date(item.startTime).getTime()) / (60 * 1000))
                    : 0;

                  return (
                    <article
                      key={item._id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedHistoryIds(prev => 
                          prev.includes(item._id) 
                            ? prev.filter(id => id !== item._id) 
                            : [item._id] // Only expand the selected card
                        );
                      }}
                      className="rounded-[1.4rem] bg-[var(--background)] p-4 border border-gray-100 flex flex-col gap-2 text-xs text-gray-700 font-bold cursor-pointer transition-all hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-black text-[var(--primary)]">
                          {item.startTime ? formatDateWithYear(item.startTime) : "-"}
                        </span>
                        <span className="text-sm font-extrabold text-gray-600">
                          Played: {durationMins} Minutes
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 border-t pt-3 border-gray-200/60 grid grid-cols-2 gap-y-2 text-xs">
                          <div>
                            <span className="text-[10px] uppercase text-gray-400 font-black">Game / Court</span>
                            <p className="text-sm text-[var(--primary)] font-black">
                              {item.gameName} - {item.court || "Court A"}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-gray-400 font-black">Start Time</span>
                            <p className="text-sm text-[var(--primary)] font-black">
                              {item.startTime ? formatTime(item.startTime) : "-"}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-gray-400 font-black">Scheduled End</span>
                            <p className="text-sm text-[var(--primary)] font-black">
                              {item.endTime ? formatTime(item.endTime) : "-"}{getEndSuffix(item.startTime, item.endTime)}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-gray-400 font-black">Exited</span>
                            <p className="text-sm text-[var(--primary)] font-black">
                              {item.exitedTime ? formatTime(item.exitedTime) : "-"}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-gray-400 font-black">Buffer Allowed</span>
                            <p className="text-sm text-[var(--primary)] font-black">
                              {item.gameId?.bufferMinutes ?? 5} Minutes
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-gray-400 font-black">Overtime Minutes</span>
                            <p className="text-sm text-rose-600 font-black">
                              {Math.max(0, durationMins - (item.startTime && item.endTime ? Math.round((new Date(item.endTime).getTime() - new Date(item.startTime).getTime()) / (60 * 1000)) : 60))} Mins
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-gray-400 font-black">Additional Charges</span>
                            <p className="text-sm text-[var(--primary)] font-black">
                              ₹{item.additionalCharge?.amount || 0}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-gray-400 font-black">Status</span>
                            <p className="text-sm text-emerald-600 font-black">
                              {item.autoEnded ? "Auto Ended" : item.status || "COMPLETED"}
                            </p>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </section>

        {/* Active Session Display (If Available) */}
        {data.activeSessions && data.activeSessions.length > 0 && (
          <section className="mt-7 space-y-6">
            {data.activeSessions.map((session: any, sIdx: number) => {
              const localSecs = localActiveSeconds[sIdx] || 0;
              const formattedLocal = formatSeconds(localSecs);
              const derivedStatus = getBookingDisplayStatus(session);
              const badgeStyle = 
                derivedStatus === "Booked" || derivedStatus === "Confirmed" || derivedStatus === "Completed"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                  : derivedStatus === "Started"
                  ? "bg-yellow-50 text-yellow-800 border-yellow-100"
                  : derivedStatus === "Pending Payment"
                  ? "bg-amber-50 text-amber-805 border-amber-100 animate-pulse"
                  : "bg-rose-50 text-rose-800 border-rose-100";

              return (
                <div key={session._id} className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 text-[var(--primary)] space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
                        Active Session {(data.activeSessions || []).length > 1 ? `#${sIdx + 1}` : ""}
                      </span>
                      <h2 className="mt-1 text-2xl font-black text-[var(--primary)]">
                        {session.gameName}
                      </h2>
                      <p className="text-sm font-bold text-gray-500">{session.court || "Court not assigned"}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${badgeStyle}`}>
                      {derivedStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t pt-4 border-gray-100 text-xs font-bold text-gray-700">
                    <div>
                      <span className="text-[10px] uppercase text-gray-400 font-black">Started</span>
                      <p className="text-sm text-[var(--primary)] font-black">
                        {session.startTime ? formatTime(session.startTime) : "-"}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-gray-400 font-black">Scheduled End</span>
                      <p className="text-sm text-[var(--primary)] font-black">
                        {session.endTime ? formatTime(session.endTime) : "-"}{getEndSuffix(session.startTime, session.endTime)}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-gray-400 font-black">Buffer Time</span>
                      <p className="text-sm text-[var(--primary)] font-black">
                        {session.gameId?.bufferMinutes ?? 5} Minutes
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-gray-400 font-black">Current Duration</span>
                      <p className="text-sm text-emerald-600 font-black">
                        {formattedLocal.hours === "00" ? "" : `${formattedLocal.hours}h `}{formattedLocal.minutes} Minutes
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4 border-gray-100 bg-gray-50 -mx-6 -mb-6 p-6 rounded-b-[2rem] text-center space-y-3">
                    <p className="text-xs text-gray-500 font-extrabold leading-normal">
                      To end this session, scan the Exit QR Code.
                    </p>
                    <button
                      onClick={() => {
                        setScanMessage("");
                        setManualTokenInput("");
                        setShowQrScanModal(true);
                        if (typeof navigator !== "undefined" && navigator.mediaDevices) {
                          navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
                            .then((stream) => {
                              setCameraStream(stream);
                              setCameraActive(true);
                            })
                            .catch(() => {
                              setCameraActive(false);
                            });
                        }
                      }}
                      className="mx-auto h-14 px-8 bg-red-600 hover:bg-red-700 text-white rounded-full font-black text-sm tracking-wider transition flex items-center justify-center gap-3 active:scale-98 shadow-lg shadow-red-600/30 animate-[pulse_2s_infinite]"
                    >
                      <span>📷 Scan QR To End Session</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* 4. Selected Date Sessions Section */}
        <section className="mt-7">
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
            {(() => {
              const todayKey = toDateKey(new Date());
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const tomorrowKey = toDateKey(tomorrow);

              let heading = `Sessions on ${formatDateStr(formattedSelectedDate)}`;
              if (formattedSelectedDate === todayKey) {
                heading = "Today's Sessions";
              } else if (formattedSelectedDate === tomorrowKey) {
                heading = "Tomorrow's Sessions";
              }

              return (
                <div className="space-y-4">
                  <h3 className="text-xl font-black text-[var(--primary)] border-b pb-2">
                    {heading}
                  </h3>

                  {selectedDaySessions.length > 0 ? (
                    <div className="grid gap-3">
                      {selectedDaySessions.map((session) => (
                        <div key={session._id} className="bg-gray-50 p-4 rounded-2xl border border-gray-200/60 flex flex-col gap-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-lg font-black text-[var(--primary)]">
                                {session.gameName}
                              </h4>
                              <p className="text-xs text-gray-500 font-bold mt-0.5">
                                Court: {session.court || "Court A"}
                              </p>
                            </div>
                             {(() => {
                              const derivedStatus = getBookingDisplayStatus(session);
                              const badgeStyle = 
                                derivedStatus === "Booked" || derivedStatus === "Confirmed" || derivedStatus === "Completed"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                                  : derivedStatus === "Started"
                                  ? "bg-yellow-50 text-yellow-800 border-yellow-100"
                                  : derivedStatus === "Pending Payment"
                                  ? "bg-amber-50 text-amber-805 border-amber-100 animate-pulse"
                                  : "bg-rose-50 text-rose-800 border-rose-100";
                              return (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${badgeStyle}`}>
                                  {derivedStatus}
                                </span>
                              );
                            })()}
                          </div>

                          <div className="text-xs font-bold text-gray-600">
                            Slot: {session.startTime ? formatTime(session.startTime) : ""} - {session.endTime ? formatTime(session.endTime) : ""}
                          </div>

                          {session.status === "BOOKED" && (() => {
                            const isFixedSession = session.price === 0 && session.coinCost === 0;
                            if (isFixedSession && !data.user.canRescheduleFixedMembership) {
                              return null;
                            }
                            return (
                              <div className="flex gap-2 border-t pt-3 border-gray-200/60 mt-1">
                                <button
                                  onClick={() => {
                                    setCancelError("");
                                    setCancelReason("");
                                    setCancellingSession(session);
                                  }}
                                  className="px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-black transition active:scale-95"
                                >
                                  Cancel Session
                                </button>

                                <button
                                  onClick={() => {
                                    setRescheduleError("");
                                    const sTime = session.startTime ? new Date(session.startTime).toTimeString().slice(0, 5) : "18:00";
                                    setRescheduleStartTime(sTime);
                                    setReschedulingSession(session);
                                  }}
                                  className="px-3.5 py-2 bg-gray-105 text-[var(--primary)] border border-gray-200 rounded-xl text-xs font-black hover:bg-gray-100 transition active:scale-95"
                                >
                                  Reschedule
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      ))}

                      <div className="pt-2 border-t mt-1">
                        <Link
                          href={`/player/bookings/create?date=${formattedSelectedDate}`}
                          className="inline-flex rounded-full bg-[var(--primary)] px-5 py-2.5 text-xs font-black text-white active:scale-95 transition-all"
                        >
                          Book Additional Session
                        </Link>
                      </div>
                    </div>
                  ) : fixedMembershipSession ? (
                    <div className="space-y-3">
                      <h4 className="text-lg font-black text-[var(--primary)]">
                        {fixedMembershipSession.gameName} (Fixed Plan Slot)
                      </h4>
                      <p className="text-xs font-bold text-gray-500">
                        Scheduled slot: {fixedMembershipSession.time}
                      </p>
                      <div className="pt-3 border-t">
                        <Link
                          href={`/player/bookings/create?date=${formattedSelectedDate}`}
                          className="inline-flex rounded-full bg-[var(--primary)] px-5 py-2.5 text-xs font-black text-white active:scale-95 transition"
                        >
                          Book Additional Session
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-sm font-bold text-[var(--text-muted)]">
                        No sessions on this date
                      </p>
                      <Link
                        href={`/player/bookings/create?date=${formattedSelectedDate}`}
                        className="mt-3 inline-flex rounded-full bg-[var(--primary)] px-6 py-2.5 text-xs font-black text-white hover:opacity-90 transition active:scale-95"
                      >
                        Book Session
                      </Link>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </section>

        {/* 5. Weekly Calendar */}
        <section className="mt-7">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-[var(--primary)]">
              {showFullCalendar ? calendar.monthName : `This Week (${calendar.monthName})`}
            </h2>

            <button
              onClick={() => setShowFullCalendar((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 hover:bg-gray-50 transition"
            >
              <CalendarDays size={20} className="text-[var(--primary)]" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <div
                key={`${day}-${index}`}
                className="text-center text-[11px] font-black text-[var(--text-muted)]"
              >
                {day}
              </div>
            ))}

            {visibleCalendarDays.map((item) => {
              const isSelected = selectedDay && selectedDay.dateKey === item.dateKey;

              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedDay(item)}
                  className="flex flex-col items-center justify-start gap-1 focus:outline-none"
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-black transition-all ${
                      item.hasSession
                        ? "bg-[var(--primary)] text-white"
                        : item.monthOffset === 0
                        ? "text-[var(--primary)]"
                        : "text-[var(--text-muted)]/45"
                    } ${isSelected ? "ring-4 ring-[#D7E528]" : ""}`}
                  >
                    {item.date}
                  </span>
                  
                  {/* Multi-dot Indicators */}
                  {item.bookingIndicators && item.bookingIndicators.length > 0 && (
                    <div className="flex gap-0.5 justify-center mt-0.5">
                      {item.bookingIndicators.map((ind, i) => {
                        let dotColor = "bg-gray-400";
                        if (ind === "FIXED") dotColor = "bg-green-500";
                        else if (ind === "COIN") dotColor = "bg-yellow-500";
                        else if (ind === "ADVANCED") dotColor = "bg-blue-500";
                        else if (ind === "RESCHEDULED") dotColor = "bg-purple-500";

                        return (
                          <span 
                            key={i} 
                            className={`h-1.5 w-1.5 rounded-full ${dotColor}`} 
                          />
                        );
                      })}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 6. Active Membership / Active Coin Plan Display */}
        <section className="mt-7 space-y-6">
          {data.activeFixed && (
            <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
                Active Fixed Membership
              </p>
              <div>
                <h2 className="mt-3 text-2xl font-black text-[var(--primary)]">
                  {data.activeFixed.gameName || "Membership"}
                </h2>

                <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
                  {data.activeFixed.membershipType || "MEMBERSHIP"} •{" "}
                  {data.membershipDaysLeft || 0} days left
                </p>

                <p className="mt-1 text-xs font-semibold text-gray-500">
                  Daily Timing Slot: {data.activeFixed.startTime ? formatTime(data.activeFixed.startTime) : ""} - {data.activeFixed.endTime ? formatTime(data.activeFixed.endTime) : ""}
                </p>

                {data.user.canRescheduleFixedMembership && selectedDayFixedBooking && selectedDayFixedBooking.status === "BOOKED" && (
                  <div className="flex gap-2 border-t pt-3 border-gray-200/60 mt-3">
                    <button
                      onClick={() => {
                        setCancelError("");
                        setCancelReason("");
                        setCancellingSession(selectedDayFixedBooking);
                      }}
                      className="px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-black transition active:scale-95"
                    >
                      Cancel Slot
                    </button>
                    <button
                      onClick={() => {
                        setRescheduleError("");
                        const sTime = selectedDayFixedBooking.startTime ? new Date(selectedDayFixedBooking.startTime).toTimeString().slice(0, 5) : "18:00";
                        setRescheduleStartTime(sTime);
                        setReschedulingSession(selectedDayFixedBooking);
                      }}
                      className="px-3.5 py-2 bg-gray-105 text-[var(--primary)] border border-gray-200 rounded-xl text-xs font-black hover:bg-gray-100 transition active:scale-95"
                    >
                      Reschedule Slot
                    </button>
                  </div>
                )}

                {(() => {
                  const total = data.activeFixed.totalDays || 1;
                  const left = data.membershipDaysLeft || 0;
                  const elapsed = Math.max(0, total - left);
                  const pct = Math.min(100, Math.round((elapsed / total) * 100));
                  return (
                    <div className="mt-4 space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-gray-500">
                          <span>Membership Duration Progress</span>
                          <span>{pct}% Elapsed</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                          <div 
                            className="h-full bg-[var(--primary)] transition-all duration-500" 
                            style={{ width: `${pct}%` }} 
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-gray-500">
                        {(() => {
                          const mStart = new Date(data.activeFixed.startDate || data.activeFixed.createdAt || "");
                          const total = data.activeFixed.totalDays || 30;
                          const validTill = new Date(mStart.getTime() + total * 24 * 60 * 60 * 1000);
                          const diff = validTill.getTime() - Date.now();
                          const daysRemaining = Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));

                          return (
                            <>
                              <span>Valid Till: {validTill.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                              <span>Days Remaining: {daysRemaining} Days</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>
          )}

          {data.activeCoins && (
            <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
                Active Coins Membership
              </p>
              <div>
                <h2 className="mt-3 text-2xl font-black text-[var(--primary)]">
                  {data.activeCoins.durationLabel || "Coins Membership Plan"}
                </h2>
                
                {(() => {
                  const expiryDate = data.user.coinPlanExpiryDate ? new Date(data.user.coinPlanExpiryDate) : null;
                  const isExpired = expiryDate ? new Date() > expiryDate : false;
                  
                  const remainingCoins = data.user.coinsAvailable || 0;
                  const frozenCoins = data.user.coinsFrozen || 0;
                  const coinsSpentToday = data.todayCoinsUsed || 0;
                  const limit = data.user.dailyCoinSpendLimit || 0;
                  const availableToday = Math.max(0, limit - coinsSpentToday);

                  const daysLeft = expiryDate ? Math.max(0, Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;

                  return (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="rounded-xl bg-gray-50 p-3 flex flex-col justify-center items-center text-center">
                          <p className="text-[10px] font-semibold text-gray-500">Days Left</p>
                          <p className="text-lg font-black text-[var(--primary)] mt-1">{daysLeft}</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-3 flex flex-col justify-center items-center text-center">
                          <p className="text-[10px] font-semibold text-gray-500">Available Coins</p>
                          <p className="text-lg font-black text-emerald-600 mt-1">{remainingCoins}</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-3 flex flex-col justify-center items-center text-center">
                          <p className="text-[10px] font-semibold text-gray-500">Frozen Coins</p>
                          <p className="text-lg font-black text-rose-600 mt-1">{frozenCoins}</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-3 flex flex-col justify-center items-center text-center">
                          <p className="text-[10px] font-semibold text-gray-500">Coins Used Today</p>
                          <p className="text-lg font-black text-gray-700 mt-1">{coinsSpentToday}</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-3 flex flex-col justify-center items-center text-center col-span-2 md:col-span-1">
                          <p className="text-[10px] font-semibold text-gray-500">Daily Limit</p>
                          <p className="text-lg font-black text-gray-700 mt-1">{limit || "None"}</p>
                        </div>
                      </div>

                      {frozenCoins > 0 && (
                        <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 font-bold border border-rose-100">
                          ❄️ Some coins are frozen due to plan expiry. Please purchase a new plan to unfreeze them.
                        </div>
                      )}

                      <div className="flex justify-between text-xs font-bold text-gray-500">
                        <span>Expires On: {expiryDate ? expiryDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}</span>
                        <span className={isExpired ? "text-red-500 font-black" : "text-green-600"}>
                          {isExpired ? "Expired" : "Active"}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>
          )}

          {!data.activeFixed && !data.activeCoins && (
            <section className="rounded-[2rem] bg-amber-50/50 border border-amber-100 p-6 shadow-sm flex flex-col items-center text-center">
              <AlertCircle className="text-amber-650 w-10 h-10" />
              <h3 className="mt-3 text-lg font-black text-[var(--primary)]">No Active Membership Plan</h3>
              <p className="mt-2 text-sm font-semibold text-gray-600 max-w-md">
                You do not have any active Fixed or Coins membership plans. Purchase a membership plan to unlock booking slots and play options!
              </p>
              <div className="mt-5 flex gap-3 flex-wrap justify-center">
                <Link
                  href="/player/membership"
                  className="px-5 py-2.5 bg-[var(--primary)] text-white text-xs font-black rounded-full hover:opacity-90 transition shadow-sm"
                >
                  Buy Membership Plan
                </Link>
                <Link
                  href="/player/bookings/create"
                  className="px-5 py-2.5 bg-white text-[var(--primary)] border border-gray-200 text-xs font-black rounded-full hover:bg-gray-50 transition shadow-sm"
                >
                  Book a Court
                </Link>
              </div>
            </section>
          )}
        </section>
      </section>

      {/* --- State Modals Area --- */}

      {/* 1. Custom Exit QR scanner modal */}
      {showQrScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl animate-fade-in border border-gray-100 flex flex-col">
            <div className="bg-[var(--primary)] text-white p-5 text-center relative">
              <h3 className="text-xl font-black">Exit Session QR</h3>
              <p className="text-[10px] font-bold opacity-80 mt-1">To end this session, scan the Exit QR Code.</p>
              <button
                onClick={() => {
                  if (cameraStream) {
                    cameraStream.getTracks().forEach(track => track.stop());
                  }
                  setShowQrScanModal(false);
                }}
                className="absolute right-5 top-5 text-white/85 hover:text-white font-black text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-6 flex-1 flex flex-col items-center justify-center text-center space-y-4">
              {cameraActive ? (
                <div className="w-full aspect-square max-w-[280px] bg-black rounded-2xl relative overflow-hidden ring-4 ring-[#D7E528] flex items-center justify-center">
                  <span className="absolute inset-0 border-2 border-dashed border-[#D7E528] animate-pulse rounded-2xl" />
                  {/* Real-time Video Stream Element */}
                  <video 
                    ref={(el) => {
                      if (el && cameraStream) {
                        if (el.srcObject !== cameraStream) {
                          el.srcObject = cameraStream;
                          el.play().catch(err => {
                            if (err.name !== "AbortError") {
                              console.error(err);
                            }
                          });

                          // Canvas reader processing loop
                          const canvas = document.createElement("canvas");
                          const ctx = canvas.getContext("2d");
                          let scanActive = true;

                          const checkFrame = async () => {
                            if (!scanActive || el.paused || el.ended) return;
                            if (el.videoWidth > 0 && el.videoHeight > 0 && ctx) {
                              canvas.width = el.videoWidth;
                  canvas.height = el.videoHeight;
                              ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
                              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                              const code = jsQR(imgData.data, imgData.width, imgData.height, {
                                inversionAttempts: "dontInvert",
                              });

                              if (code && code.data) {
                                scanActive = false;
                                // Extract token if scanned data is a full URL
                                let cleanToken = code.data.trim();
                                if (cleanToken.includes("?token=") || cleanToken.includes("&token=")) {
                                  try {
                                    const urlObj = new URL(cleanToken);
                                    cleanToken = urlObj.searchParams.get("token") || cleanToken;
                                  } catch (e) {
                                    // Fallback: manual regex or searchParams parsing if not fully qualified URL
                                    const match = cleanToken.match(/[?&]token=([^&]+)/);
                                    if (match) cleanToken = match[1];
                                  }
                                }

                                // Handle exit scanner validation with detected token code
                                try {
                                  const response = await fetch(`/api/player/qr-exit?token=${encodeURIComponent(cleanToken)}`);
                                  const resData = await response.json();
                                  if (response.ok && resData.success) {
                                    const sessionIds = resData.activeSessions?.map((s: any) => s._id) || [];
                                    if (sessionIds.length > 0) {
                                      const postResponse = await fetch("/api/player/qr-exit", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          sessionIds,
                                          token: cleanToken,
                                        }),
                                      });
                                      const postData = await postResponse.json();
                                      if (!postResponse.ok || !postData.success) {
                                        setScanMessage(postData.message || "Failed to finalize checkout.");
                                        scanActive = true;
                                        return;
                                      }
                                    } else {
                                      setScanMessage("No active session found to end.");
                                      scanActive = true;
                                      return;
                                    }
                                    cameraStream.getTracks().forEach(track => track.stop());
                                    setShowQrScanModal(false);
                                    loadDashboard();
                                    return;
                                  } else {
                                    setScanMessage(resData.message || "Invalid exit QR code detected.");
                                    scanActive = true; // resume scanning if invalid
                                  }
                                } catch {
                                  setScanMessage("Network error during QR validation.");
                                  scanActive = true;
                                }
                              }
                            }
                            if (scanActive) {
                              requestAnimationFrame(checkFrame);
                            }
                          };

                          // Cleanup loop when track stops
                          cameraStream.getVideoTracks()[0]?.addEventListener("ended", () => {
                            scanActive = false;
                          });

                          el.addEventListener("play", () => {
                            requestAnimationFrame(checkFrame);
                          });
                        }
                      }
                    }}
                    className="w-full h-full object-cover" 
                    playsInline 
                    muted 
                  />
                  <div className="absolute bottom-3 bg-black/70 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                    📷 Live Scanner Feed (Place QR inside frame)
                  </div>
                </div>
              ) : (
                <div className="w-full p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-550 flex flex-col justify-center items-center gap-2">
                  <AlertCircle size={32} className="text-gray-400" />
                  <p className="text-xs font-bold leading-normal">Camera not available or blocked. Please type the Exit Token below.</p>
                </div>
              )}

              {scanMessage && (
                <p className="w-full text-xs font-black text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                  {scanMessage}
                </p>
              )}

              <div className="w-full space-y-2 border-t pt-4">
                <label className="block text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">
                  Type Exit QR Token:
                </label>
                <input
                  type="text"
                  placeholder="Enter manual exit code (e.g. exit-pickle-court-a)"
                  value={manualTokenInput}
                  onChange={(e) => setManualTokenInput(e.target.value)}
                  className="w-full h-12 rounded-xl bg-gray-50 border border-gray-200 outline-none px-4 text-xs font-bold text-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                />
              </div>

              <div className="w-full flex gap-3 pt-2">
                <button
                  onClick={async () => {
                    if (!manualTokenInput.trim()) {
                      setScanMessage("Please enter a token first.");
                      return;
                    }
                    let cleanToken = manualTokenInput.trim();
                    if (cleanToken.includes("?token=") || cleanToken.includes("&token=")) {
                      try {
                        const urlObj = new URL(cleanToken);
                        cleanToken = urlObj.searchParams.get("token") || cleanToken;
                      } catch (e) {
                        const match = cleanToken.match(/[?&]token=([^&]+)/);
                        if (match) cleanToken = match[1];
                      }
                    }
                    try {
                      const response = await fetch(`/api/player/qr-exit?token=${encodeURIComponent(cleanToken)}`);
                      const resData = await response.json();
                      if (response.ok && resData.success) {
                        const sessionIds = resData.activeSessions?.map((s: any) => s._id) || [];
                        if (sessionIds.length > 0) {
                          const postResponse = await fetch("/api/player/qr-exit", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              sessionIds,
                              token: cleanToken,
                            }),
                          });
                          const postData = await postResponse.json();
                          if (!postResponse.ok || !postData.success) {
                            setScanMessage(postData.message || "Failed to finalize checkout.");
                            return;
                          }
                        } else {
                          setScanMessage("No active session found to end.");
                          return;
                        }
                         if (cameraStream) {
                           cameraStream.getTracks().forEach(track => track.stop());
                         }
                         setShowQrScanModal(false);
                         loadDashboard();
                      } else {
                        setScanMessage(resData.message || "Invalid exit code.");
                      }
                    } catch {
                      setScanMessage("Failed connecting to exit scanner endpoint.");
                    }
                  }}
                  className="flex-1 h-12 bg-[var(--primary)] text-white text-xs font-black rounded-xl hover:opacity-90 active:scale-95 transition"
                >
                  Confirm Exit
                </button>
                <button
                  onClick={() => {
                    if (cameraStream) {
                      cameraStream.getTracks().forEach(track => track.stop());
                    }
                    setShowQrScanModal(false);
                  }}
                  className="flex-1 h-12 bg-gray-100 text-gray-600 text-xs font-black rounded-xl hover:bg-gray-200 active:scale-95 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Custom Reschedule Modal */}
      {reschedulingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-fade-in">
            <div className="bg-[var(--primary)] text-white p-5 relative">
              <h3 className="text-lg font-black">Reschedule Booking</h3>
              <p className="text-[10px] font-bold opacity-85 mt-0.5">Date & Duration cannot be modified.</p>
              <button
                onClick={() => setReschedulingSession(null)}
                className="absolute right-5 top-5 text-white/80 hover:text-white font-black text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-bold text-gray-700">
              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/50 space-y-1">
                <p>Game Name: <span className="font-black text-[var(--primary)]">{reschedulingSession.gameName}</span></p>
                <p>Assigned Court: <span className="font-black text-[var(--primary)]">{reschedulingSession.court || "Court A"}</span></p>
                <p>Booking Date: <span className="font-black text-[var(--primary)]">{reschedulingSession.startTime ? formatDateWithYear(reschedulingSession.startTime) : "-"}</span></p>
              </div>

              {(rescheduleValidationError || rescheduleError) && (
                <p className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl leading-normal">
                  {rescheduleValidationError || rescheduleError}
                </p>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase text-gray-400 font-black mb-1.5">Original slot:</label>
                    <div className="h-11 flex items-center bg-gray-100 rounded-xl px-3 text-xs text-gray-500 font-bold border">
                      {reschedulingSession.startTime ? formatTime(reschedulingSession.startTime) : ""} - {reschedulingSession.endTime ? formatTime(reschedulingSession.endTime) : ""}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase text-gray-400 font-black mb-1.5">New Start Time:</label>
                    {reschedulingSession.gameId && typeof reschedulingSession.gameId === "object" && reschedulingSession.gameId.fixedSlotBooking ? (
                      <select
                        value={rescheduleStartTime}
                        onChange={(e) => {
                          setRescheduleStartTime(e.target.value);
                        }}
                        className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-3 text-xs font-black text-[var(--primary)] outline-none focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
                      >
                        <option value="">Select Slot</option>
                        {(() => {
                          const duration = reschedulingSession.gameId.duration || 60;
                          const slots: string[] = [];
                          for (let mins = 0; mins < 1440; mins += duration) {
                            const h = Math.floor(mins / 60);
                            const m = mins % 60;
                            const slotStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                            slots.push(slotStr);
                          }
                          return slots.map(slot => (
                            <option key={slot} value={slot}>{slot}</option>
                          ));
                        })()}
                      </select>
                    ) : (
                      <input
                        type="time"
                        value={rescheduleStartTime}
                        onChange={(e) => {
                          setRescheduleStartTime(e.target.value);
                        }}
                        className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-3 text-xs font-black text-[var(--primary)] outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      />
                    )}
                  </div>
                </div>

                {(() => {
                  if (!rescheduleStartTime || !reschedulingSession.startTime || !reschedulingSession.endTime) return null;
                  const duration = new Date(reschedulingSession.endTime).getTime() - new Date(reschedulingSession.startTime).getTime();
                  const durationMins = Math.round(duration / (60 * 1000));

                  const [h, m] = rescheduleStartTime.split(":").map(Number);
                  const end = new Date(reschedulingSession.startTime);
                  end.setHours(h, m + durationMins, 0, 0);

                  return (
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-emerald-800 text-[10px] font-black">
                      Calculated End Time: {formatTime(end.toISOString())} ({durationMins} Minutes duration locked)
                    </div>
                  );
                })()}
              </div>

              <div className="flex gap-3 pt-3 border-t">
                <button
                  onClick={async () => {
                    if (!rescheduleStartTime) {
                      setRescheduleError("Please select a new start time.");
                      return;
                    }
                    const sDateStr = reschedulingSession.startTime ? reschedulingSession.startTime.split("T")[0] : new Date().toISOString().split("T")[0];
                    const [h, m] = rescheduleStartTime.split(":").map(Number);

                    const finalStart = new Date(reschedulingSession.startTime || "");
                    finalStart.setHours(h, m, 0, 0);

                    const duration = new Date(reschedulingSession.endTime || "").getTime() - new Date(reschedulingSession.startTime || "").getTime();
                    const finalEnd = new Date(finalStart.getTime() + duration);

                    // Local time iso helpers
                    const toISODateTime = (dateObj: Date) => {
                      const offsetMs = dateObj.getTimezoneOffset() * 60 * 1000;
                      return new Date(dateObj.getTime() - offsetMs).toISOString().slice(0, 19);
                    };

                    try {
                      const res = await fetch(`/api/player/bookings/${reschedulingSession._id}/reschedule`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          date: sDateStr,
                          startTime: rescheduleStartTime,
                          endTime: finalEnd.toTimeString().slice(0, 5)
                        }),
                      });
                      const resData = await res.json();
                      if (res.ok && resData.success) {
                         setReschedulingSession(null);
                         loadDashboard();
                      } else {
                        setRescheduleError(resData.message || "Rescheduling failed.");
                      }
                    } catch {
                      setRescheduleError("Failed to connect to rescheduling service.");
                    }
                  }}
                  disabled={!!rescheduleValidationError}
                  className="flex-1 h-11 bg-[var(--primary)] text-white text-xs font-black rounded-xl hover:opacity-90 active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none"
                >
                  Save Schedule
                </button>
                <button
                  onClick={() => setReschedulingSession(null)}
                  className="flex-1 h-11 bg-gray-100 text-gray-600 text-xs font-black rounded-xl hover:bg-gray-200 active:scale-95 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Custom Cancel Modal */}
      {cancellingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-fade-in">
            <div className="bg-rose-600 text-white p-5 relative">
              <h3 className="text-lg font-black">Cancel Session</h3>
              <p className="text-[10px] font-bold opacity-85 mt-0.5">Please review the cancellation rules below.</p>
              <button
                onClick={() => setCancellingSession(null)}
                className="absolute right-5 top-5 text-white/80 hover:text-white font-black text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-bold text-gray-700">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/50 space-y-2 text-xs">
                <p>Game: <span className="font-black text-[var(--primary)]">{cancellingSession.gameName}</span></p>
                <p>Assigned Court: <span className="font-black text-[var(--primary)]">{cancellingSession.court || "Court A"}</span></p>
                <p>Time Slot: <span className="font-black text-[var(--primary)]">{cancellingSession.startTime ? formatTime(cancellingSession.startTime) : ""} - {cancellingSession.endTime ? formatTime(cancellingSession.endTime) : ""}{getEndSuffix(cancellingSession.startTime, cancellingSession.endTime)}</span></p>
                <div className="border-t pt-2 border-gray-200/70 text-[10px] text-gray-500 font-semibold leading-normal mt-1">
                  ⚠️ Cancellation policies apply: Inside the restricted window, cancellations require admin approval and may incur charges.
                </div>
              </div>

              {(cancelValidationError || cancelError) && (
                <p className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl leading-normal">
                  {cancelValidationError || cancelError}
                </p>
              )}

              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase text-gray-400 font-black mb-1.5">Reason for Cancellation (Optional):</label>
                <textarea
                  placeholder="Tell us why you need to cancel this slot..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full h-24 bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-bold text-[var(--primary)] outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/player/bookings/${cancellingSession._id}/cancel`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reason: cancelReason }),
                      });
                      const resData = await res.json();
                      if (res.ok && resData.success) {
                         setCancellingSession(null);
                         loadDashboard();
                      } else {
                        setCancelError(resData.message || "Failed to cancel booking.");
                      }
                    } catch {
                      setCancelError("Network error canceling booking.");
                    }
                  }}
                  disabled={!!cancelValidationError}
                  className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none"
                >
                  Submit
                </button>
                <button
                  onClick={() => setCancellingSession(null)}
                  className="flex-1 h-11 bg-gray-100 text-gray-600 text-xs font-black rounded-xl hover:bg-gray-200 active:scale-95 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Footer Action Bar */}
      {data.activeSession && (
        <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 p-4 md:hidden shadow-[0_-8px_30px_rgb(0,0,0,0.08)]">
          <button
            onClick={() => {
              setScanMessage("");
              setManualTokenInput("");
              setShowQrScanModal(true);
              if (typeof navigator !== "undefined" && navigator.mediaDevices) {
                navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
                  .then((stream) => {
                    setCameraStream(stream);
                    setCameraActive(true);
                  })
                  .catch(() => {
                    setCameraActive(false);
                  });
              }
            }}
            className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-full font-black text-sm tracking-wider transition flex items-center justify-center gap-3 active:scale-98 shadow-lg shadow-red-600/30 animate-[pulse_2s_infinite]"
          >
            <span>📷 Scan QR To End Session</span>
          </button>
        </footer>
      )}
    </main>
  );
}