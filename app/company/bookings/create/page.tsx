"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, User, Users, CheckCircle, AlertCircle } from "lucide-react";
import { parseIST, formatToISTDate, formatToISTTime } from "@/lib/time";



type Game = {
  _id: string;
  name: string;
  duration: number;
  maximumDuration: number;
  fixedSlotBooking?: boolean;
};

type Colleague = {
  id: string;
  name: string;
  mobile: string;
  employeeId: string;
  displayText: string;
};

export default function CompanyBookingCreatePage() {
  const router = useRouter();

  const [allowedGames, setAllowedGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [isTimeChangedByUser, setIsTimeChangedByUser] = useState(false);
  const [duration, setDuration] = useState(60);

  // Co-players search and selection
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Colleague[]>([]);
  const [selectedColleagues, setSelectedColleagues] = useState<Colleague[]>([]);

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

  const selectedGame = useMemo(() => {
    return allowedGames.find((g) => g._id === selectedGameId) || null;
  }, [allowedGames, selectedGameId]);

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

  // Status/Validation states
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (isPastTime && isTimeChangedByUser) {
      setValidationError("Selected start time is now in the past. Please choose a future time.");
      return;
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
    setValidationError("");
  }, [isPastTime, selectedGame, duration]);

  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  // Load allowed games or all games
  useEffect(() => {
    async function loadGames() {
      try {
        const dashboardRes = await fetch("/api/company/dashboard");
        if (!dashboardRes.ok) {
          router.replace("/company/login");
          return;
        }
        const dashboardData = await dashboardRes.json();
        
        if (dashboardData?.user?.mustChangePassword) {
          router.replace("/company/change-password");
          return;
        }
        
        let gamesList = dashboardData.allowedGames || [];
        if (gamesList.length === 0) {
          // Fallback to all games if company allowed games is empty
          const gamesRes = await fetch("/api/games");
          const gamesData = await gamesRes.json();
          if (gamesData.success && gamesData.games) {
            gamesList = gamesData.games;
          }
        }
        
        setAllowedGames(gamesList);
        if (gamesList.length > 0) {
          setSelectedGameId(gamesList[0]._id);
          setDuration(gamesList[0].duration);
        }
      } catch (err) {
        console.error("Error loading games", err);
      }
    }
    loadGames();
  }, [router]);

  // Initialize date, start time, and restore draft on mount
  useEffect(() => {
    const now = new Date();
    let defaultDate = now.toLocaleDateString("en-CA");
    let defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    try {
      const saved = sessionStorage.getItem("companyBookingDraft");
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.selectedGameId) setSelectedGameId(draft.selectedGameId);
        if (draft.date) defaultDate = draft.date;
        if (draft.startTime) {
          defaultTime = draft.startTime;
          setIsTimeChangedByUser(true);
        }
        if (draft.duration) setDuration(draft.duration);
        if (draft.selectedColleagues) setSelectedColleagues(draft.selectedColleagues);
      }
    } catch (e) {
      console.error("Error restoring company draft:", e);
    }

    setDate(defaultDate);
    setStartTime(defaultTime);
  }, []);

  // Calculate end time
  const endTime = useMemo(() => {
    if (!startTime || !selectedGame) return "";
    const [sh, sm] = startTime.split(":").map(Number);
    const totalMinutes = sh * 60 + sm + duration;
    const eh = Math.floor((totalMinutes % (24 * 60)) / 60);
    const em = totalMinutes % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  }, [startTime, duration, selectedGame]);

  // Search colleagues as query changes
  useEffect(() => {
    if (searchQuery.trim().length < 1) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/player/company/employees?search=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (res.ok && data.success) {
          // Exclude already selected colleagues
          const filtered = (data.employees || []).filter(
            (emp: Colleague) => !selectedColleagues.some((selected) => selected.id === emp.id)
          );
          setSuggestions(filtered);
        }
      } catch (err) {
        console.error(err);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedColleagues]);

  // Check Availability dynamically
  useEffect(() => {
    if (isPastTime) {
      setError("Cannot book a slot in the past. Please select a future date and time.");
      setAvailable(false);
      return;
    }

    if (!selectedGameId || !date || !startTime || !endTime) {
      setAvailable(null);
      return;
    }

    if (selectedGame) {
      const min = selectedGame.duration;
      const max = selectedGame.maximumDuration;

      if (duration < min || duration > max) {
        setError(`Duration must be between ${min} and ${max} minutes`);
        setAvailable(null);
        return;
      }

      if (duration % min !== 0) {
        setError(`Duration must be a multiple of ${min} minutes`);
        setAvailable(null);
        return;
      }
    }

    setError("");
    setAvailable(null);
    setChecking(true);

    const params = new URLSearchParams({
      gameId: selectedGameId,
      durationMinutes: String(duration),
      playersCount: String(selectedColleagues.length + 1),
      date,
      startTime,
      endTime,
    });

    const controller = new AbortController();
    fetch(`/api/player/bookings?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setChecking(false);
        if (data.success) {
          setAvailable(data.available);
          if (data.available === false) {
            setError(data.reason || "Slot is fully booked");
          }
        } else {
          setError(data.message || "Slot check failed");
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setChecking(false);
          setError("Error checking slot details");
        }
      });

    return () => controller.abort();
  }, [selectedGameId, date, startTime, endTime, duration, selectedColleagues.length, selectedGame, isPastTime]);

  // Handle game select change to update durations
  function handleGameChange(gameId: string) {
    setSelectedGameId(gameId);
    const gameObj = allowedGames.find((g) => g._id === gameId);
    if (gameObj) {
      setDuration(gameObj.duration);
    }
  }

  // Handle Submit Booking
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

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

    if (isPastTime || available === false) {
      setError("Cannot book a slot in the past. Please select a future date and time.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        gameId: selectedGameId,
        date,
        startTime: finalStartTime,
        endTime: finalEndTime,
        coPlayerIds: selectedColleagues.map((c) => c.id),
      };

      const response = await fetch("/api/company/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      setSubmitting(false);

      if (!response.ok) {
        setError(data.message || "Failed to create booking");
        return;
      }

      sessionStorage.removeItem("companyBookingDraft");
      router.push("/company/dashboard");
    } catch (err) {
      setSubmitting(false);
      setError("Failed to submit booking. Check your connection.");
      console.error(err);
    }
  }

  function addColleague(colleague: Colleague) {
    setSelectedColleagues((prev) => [...prev, colleague]);
    setSearchQuery("");
    setSuggestions([]);
  }

  function removeColleague(id: string) {
    setSelectedColleagues((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6">
      <section className="mx-auto w-full max-w-md bg-white p-6 rounded-3xl shadow-lg ring-1 ring-black/5">
        <header className="flex items-center gap-3 mb-6">
          <Link
            href="/company/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--background)] ring-1 ring-black/5 text-[var(--primary)]"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-black text-[var(--primary)]">Create Booking</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Game Selection */}
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-[var(--text-muted)] px-1">Game</label>
            <select
              value={selectedGameId}
              onChange={(e) => handleGameChange(e.target.value)}
              className="h-14 w-full rounded-full bg-[var(--background)] px-5 font-bold outline-none ring-1 ring-black/5"
            >
              {allowedGames.map((game) => (
                <option key={game._id} value={game._id}>
                  {game.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-[var(--text-muted)] px-1">Date</label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="h-14 w-full rounded-full bg-[var(--background)] pl-5 pr-12 font-bold outline-none ring-1 ring-black/5"
              />
              <Calendar className="absolute right-5 top-4.5 text-[var(--text-muted)] pointer-events-none" size={18} />
            </div>
          </div>

          {/* Time & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label className="text-xs font-bold text-[var(--text-muted)] px-1">Start Time</label>
              <div className="relative">
                {selectedGame?.fixedSlotBooking ? (
                  <select
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setIsTimeChangedByUser(true);
                    }}
                    required
                    className="h-14 w-full rounded-full bg-[var(--background)] pl-5 pr-12 font-bold outline-none ring-1 ring-black/5 appearance-none cursor-pointer"
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
                    type="text"
                    placeholder="HH:MM"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setIsTimeChangedByUser(true);
                    }}
                    required
                    className="h-14 w-full rounded-full bg-[var(--background)] px-5 font-bold outline-none ring-1 ring-black/5"
                  />
                )}
                <Clock className="absolute right-4 top-4.5 text-[var(--text-muted)] pointer-events-none" size={18} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-bold text-[var(--text-muted)] px-1">Duration (Min)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={selectedGame?.duration || 30}
                step={selectedGame?.duration || 30}
                required
                className="h-14 w-full rounded-full bg-[var(--background)] px-5 font-bold outline-none ring-1 ring-black/5"
              />
            </div>
          </div>

          <div className="text-xs font-bold text-[var(--text-muted)] px-1 flex justify-between">
            <span>End Time: {endTime || "--:--"}</span>
            <span className="text-indigo-650">No Payment Needed (Billed to Company)</span>
          </div>

          {/* Co-player Selection */}
          <div className="grid gap-1.5 border-t pt-4 border-gray-150">
            <label className="text-xs font-bold text-[var(--text-muted)] px-1 flex items-center gap-1">
              <Users size={14} />
              <span>Co-players (Colleagues)</span>
            </label>

            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, employee ID, mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-14 w-full rounded-full bg-[var(--background)] px-5 font-bold outline-none ring-1 ring-black/5"
              />

              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-15 z-50 max-h-52 overflow-y-auto rounded-2xl bg-white border border-gray-100 shadow-xl p-2 space-y-1">
                  {suggestions.map((colleague) => (
                    <button
                      key={colleague.id}
                      type="button"
                      onClick={() => addColleague(colleague)}
                      className="w-full text-left p-3 hover:bg-[var(--background)] rounded-xl text-xs font-bold text-[var(--primary)] flex items-center justify-between"
                    >
                      <span>{colleague.displayText}</span>
                      <span className="text-[10px] text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded-full font-black">
                        {colleague.employeeId}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected co-players */}
            {selectedColleagues.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedColleagues.map((colleague) => (
                  <span
                    key={colleague.id}
                    className="inline-flex items-center gap-1 text-xs font-bold bg-indigo-50 border border-indigo-150 text-indigo-850 pl-3 pr-2 py-1.5 rounded-full"
                  >
                    <span>{colleague.name}</span>
                    <button
                      type="button"
                      onClick={() => removeColleague(colleague.id)}
                      className="text-red-500 hover:text-red-700 font-bold ml-1 text-sm bg-white rounded-full w-5 h-5 flex items-center justify-center border shadow-xs"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Slot availability check alerts */}
          <div className="mt-3">
            {checking && (
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 p-3.5 rounded-2xl">
                <Clock className="animate-spin text-gray-400" size={16} />
                <span>Checking slot availability...</span>
              </div>
            )}
            {available === true && !validationError && (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100">
                <CheckCircle className="text-emerald-600" size={16} />
                <span>Slot is available!</span>
              </div>
            )}
            {(available === false || !!validationError) && (
              <div className="flex items-center gap-2 text-xs font-bold text-rose-800 bg-rose-50 p-3.5 rounded-2xl border border-rose-100">
                <AlertCircle className="text-rose-600 shrink-0" size={16} />
                <span>{validationError || error || "Selected slot is fully booked."}</span>
              </div>
            )}
            {!checking && available === null && error && !validationError && (
              <div className="flex items-center gap-2 text-xs font-bold text-rose-800 bg-rose-50 p-3.5 rounded-2xl border border-rose-100">
                <AlertCircle className="text-rose-600 shrink-0" size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Action button */}
          <button
            type="submit"
            disabled={submitting || checking || available === false || !!validationError}
            className="h-14 w-full rounded-full bg-[var(--primary)] font-black text-white hover:opacity-95 disabled:opacity-60 transition-opacity mt-4 flex items-center justify-center gap-2 shadow-lg shadow-[var(--primary)]/20"
          >
            {submitting ? "Booking Slot..." : "Confirm Booking"}
          </button>
        </form>
      </section>
    </main>
  );
}
