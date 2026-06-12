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
  Building2,
  AlertCircle
} from "lucide-react";
import jsQR from "jsqr";

type DashboardUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  companyId: string;
  companyName: string;
  mustChangePassword: boolean;
};

type SessionEntry = {
  _id: string;
  bookingGroupId: string;
  playerName: string;
  mobile: string;
  gameName: string;
  court: string;
  startTime: string;
  endTime: string;
  exitedTime?: string;
  bookedDurationMinutes: number;
  actualDurationMinutes?: number;
  status: string;
  groupPlayers?: {
    playerName: string;
    employeeId: string;
    mobile: string;
    companyEmployeeId: string;
  }[];
  otherPlayers?: string[];
};

type DashboardData = {
  user: DashboardUser;
  activeSession: SessionEntry | null;
  todayUpcomingSessions: SessionEntry[];
  calendarSessions: SessionEntry[];
  playHistory: SessionEntry[];
  totalPlaySeconds: number;
  currentPlaySeconds: number;
  serverTime: string;
};

type CalendarDay = {
  id: string;
  date: number;
  monthOffset: -1 | 0 | 1;
  dateKey: string;
  hasSession: boolean;
  game?: string;
  time?: string;
};

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

function formatTime(value?: string) {
  if (!value) return "00:00";
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCalendar(calendarSessions: SessionEntry[]) {
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

    return {
      id: `${idPrefix}-${date}`,
      date,
      monthOffset,
      dateKey,
      hasSession: matching.length > 0,
      game: matching[0]?.gameName,
      time: matching[0]?.startTime ? formatTime(matching[0].startTime) : undefined,
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

export default function CompanyDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [localCurrentSeconds, setLocalCurrentSeconds] = useState(0);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedBookingDetail, setSelectedBookingDetail] = useState<SessionEntry | null>(null);

  // Exit QR Scanner Modal States
  const [showQrScanModal, setShowQrScanModal] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  async function loadDashboard() {
    try {
      const response = await fetch("/api/company/dashboard", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/company/login");
        return;
      }
      const result = await response.json();
      if (!result || !result.user) {
        router.replace("/company/login");
        return;
      }

      if (result.user.mustChangePassword) {
        router.replace("/company/change-password");
        return;
      }

      setData(result);
      setLocalCurrentSeconds(result.currentPlaySeconds || 0);

      const cal = getCalendar(result.calendarSessions || []);
      const todayKey = toDateKey(new Date());
      const todayItem = cal.weekDays.find((item) => item.dateKey === todayKey);

      setSelectedDay((prev) => {
        if (prev) {
          const found = cal.weekDays.find((d) => d.dateKey === prev.dateKey);
          if (found) return found;
        }
        return todayItem ?? cal.weekDays.find((item) => item.hasSession) ?? cal.weekDays[0] ?? null;
      });

      setLoading(false);
    } catch (err) {
      console.error(err);
      router.replace("/company/login");
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!data?.activeSession) return;

    const timer = setInterval(() => {
      setLocalCurrentSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [data?.activeSession]);

  const calendar = useMemo(
    () => getCalendar(data?.calendarSessions ?? []),
    [data?.calendarSessions]
  );

  const selectedDaySessions = useMemo(() => {
    if (!selectedDay || !data?.calendarSessions) return [];
    return data.calendarSessions.filter((session) => {
      if (!session.startTime) return false;
      return toDateKey(new Date(session.startTime)) === selectedDay.dateKey;
    });
  }, [selectedDay, data]);

  if (loading || !data || !selectedDay) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-12 flex items-center justify-center">
        <p className="font-black text-[var(--primary)] text-lg animate-pulse">Loading dashboard...</p>
      </main>
    );
  }

  const totalTime = formatSeconds(
    data.totalPlaySeconds - data.currentPlaySeconds + localCurrentSeconds
  );

  const currentTime = formatSeconds(localCurrentSeconds);

  const visibleCalendarDays = showFullCalendar ? calendar.days : calendar.weekDays;

  return (
    <main
      onClick={() => setShowHistory(false)}
      className="min-h-screen bg-[var(--background)] px-4 py-6"
    >
      <section className="mx-auto w-full max-w-md md:max-w-2xl lg:max-w-4xl">
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full mb-1 w-max">
              <Building2 size={12} />
              <span>{data.user.companyName}</span>
            </div>
            <h1 className="text-3xl font-black leading-none text-[var(--primary)] mt-1">
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
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                className="flex h-12 w-12 flex-col items-end justify-center gap-1.5 rounded-full bg-white shadow-sm ring-1 ring-black/5 px-3"
              >
                <span className="h-0.5 w-6 rounded-full bg-[var(--primary)]" />
                <span className="h-0.5 w-4 rounded-full bg-[var(--primary)]" />
                <span className="h-0.5 w-2 rounded-full bg-[var(--primary)]" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-14 z-50 w-52 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-black/5">
                  <nav className="grid gap-1">
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/auth/logout", { method: "POST" });
                        if (res.ok) {
                          window.location.href = "/company/login";
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
          </div>
        </header>

        {/* Action Button: Create Corporate Booking */}
        <section className="mt-8">
          <Link
            href="/company/bookings/create"
            className="flex h-16 w-full items-center justify-center rounded-2xl bg-[var(--primary)] font-black text-white shadow-lg shadow-[var(--primary)]/20 hover:opacity-95 transition-opacity text-lg"
          >
            + Create Booking
          </Link>
        </section>

        {/* Stopwatch / Play Time */}
        <section className="mt-8 bg-white p-6 rounded-3xl shadow-sm ring-1 ring-black/5 flex flex-col items-center">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
            Total Playtime
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-5xl font-black text-[var(--primary)]">{totalTime.hours}</span>
            <span className="text-5xl font-black text-[var(--primary)]">:</span>
            <span className="text-5xl font-black text-[var(--primary)]">{totalTime.minutes}</span>
            <span className="text-5xl font-black text-[var(--primary)]">:</span>
            <span className="text-5xl font-black text-[var(--primary)]">{totalTime.seconds}</span>
          </div>

          {data.activeSession && (
            <div 
              onClick={() => setSelectedBookingDetail(data.activeSession)}
              className="mt-5 w-full bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex flex-col items-center cursor-pointer hover:bg-indigo-100/60 transition"
            >
              <span className="text-xs font-black text-indigo-700 uppercase tracking-widest animate-pulse flex items-center gap-1">
                ● Active Session Playing
              </span>
              <p className="text-2xl font-black text-indigo-900 mt-2">
                {currentTime.hours}:{currentTime.minutes}:{currentTime.seconds}
              </p>
              <div className="mt-3 text-xs font-bold text-indigo-800 space-y-1 text-center">
                <p>Game: {data.activeSession.gameName} ({data.activeSession.court})</p>
                <p>Scheduled: {formatTime(data.activeSession.startTime)} - {formatTime(data.activeSession.endTime)}</p>
                {data.activeSession.otherPlayers && data.activeSession.otherPlayers.length > 0 && (
                  <p className="text-[10px] text-indigo-600 mt-1">
                    Other Players: {data.activeSession.otherPlayers.join(", ")}
                  </p>
                )}
              </div>
              <div className="border-t pt-4 border-indigo-200/55 mt-4 w-full text-center space-y-3" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs text-indigo-700 font-extrabold leading-normal">
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
                  className="mx-auto h-12 px-6 bg-red-650 hover:bg-red-700 text-white rounded-full font-black text-xs transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                >
                  <span>📷 Scan QR To End Session</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Weekly/Monthly Calendar */}
        <section className="mt-8 bg-white p-5 rounded-3xl shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-[var(--primary)]">Calendar</h2>
            <button
              onClick={() => setShowFullCalendar(!showFullCalendar)}
              className="text-xs font-black text-[var(--primary)] hover:opacity-85"
            >
              {showFullCalendar ? "Show Week" : "Show Month"}
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-[var(--text-muted)] uppercase mb-2">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {visibleCalendarDays.map((day) => {
              const isSelected = selectedDay.dateKey === day.dateKey;
              return (
                <button
                  key={day.id}
                  onClick={() => setSelectedDay(day)}
                  className={`h-12 rounded-xl flex flex-col items-center justify-center relative transition-all ${
                    day.monthOffset !== 0
                      ? "opacity-30"
                      : ""
                  } ${
                    isSelected
                      ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/15"
                      : "bg-[var(--background)] text-[var(--primary)]"
                  }`}
                >
                  <span className="text-sm font-black">{day.date}</span>
                  {day.hasSession && (
                    <span
                      className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                        isSelected ? "bg-white" : "bg-indigo-600"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Day Bookings Detail */}
          <div className="mt-6 border-t pt-5 border-gray-100">
            <h3 className="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-3">
              Bookings for {formatDate(selectedDay.dateKey)}
            </h3>
            {selectedDaySessions.length === 0 ? (
              <p className="text-sm font-bold text-[var(--text-muted)] italic">No sessions booked for this day.</p>
            ) : (
              <div className="space-y-3">
                {selectedDaySessions.map((session) => (
                  <div 
                    key={session._id} 
                    onClick={() => setSelectedBookingDetail(session)}
                    className="p-4 bg-[var(--background)] rounded-2xl border border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-55 transition"
                  >
                    <div>
                      <p className="text-sm font-black text-[var(--primary)]">{session.gameName}</p>
                      <p className="text-xs text-[var(--text-muted)] font-bold mt-0.5">
                        Court: {session.court}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] font-bold">
                        Time: {formatTime(session.startTime)} - {formatTime(session.endTime)}
                      </p>
                      {session.otherPlayers && session.otherPlayers.length > 0 && (
                        <p className="text-[10px] text-indigo-600 mt-1 font-bold">
                          Other Players: {session.otherPlayers.join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-black uppercase bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full">
                      {session.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Play History */}
        <section className="mt-8 bg-white p-5 rounded-3xl shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-[var(--primary)]">Recent Play History</h2>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs font-black text-[var(--primary)] hover:opacity-85"
            >
              {showHistory ? "Show Less" : "View All"}
            </button>
          </div>

          <div className="space-y-3">
            {data.playHistory.length === 0 && (
              <p className="text-sm font-bold text-[var(--text-muted)] italic">No completed play history yet.</p>
            )}
            {(showHistory ? data.playHistory : data.playHistory.slice(0, 5)).map((item) => (
              <div 
                key={item._id} 
                onClick={() => setSelectedBookingDetail(item)}
                className="p-4 bg-[var(--background)] rounded-2xl border border-gray-100 text-xs text-gray-700 font-bold cursor-pointer hover:bg-gray-55 transition"
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-black text-[var(--primary)]">{item.gameName}</span>
                  <span className="text-[10px] uppercase font-black bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {item.status}
                  </span>
                </div>
                <div className="mt-2 text-gray-500 space-y-0.5">
                  <p>Date: {formatDate(item.startTime)}</p>
                  <p>Court: {item.court}</p>
                  <p>Booked: {item.bookedDurationMinutes} mins ({formatTime(item.startTime)} - {formatTime(item.endTime)})</p>
                  {item.exitedTime && (
                    <p>Actual Playtime: {item.actualDurationMinutes || 0} mins (Exited at {formatTime(item.exitedTime)})</p>
                  )}
                  {item.otherPlayers && item.otherPlayers.length > 0 && (
                    <p className="text-[10px] text-indigo-600 mt-1 font-bold">
                      Other Players: {item.otherPlayers.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

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
                                // Handle exit scanner validation with detected token code
                                try {
                                  const response = await fetch(`/api/player/qr-exit?token=${encodeURIComponent(code.data.trim())}`);
                                  const resData = await response.json();
                                  if (response.ok && resData.success) {
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
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    playsInline
                  />
                </div>
              ) : (
                <div className="w-full aspect-square max-w-[280px] bg-gray-100 rounded-2xl flex flex-col items-center justify-center p-6 border text-gray-400 font-bold text-xs space-y-2">
                  <AlertCircle size={28} />
                  <p>Webcam initialization failed.</p>
                  <p className="text-[10px] font-normal text-gray-405">Please verify camera permissions in your browser address bar.</p>
                </div>
              )}

              {scanMessage && (
                <p className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-2xl w-full">
                  ⚠️ {scanMessage}
                </p>
              )}

              {/* Manual input fallback */}
              <div className="w-full border-t pt-4 space-y-2 text-left">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-gray-400">Or type Token manually</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. SECURE_TOKEN"
                      value={manualTokenInput}
                      onChange={(e) => setManualTokenInput(e.target.value)}
                      className="h-10 flex-1 border border-black/5 bg-gray-50 rounded-xl px-3 text-xs font-bold uppercase outline-none"
                    />
                    <button
                      onClick={async () => {
                        if (!manualTokenInput.trim()) return;
                        try {
                          const response = await fetch(`/api/player/qr-exit?token=${encodeURIComponent(manualTokenInput.trim())}`);
                          const resData = await response.json();
                          if (response.ok && resData.success) {
                            if (cameraStream) {
                              cameraStream.getTracks().forEach(track => track.stop());
                            }
                            setShowQrScanModal(false);
                            loadDashboard();
                          } else {
                            setScanMessage(resData.message || "Invalid manual token.");
                          }
                        } catch {
                          setScanMessage("Network validation error.");
                        }
                      }}
                      className="h-10 bg-[var(--primary)] text-white font-black text-xs px-4 rounded-xl hover:opacity-90 active:scale-95 transition"
                    >
                      Verify
                    </button>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 2. Group Booking Details Modal */}
      {selectedBookingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl animate-fade-in border border-gray-100 flex flex-col">
            <div className="bg-[var(--primary)] text-white p-5 text-center relative">
              <h3 className="text-xl font-black">{selectedBookingDetail.gameName} Booking</h3>
              <p className="text-[10px] font-bold opacity-80 mt-1">Court: {selectedBookingDetail.court}</p>
              <button
                onClick={() => setSelectedBookingDetail(null)}
                className="absolute right-5 top-5 text-white/85 hover:text-white font-black text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-bold text-gray-700">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100/55">
                <div>
                  <span className="text-[9px] uppercase font-black text-gray-400">Date</span>
                  <p className="text-sm font-black text-[var(--primary)]">{formatDate(selectedBookingDetail.startTime)}</p>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-black text-gray-400">Court</span>
                  <p className="text-sm font-black text-[var(--primary)]">{selectedBookingDetail.court}</p>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-black text-gray-400">Start Time</span>
                  <p className="text-sm font-black text-gray-700">{formatTime(selectedBookingDetail.startTime)}</p>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-black text-gray-400">End Time</span>
                  <p className="text-sm font-black text-gray-700">{formatTime(selectedBookingDetail.endTime)}</p>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-black text-gray-400">Status</span>
                  <p className="text-sm font-black text-indigo-700 uppercase">{selectedBookingDetail.status}</p>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-black text-gray-400">Exit Status</span>
                  <p className="text-sm font-black text-gray-650 uppercase">
                    {selectedBookingDetail.exitedTime 
                      ? `Exited at ${formatTime(selectedBookingDetail.exitedTime)}` 
                      : (selectedBookingDetail.status === "STARTED" ? "Playing" : "Not Exited")}
                  </p>
                </div>
              </div>

              {/* Group Players Section */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Group Players</span>
                <div className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100">
                  {selectedBookingDetail.groupPlayers && selectedBookingDetail.groupPlayers.length > 0 ? (
                    selectedBookingDetail.groupPlayers.map((player, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between bg-white hover:bg-gray-50">
                        <div>
                          <p className="font-black text-[var(--primary)] text-sm">{player.playerName}</p>
                          <p className="text-[10px] text-gray-400 font-bold">Emp ID: {player.employeeId}</p>
                        </div>
                        <p className="text-xs text-gray-500 font-bold tracking-wider">{player.mobile}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-gray-400 italic">
                      No other players in this booking group.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
