"use client";

export const dynamic = "force-dynamic";

import { ArrowLeft, Home, Calendar, Clock, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo, Suspense } from "react";
import { parseIST, formatToISTDate, formatToISTTime } from "@/lib/time";


type Game = {
  _id: string;
  name: string;
  duration: number; // min duration
  maximumDuration: number;
  bufferMinutes?: number;
  fixedSlotBooking?: boolean;
};

function BookSessionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryDate = searchParams.get("date") || "";

  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [date, setDate] = useState(queryDate);
  const [startTime, setStartTime] = useState("");
  const [isTimeChangedByUser, setIsTimeChangedByUser] = useState(false);
  const [endTime, setEndTime] = useState("");
  const [playersCount, setPlayersCount] = useState(1);
  const [user, setUser] = useState<{ coins: number } | null>(null);

  const [duration, setDuration] = useState(0);

  // Status & Validation
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [coinCost, setCoinCost] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  // Court Selection & Suggested Slots
  const [suggestedSlots, setSuggestedSlots] = useState<any[]>([]);
  const [allowCourtSelection, setAllowCourtSelection] = useState(false);
  const [availableCourts, setAvailableCourts] = useState<string[]>([]);
  const [selectedCourt, setSelectedCourt] = useState("");

  // Live clock synchronization with server drift safety
  const [currentTime, setCurrentTime] = useState(new Date());

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

  // Initialize date on mount if empty
  useEffect(() => {
    if (!date) {
      const now = new Date();
      setDate(now.toLocaleDateString("en-CA"));
    }
  }, [date]);

  const selectedGame = useMemo(() => {
    return games.find((g) => g._id === selectedGameId) || null;
  }, [games, selectedGameId]);

  // Synchronize startTime live to the current time if not manually changed by the user, and the selected date is today
  useEffect(() => {
    if (isTimeChangedByUser) return;
    const todayStr = formatToISTDate(currentTime);
    const targetDate = date || todayStr;
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
      if (startTime !== nextStart) {
        setStartTime(nextStart);
      }
    }
  }, [currentTime, date, selectedGame, isTimeChangedByUser, startTime]);

  const isPastTime = useMemo(() => {
    if (!date || !startTime) return false;
    const bookingStart = parseIST(date, startTime);
    return bookingStart.getTime() < currentTime.getTime() - 2 * 60 * 1000;
  }, [date, startTime, currentTime]);

  const fixedSlots = useMemo(() => {
    if (!selectedGame || !selectedGame.fixedSlotBooking) return [];
    const minDur = selectedGame.duration || 60;
    const slots: string[] = [];
    for (let mins = 0; mins < 1440; mins += minDur) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
    return slots;
  }, [selectedGame]);

  useEffect(() => {
    if (selectedGame && selectedGame.fixedSlotBooking) {
      const todayStr = formatToISTDate(new Date());
      const targetDate = date || todayStr;
      
      let nearestSlot = "00:00";
      if (targetDate === todayStr) {
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const totalMinutes = currentHours * 60 + currentMinutes;
        
        const dur = selectedGame.duration || 60;
        const remainder = totalMinutes % dur;
        const nextSlotMinutes = totalMinutes + (dur - remainder);
        const finalMinutes = nextSlotMinutes >= 1440 ? 0 : nextSlotMinutes;
        
        const h = Math.floor(finalMinutes / 60);
        const m = finalMinutes % 60;
        nearestSlot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
      setStartTime(nearestSlot);
    }
  }, [selectedGame, date]);

  useEffect(() => {
    if (date && startTime) {
      if (isPastTime && isTimeChangedByUser) {
        setValidationError("Selected start time is now in the past. Please choose a future time.");
        return;
      }
    }
    if (selectedGame) {
      const min = selectedGame.duration;
      const max = selectedGame.maximumDuration;
      if (duration < min || duration > max) {
        setValidationError(`Duration must be between ${min} and ${max} minutes`);
        return;
      }
      if (duration % min !== 0) {
        setValidationError(`Duration must be a multiple of ${min} minutes`);
        return;
      }
    }
    if (playersCount < 1) {
      setValidationError("Players count must be at least 1");
      return;
    }
    setValidationError("");
  }, [date, startTime, currentTime, selectedGame, duration, playersCount]);

  const [submitting, setSubmitting] = useState(false);

  async function loadGames() {
    try {
      const response = await fetch("/api/games");
      const data = await response.json();
      if (response.ok && data.success) {
        setGames(data.games || []);
        if (data.games?.length > 0) {
          setSelectedGameId(data.games[0]._id);
        }
      }
      setLoadingGames(false);
    } catch (err) {
      console.error(err);
      setLoadingGames(false);
    }
  }

  async function loadUser() {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        setUser(data.user || null);
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadGames();
    loadUser();

    // Restore draft if returning from checkout
    try {
      const saved = sessionStorage.getItem("memberBookingDraft");
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.selectedGameId) setSelectedGameId(draft.selectedGameId);
        if (draft.date) setDate(draft.date);
        if (draft.startTime) {
          setStartTime(draft.startTime);
          setIsTimeChangedByUser(true); // Mark as user touched / restored
        }
        if (draft.duration) setDuration(draft.duration);
        if (draft.playersCount) setPlayersCount(draft.playersCount);
        if (draft.selectedCourt) setSelectedCourt(draft.selectedCourt);
      }
    } catch (e) {
      console.error("Error restoring member draft:", e);
    }
  }, []);

  const [crossMidnight, setCrossMidnight] = useState(false);

  // Set default duration to game's min duration when game changes
  useEffect(() => {
    if (selectedGame) {
      setDuration(selectedGame.duration);
    }
  }, [selectedGame]);

  // Handle auto end-time calculation
  useEffect(() => {
    if (!startTime || !selectedGame) return;
    const [sh, sm] = startTime.split(":").map(Number);
    const totalMinutes = sh * 60 + sm + duration;
    const eh = Math.floor((totalMinutes % (24 * 60)) / 60);
    const em = totalMinutes % 60;
    const formattedEndTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    setEndTime(formattedEndTime);

    const isCross = (eh * 60 + em) < (sh * 60 + sm);
    setCrossMidnight(isCross);
  }, [startTime, duration, selectedGame]);

  // Adjust duration clicks
  function handleDurationChange(direction: "up" | "down") {
    if (!selectedGame) return;
    const step = selectedGame.duration;
    const max = selectedGame.maximumDuration;
    if (direction === "up") {
      setDuration((prev) => Math.min(max, prev + step));
    } else {
      setDuration((prev) => Math.max(step, prev - step));
    }
  }

  // Duration in minutes
  const sessionMinutes = duration;

  // Dynamic Availability Check
  useEffect(() => {
    if (isPastTime) {
      setError("Cannot book a slot in the past. Please select a future date and time.");
      setAvailable(false);
      setCoinCost(null);
      return;
    }

    if (!selectedGameId || playersCount < 1) {
      setAvailable(null);
      setCoinCost(null);
      setError("");
      return;
    }

    if (selectedGame) {
      const min = selectedGame.duration;
      const max = selectedGame.maximumDuration;

      if (sessionMinutes < min || sessionMinutes > max) {
        setError(`Duration must be between ${min} and ${max} minutes`);
        setAvailable(null);
        setCoinCost(null);
        return;
      }

      if (sessionMinutes % min !== 0) {
        setError(`Duration must be a multiple of ${min} minutes`);
        setAvailable(null);
        setCoinCost(null);
        return;
      }
    }

    setError("");
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const queryParams: Record<string, string> = {
          gameId: selectedGameId,
          durationMinutes: String(duration),
          playersCount: String(playersCount),
        };

        if (date && startTime && endTime) {
          queryParams.date = date;
          queryParams.startTime = startTime;
          queryParams.endTime = endTime;
        }

        const query = new URLSearchParams(queryParams);

        const res = await fetch(`/api/player/bookings?${query.toString()}`);
        if (res.status === 401 || res.status === 403) {
          router.replace("/auth/login");
          return;
        }
        const data = await res.json();
        setChecking(false);

        if (res.ok && data.success) {
          setAvailable(data.available);
          setCoinCost(data.coinCost);
          setAllowCourtSelection(data.allowCourtSelection || false);
          setAvailableCourts(data.availableCourts || []);
          if (data.available === false) {
            setError(data.reason || "Slot is fully booked");
            setSuggestedSlots(data.suggestedSlots || []);
          } else {
            setSuggestedSlots([]);
            if (data.availableCourts && data.availableCourts.length > 0) {
              if (!selectedCourt || !data.availableCourts.includes(selectedCourt)) {
                setSelectedCourt(data.availableCourts[0]);
              }
            }
          }
        } else {
          setError(data.message || "Failed to check slot details");
          setAvailable(null);
          setCoinCost(null);
          setSuggestedSlots([]);
          setAvailableCourts([]);
        }
      } catch (err) {
        console.error(err);
        setChecking(false);
        setError("Network error while checking slot availability");
        setSuggestedSlots([]);
        setAvailableCourts([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [selectedGameId, date, startTime, endTime, playersCount, sessionMinutes, selectedGame, duration, router, isPastTime]);

  async function handleBook(event: React.FormEvent) {
    event.preventDefault();

    let finalStartTime = startTime;
    let finalEndTime = endTime;

    if (!isTimeChangedByUser) {
      const now = new Date();
      if (selectedGame?.fixedSlotBooking) {
        const minDur = selectedGame.duration || 60;
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const totalMinutes = currentHours * 60 + currentMinutes;
        const remainder = totalMinutes % minDur;
        const nextSlotMinutes = totalMinutes + (minDur - remainder);
        const finalMinutes = nextSlotMinutes >= 1440 ? 0 : nextSlotMinutes;
        const h = Math.floor(finalMinutes / 60);
        const m = finalMinutes % 60;
        finalStartTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      } else {
        finalStartTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      }

      // Recalculate end time
      const [sh, sm] = finalStartTime.split(":").map(Number);
      const totalMinutes = sh * 60 + sm + duration;
      const eh = Math.floor((totalMinutes % (24 * 60)) / 60);
      const em = totalMinutes % 60;
      finalEndTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    }

    if (isPastTime) {
      setError("Cannot book a slot in the past. Please select a future date and time.");
      return;
    }
    if (available === false || !date || !finalStartTime || !finalEndTime) {
      setError("Please select an available slot.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/player/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: selectedGameId,
          date,
          startTime: finalStartTime,
          endTime: finalEndTime,
          durationMinutes: duration,
          playersCount,
          court: selectedCourt || undefined,
        }),
      });

      if (response.status === 401 || response.status === 403) {
        router.replace("/auth/login");
        return;
      }

      const data = await response.json();
      setSubmitting(false);

      if (response.status === 402 && data.redirectPayment) {
        // Save draft state
        const draft = {
          selectedGameId,
          date,
          startTime,
          duration,
          playersCount,
          selectedCourt,
        };
        sessionStorage.setItem("memberBookingDraft", JSON.stringify(draft));

        // Exceeds limit or insufficient coins -> redirect to payment stub
        const params = new URLSearchParams({
          type: "booking",
          bookingId: data.bookingId || "",
          gameId: selectedGameId,
          date,
          startTime,
          endTime,
          playersCount: String(playersCount),
          coinCost: String(coinCost || 0),
          reason: data.reason,
          message: data.message,
          court: selectedCourt || "",
        });
        router.push(`/player/payment?${params.toString()}`);
        return;
      }

      if (!response.ok) {
        setError(data.message || "Booking failed");
        return;
      }

      sessionStorage.removeItem("memberBookingDraft");
      router.push("/player/dashboard");
    } catch (err) {
      console.error(err);
      setSubmitting(false);
      setError("Booking submission failed. Please try again.");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6">
      <section className="mx-auto max-w-md md:max-w-xl">
        <header className="flex items-center justify-between">
          <Link
            href="/player/dashboard"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
          >
            <ArrowLeft size={24} className="text-[var(--primary)]" />
          </Link>
          <h1 className="text-3xl font-black text-[var(--primary)]">
            Book Session
          </h1>
          <Link
            href="/player/dashboard"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
          >
            <Home size={23} className="text-[var(--primary)]" />
          </Link>
        </header>

        {loadingGames ? (
          <p className="mt-8 font-black text-[var(--primary)]">Loading form...</p>
        ) : (
          <form onSubmit={handleBook} className="mt-6 space-y-6">
            {/* Form Fields container */}
            <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-5">
              
              {/* Game selection */}
              <label className="grid gap-1">
                <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">
                  Select Sport / Game
                </span>
                <select
                  value={selectedGameId}
                  onChange={(e) => setSelectedGameId(e.target.value)}
                  className="h-14 rounded-2xl bg-[#EDEBE2] px-5 font-bold outline-none border-0 text-[var(--primary)] appearance-none cursor-pointer"
                >
                  {games.map((g) => (
                    <option key={g._id} value={g._id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Date selection */}
              <label className="grid gap-1 relative">
                <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">
                  Select Date
                </span>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-14 w-full rounded-2xl bg-[#EDEBE2] pl-5 pr-12 font-bold outline-none border-0 text-[var(--primary)]"
                  />
                  <Calendar size={18} className="absolute right-4 top-4.5 text-[var(--primary)]/70 pointer-events-none" />
                </div>
              </label>

              {/* Start Time Slot & Duration adjustment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="grid gap-1 relative cursor-pointer">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">
                    Start Time
                  </span>
                  <div className="relative">
                    {selectedGame?.fixedSlotBooking ? (
                      <select
                        required
                        value={startTime}
                        onChange={(e) => {
                          setStartTime(e.target.value);
                          setIsTimeChangedByUser(true);
                        }}
                        className="h-14 w-full rounded-2xl bg-[#EDEBE2] pl-5 pr-12 font-bold outline-none border-0 text-[var(--primary)] cursor-pointer appearance-none"
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
                        value={startTime}
                        onChange={(e) => {
                          setStartTime(e.target.value);
                          setIsTimeChangedByUser(true);
                        }}
                        className="h-14 w-full rounded-2xl bg-[#EDEBE2] px-5 font-bold outline-none border-0 text-[var(--primary)] cursor-pointer"
                      />
                    )}
                    <Clock size={18} className="absolute right-4 top-4.5 text-[var(--primary)]/70 pointer-events-none" />
                  </div>
                </label>

                <div className="grid gap-1">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">
                    Duration
                  </span>
                  <div className="flex items-center h-14 rounded-2xl bg-[#EDEBE2] px-4 justify-between font-bold text-[var(--primary)]">
                    <button
                      type="button"
                      onClick={() => handleDurationChange("down")}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm font-black text-lg active:scale-95"
                    >
                      -
                    </button>
                    <span>{duration} Min</span>
                    <button
                      type="button"
                      onClick={() => handleDurationChange("up")}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm font-black text-lg active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* End Time (Calculated) */}
              {startTime && (
                <div className="p-4 rounded-2xl bg-gray-50 flex items-center justify-between text-sm font-bold text-[var(--primary)]">
                  <span>Calculated End Time:</span>
                  <span className="flex items-center gap-1 font-black">
                    {endTime} {crossMidnight && <span className="text-xs text-red-500 font-extrabold">(+1 Day)</span>}
                  </span>
                </div>
              )}

              {/* Player Count Stepper */}
              <div className="grid gap-1">
                <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">
                  Player Count
                </span>
                <div className="flex items-center h-14 rounded-2xl bg-[#EDEBE2] px-5 justify-between font-bold text-[var(--primary)]">
                  <button
                    type="button"
                    onClick={() => setPlayersCount((prev) => Math.max(1, prev - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm font-black text-lg active:scale-95"
                  >
                    -
                  </button>
                  <span className="text-lg font-black">{playersCount}</span>
                  <button
                    type="button"
                    onClick={() => setPlayersCount((prev) => prev + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm font-black text-lg active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Duration Info and helper */}
              {selectedGame && (
                <div className="p-4 rounded-2xl bg-[#EDEBE2] text-xs font-bold text-[var(--primary)] space-y-1">
                  <p>• Minimum duration: {selectedGame.duration} mins</p>
                  <p>• Maximum duration: {selectedGame.maximumDuration} mins</p>
                  <p>• Selected duration: {sessionMinutes} mins</p>
                </div>
              )}

              {/* Court Selection (Per Game Allow setting) */}
              {allowCourtSelection && available === true && availableCourts.length > 0 && (
                <div className="grid gap-1.5 border-t pt-4 border-gray-100 text-left">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">Select Court</span>
                  <div className="flex flex-wrap gap-2.5">
                    {availableCourts.map((court) => (
                      <button
                        key={court}
                        type="button"
                        onClick={() => setSelectedCourt(court)}
                        className={`h-11 px-5 rounded-xl font-bold text-xs transition active:scale-95 ${
                          selectedCourt === court
                            ? "bg-[var(--primary)] text-white"
                            : "bg-gray-100 text-[var(--primary)] hover:bg-gray-200"
                        }`}
                      >
                        {court}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart Rescheduling / Nearest Slot Recommendations */}
              {available === false && (
                <div className="p-4 bg-amber-50 rounded-[1.5rem] border border-amber-100 text-left space-y-2 border-t pt-4">
                  {error === "Shared courts are occupied." ? (
                    <div className="mb-3 text-[11px] font-medium text-amber-800 leading-relaxed space-y-1">
                      <p className="font-bold">This booking requires the shared dependent courts to be available.</p>
                      <p>The selected time is unavailable because one or more shared courts are already booked.</p>
                    </div>
                  ) : null}

                  {suggestedSlots.length > 0 && (() => {
                    const grouped: Record<string, typeof suggestedSlots> = {};
                    suggestedSlots.forEach((slot: any) => {
                      const type = slot.type || "Other Available Slots";
                      if (!grouped[type]) grouped[type] = [];
                      grouped[type].push(slot);
                    });

                    const categoryTitles: Record<string, string> = {
                      "Today": "Available Later Today",
                      "Nearby": "Late Night / Nearby",
                      "Tomorrow": "Same Time Tomorrow",
                      "Day After Tomorrow": "Same Time Day After Tomorrow",
                      "Future": "Same Time on Future Days"
                    };

                    const order = ["Today", "Nearby", "Tomorrow", "Day After Tomorrow", "Future"];
                    const sortedKeys = Object.keys(grouped).sort((a, b) => {
                      const idxA = order.indexOf(a);
                      const idxB = order.indexOf(b);
                      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
                    });

                    return (
                      <div className="space-y-4">
                        <p className="text-xs font-black text-amber-900 uppercase tracking-wide">Recommended Available Slots</p>
                        {sortedKeys.map((typeKey) => {
                          const slots = grouped[typeKey];
                          const title = categoryTitles[typeKey] || typeKey;
                          return (
                            <div key={typeKey} className="space-y-1.5 border-t border-amber-200/50 pt-2.5">
                              <span className="text-[10px] font-black uppercase text-amber-800/70 tracking-wide block">{title}</span>
                              <div className="grid grid-cols-2 gap-2">
                                {slots.map((slot: any, idx: number) => {
                                  const displayLabel = `${slot.startTime}–${slot.endTime || ""}`;
                                  const slotKey = `${slot.date}_${slot.startTime}_${idx}`;
                                  return (
                                    <button
                                      key={slotKey}
                                      type="button"
                                      onClick={() => {
                                        if (slot.date) setDate(slot.date);
                                        if (slot.startTime) setStartTime(slot.startTime);
                                        setIsTimeChangedByUser(true);
                                      }}
                                      className="h-10 rounded-xl bg-white border border-amber-200 hover:bg-amber-100/50 text-[11px] font-bold text-amber-900 transition px-2 text-center"
                                    >
                                      {displayLabel}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Availability and Cost Live Display Container */}
            {(checking || available !== null || coinCost !== null || error || validationError) && (
              <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-3">
                {checking && (
                  <p className="text-sm font-black text-amber-500 animate-pulse">
                    Checking slot availability and pricing...
                  </p>
                )}

                {!checking && (validationError || error) && (
                  <p className="text-sm font-black text-red-500 rounded-xl bg-red-50 p-3">
                    {validationError || error}
                  </p>
                )}

                {!checking && available && !validationError && (
                  <div className="space-y-4">
                    <p className="text-sm font-black text-emerald-600">
                      ✓ Slot is available!
                    </p>
                  </div>
                )}

                {!checking && coinCost !== null && !validationError && (() => {
                  const usesCoins = user && user.coins >= coinCost;
                  return (
                    <div className="rounded-2xl bg-gray-50 p-4 space-y-2 text-sm font-bold text-[var(--primary)]">
                      <div className="flex justify-between border-b pb-2">
                        <span>Players:</span>
                        <span>{playersCount}</span>
                      </div>
                      <div className="flex justify-between border-b pb-2">
                        <span>Duration:</span>
                        <span>{duration} Min</span>
                      </div>
                      <div className="flex justify-between text-base font-black pt-1">
                        {usesCoins ? (
                          <>
                            <span>Coins to be deducted:</span>
                            <span className="text-xl text-[var(--primary)]">{coinCost}</span>
                          </>
                        ) : (
                          <>
                            <span>Price:</span>
                            <span className="text-xl text-[var(--primary)]">₹{coinCost}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || checking || available === false || !!error || !!validationError}
              className="h-16 w-full rounded-full bg-[var(--primary)] text-lg font-black text-white hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-md"
            >
              {submitting ? "Booking..." : "Proceed to Payment"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export default function BookSessionPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[var(--background)] px-4 py-6">
        <section className="mx-auto max-w-md">
          <p className="font-black text-[var(--primary)]">Loading booking form...</p>
        </section>
      </main>
    }>
      <BookSessionForm />
    </Suspense>
  );
}
