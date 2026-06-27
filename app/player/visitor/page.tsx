"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Home, Calendar, Clock, User, Phone, Mail, Cake, ShieldCheck } from "lucide-react";
import { parseIST, formatToISTDate, formatToISTTime } from "@/lib/time";

type Game = {
  _id: string;
  name: string;
  duration: number;
  maximumDuration: number;
  fixedSlotBooking?: boolean;
};

export default function VisitorBookingPage() {
  const router = useRouter();

  // Visitor Details
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");

  // Booking details
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [isTimeChangedByUser, setIsTimeChangedByUser] = useState(false);
  const [duration, setDuration] = useState(60);
  const [playersCount, setPlayersCount] = useState(1);

  // Repeat visitor stats
  const [visitCount, setVisitCount] = useState(0);
  const [showRepeatPrompt, setShowRepeatPrompt] = useState(false);
  const [repeatPromptStep, setRepeatPromptStep] = useState<"dob" | "email" | "done">("dob");

  // Live clock synchronization
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Synchronize startTime live to the current time if not manually changed by the user, and the selected date is today
  useEffect(() => {
    if (isTimeChangedByUser) return;
    const todayStr = formatToISTDate(currentTime);
    if (date === todayStr) {
      const nowStr = `${String(currentTime.getHours()).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(2, "0")}`;
      setStartTime(nowStr);
    }
  }, [currentTime, date, isTimeChangedByUser]);

  const isPastTime = useMemo(() => {
    if (!date || !startTime) return false;
    const bookingStart = parseIST(date, startTime);
    return bookingStart.getTime() < currentTime.getTime() - 5 * 60 * 1000;
  }, [date, startTime, currentTime]);

  const isImmediate = useMemo(() => {
    if (!date || !startTime) return false;
    const todayStr = formatToISTDate(new Date());
    if (date !== todayStr) return false;
    
    const [sh, sm] = startTime.split(":").map(Number);
    const startMinutes = sh * 60 + sm;
    
    // Get current minutes in IST
    const nowIST = new Date();
    const timeStr = formatToISTTime(nowIST);
    const [ch, cm] = timeStr.split(":").map(Number);
    const currentMinutes = ch * 60 + cm;
    
    // Within 15 minutes of current time or in the past (today) is considered immediate/now
    return Math.abs(startMinutes - currentMinutes) <= 15 || startMinutes < currentMinutes;
  }, [date, startTime]);
  const selectedGame = useMemo(() => {
    return games.find((g) => g._id === selectedGameId) || null;
  }, [games, selectedGameId]);

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

  // Calculated values & status
  const [endTime, setEndTime] = useState("");
  const [crossMidnight, setCrossMidnight] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  // Suggested Slots and Court Selection
  const [suggestedSlots, setSuggestedSlots] = useState<string[]>([]);
  const [allowCourtSelection, setAllowCourtSelection] = useState(false);
  const [availableCourts, setAvailableCourts] = useState<string[]>([]);
  const [selectedCourt, setSelectedCourt] = useState("");


  useEffect(() => {
    if (!name) {
      setValidationError("Name is required");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (!phone) {
      setValidationError("Phone number is required");
      return;
    }
    if (cleanPhone.length !== 10) {
      setValidationError("Please enter a valid 10-digit phone number");
      return;
    }
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setValidationError("Please enter a valid email address");
        return;
      }
    }
    
    // Strict real-time check using current millisecond timestamp
    if (date && startTime) {
      const bookingStart = parseIST(date, startTime);
      if (bookingStart.getTime() < currentTime.getTime()) {
        setValidationError("Cannot book a slot in the past. Please select a future date and time.");
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
  }, [name, phone, email, date, startTime, currentTime, selectedGame, duration, playersCount]);

  // Load games
  useEffect(() => {
    fetch("/api/games")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.games) {
          setGames(data.games);
          if (data.games.length > 0) {
            setSelectedGameId(data.games[0]._id);
            setDuration(data.games[0].duration);
          }
        }
      });
  }, []);

  // Initialize date and start time with defaults on mount
  useEffect(() => {
    const now = new Date();
    setDate(now.toLocaleDateString("en-CA"));
    setStartTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  }, []);



  // Check visitor repeat status when phone number is completed (10 digits)
  useEffect(() => {
    if (isImmediate) {
      setShowRepeatPrompt(false);
      setRepeatPromptStep("done");
      return;
    }
    if (phone.length >= 10) {
      fetch(`/api/visitor/check-visits?phone=${phone}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setVisitCount(data.visitCount);
            if (data.email) setEmail(data.email);
            if (data.dob) setDob(new Date(data.dob).toISOString().split("T")[0]);
            
            // Show prompt on 3rd or 4th visit (current visit is count + 1)
            if (data.visitCount === 2 || data.visitCount === 3) {
              setShowRepeatPrompt(true);
              setRepeatPromptStep("dob");
            } else {
              setShowRepeatPrompt(false);
              setRepeatPromptStep("done");
            }
          }
        });
    } else {
      setVisitCount(0);
      setShowRepeatPrompt(false);
      setRepeatPromptStep("dob");
    }
  }, [phone, isImmediate]);

  // Handle End Time auto calculation
  useEffect(() => {
    if (!startTime || !selectedGame) return;
    const [sh, sm] = startTime.split(":").map(Number);
    const totalMinutes = sh * 60 + sm + duration;
    const eh = Math.floor((totalMinutes % (24 * 60)) / 60);
    const em = totalMinutes % 60;
    setEndTime(`${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`);
    setCrossMidnight((eh * 60 + em) < (sh * 60 + sm));
  }, [startTime, duration, selectedGame]);

  // Combined Availability & Pricing check
  useEffect(() => {
    if (isPastTime) {
      setError("Cannot book a slot in the past. Please select a future date and time.");
      setAvailable(false);
      setPrice(null);
      return;
    }

    if (!selectedGameId || playersCount < 1) {
      setAvailable(null);
      setPrice(null);
      setError("");
      return;
    }

    if (selectedGame) {
      const min = selectedGame.duration;
      const max = selectedGame.maximumDuration;

      if (duration < min || duration > max) {
        setError(`Duration must be between ${min} and ${max} minutes`);
        setAvailable(null);
        setPrice(null);
        return;
      }

      if (duration % min !== 0) {
        setError(`Duration must be a multiple of ${min} minutes`);
        setAvailable(null);
        setPrice(null);
        return;
      }
    }

    setError("");
    setPrice(null);
    setAvailable(null);
    setChecking(true);

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
    const controller = new AbortController();

    fetch(`/api/player/bookings?${query.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setChecking(false);
        if (data.success) {
          setAvailable(data.available);
          setPrice(data.coinCost);
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
          setError(data.message || "Pricing not available");
          setPrice(null);
          setAvailable(null);
          setSuggestedSlots([]);
          setAvailableCourts([]);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setChecking(false);
          setError("Error checking slot details");
          setPrice(null);
          setAvailable(null);
          setSuggestedSlots([]);
          setAvailableCourts([]);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedGameId, duration, playersCount, date, startTime, endTime, selectedGame, isPastTime]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (date && startTime) {
      const bookingStart = parseIST(date, startTime);
      if (bookingStart.getTime() < Date.now()) {
        setError("Cannot book a slot in the past. Please select a future date and time.");
        return;
      }
    }
    if (!name || !phone || !selectedGameId || !date || !startTime) {
      setError("Please fill all required fields");
      return;
    }

    // Validate Phone: must be exactly 10 digits
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }

    // Validate Email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError("Please enter a valid email address");
        return;
      }
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/visitor/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          dob,
          gameId: selectedGameId,
          date,
          startTime,
          durationMinutes: duration,
          playersCount,
          court: selectedCourt || undefined,
        }),
      });

      const data = await response.json();
      setSubmitting(false);

      if (!response.ok) {
        setError(data.message || "Failed to create booking");
        return;
      }

      // Redirect to Payment Screen
      const paymentParams = new URLSearchParams({
        type: "booking",
        bookingId: data.booking._id,
        gameId: selectedGameId,
        date,
        startTime,
        endTime,
        playersCount: String(playersCount),
        coinCost: String(price || 0),
        visitorFlow: "true",
      });

      router.push(`/player/payment?${paymentParams.toString()}`);
    } catch (err) {
      console.error(err);
      setSubmitting(false);
      setError("Booking submission failed. Please try again.");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6">
      <section className="mx-auto max-w-md">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
          >
            <ArrowLeft size={24} className="text-[var(--primary)]" />
          </Link>
          <h1 className="text-3xl font-black text-[var(--primary)]">Visitor Book</h1>
          <Link
            href="/"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
          >
            <Home size={23} className="text-[var(--primary)]" />
          </Link>
        </header>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-5">
            <h3 className="text-lg font-black text-[var(--primary)] border-b pb-2">Your Details</h3>
            
            {/* Name */}
            <label className="grid gap-1 relative">
              <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">Name</span>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-14 w-full rounded-2xl bg-gray-50 pl-12 pr-5 font-bold outline-none border border-gray-100 text-[var(--primary)]"
                />
                <User size={18} className="absolute left-4 top-4.5 text-gray-400" />
              </div>
            </label>

            {/* Phone */}
            <label className="grid gap-1 relative">
              <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">Phone</span>
              <div className="relative">
                <input
                  type="tel"
                  required
                  placeholder="Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-14 w-full rounded-2xl bg-gray-50 pl-12 pr-5 font-bold outline-none border border-gray-100 text-[var(--primary)]"
                />
                <Phone size={18} className="absolute left-4 top-4.5 text-gray-400" />
              </div>
            </label>

            {/* Optional/Promotional repeat visit prompt */}
            {showRepeatPrompt && repeatPromptStep === "dob" && (
              <div className="p-4 bg-emerald-50 rounded-2xl ring-1 ring-emerald-200 space-y-3 animate-fade-in text-left">
                <p className="text-xs font-bold text-emerald-800 leading-relaxed">
                  🎉 Welcome back! Since this is your {visitCount + 1}th booking, enter your birthdate to unlock eligibility for our exclusive **birthday discount / birthday offer**!
                </p>
                <div className="grid gap-3">
                  <label className="grid gap-1">
                    <span className="text-[10px] font-black uppercase text-emerald-700">Birthdate (Optional)</span>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="h-12 w-full rounded-xl bg-white px-3 font-semibold text-xs outline-none border border-emerald-200 text-[var(--primary)]"
                    />
                  </label>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setRepeatPromptStep("email")}
                      className="px-4 h-9 rounded-xl bg-emerald-600 text-white text-xs font-bold active:scale-95 cursor-pointer"
                    >
                      {dob ? "Next" : "Skip"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showRepeatPrompt && repeatPromptStep === "email" && (
              <div className="p-4 bg-emerald-50 rounded-2xl ring-1 ring-emerald-200 space-y-3 animate-fade-in text-left">
                <p className="text-xs font-bold text-emerald-800 leading-relaxed">
                  Would you also like to receive booking updates, tournament invites, and special offer alerts via email?
                </p>
                <div className="grid gap-3">
                  <label className="grid gap-1">
                    <span className="text-[10px] font-black uppercase text-emerald-700">Email Address (Optional)</span>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 w-full rounded-xl bg-white px-3 font-semibold text-xs outline-none border border-emerald-200 text-[var(--primary)]"
                    />
                  </label>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setRepeatPromptStep("done")}
                      className="px-4 h-9 rounded-xl bg-emerald-600 text-white text-xs font-bold active:scale-95 cursor-pointer"
                    >
                      {email ? "Finish" : "Skip"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showRepeatPrompt && repeatPromptStep === "done" && (
              <div className="p-3 bg-emerald-100 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-850 animate-fade-in text-left">
                <span>✓ Thank you! We've saved your birthday discount eligibility.</span>
              </div>
            )}

            {!showRepeatPrompt && (
              <label className="grid gap-1 relative">
                <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">Email (Optional)</span>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 w-full rounded-2xl bg-gray-50 pl-12 pr-5 font-bold outline-none border border-gray-100 text-[var(--primary)]"
                  />
                  <Mail size={18} className="absolute left-4 top-4.5 text-gray-400" />
                </div>
              </label>
            )}
          </div>

          <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-5">
            <h3 className="text-lg font-black text-[var(--primary)] border-b pb-2">Session Details</h3>

            {/* Game */}
            <label className="grid gap-1">
              <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">Select Sport</span>
              <select
                value={selectedGameId}
                onChange={(e) => {
                  const nextGameId = e.target.value;
                  setSelectedGameId(nextGameId);
                  const nextGame = games.find(g => g._id === nextGameId);
                  if (nextGame) {
                    setDuration(nextGame.duration);
                    setError("");
                    setPrice(null);
                    setAvailable(null);
                  }
                }}
                className="h-14 rounded-2xl bg-[#EDEBE2] px-5 font-bold border-0 outline-none text-[var(--primary)] appearance-none cursor-pointer"
              >
                {games.map((g) => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </select>
            </label>

            {/* Date */}
            <label className="grid gap-1 relative">
              <span className="text-xs font-black uppercase text-[var(--text-muted)] tracking-wider">Select Date</span>
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

            {/* Start Time & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-1 relative cursor-pointer">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">Start Time</span>
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
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (err) {}
                      }}
                      className="h-14 w-full rounded-2xl bg-[#EDEBE2] pl-5 pr-12 font-bold outline-none border-0 text-[var(--primary)] cursor-pointer"
                    />
                  )}
                  <Clock size={18} className="absolute right-4 top-4.5 text-[var(--primary)]/70 pointer-events-none" />
                </div>
              </label>

              <div className="grid gap-1">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">Duration</span>
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

            {/* Calculated End Time */}
            {startTime && (
              <div className="p-4 rounded-2xl bg-gray-50 flex items-center justify-between text-sm font-bold text-[var(--primary)]">
                <span>End Time:</span>
                <span className="font-black">
                  {endTime} {crossMidnight && <span className="text-xs text-red-500 font-extrabold">(+1 Day)</span>}
                </span>
              </div>
            )}

            {/* Players count */}
            <div className="grid gap-1">
              <span className="text-xs font-black uppercase text-[var(--text-muted)]">Players</span>
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
            {available === false && suggestedSlots.length > 0 && (
              <div className="p-4 bg-amber-50 rounded-[1.5rem] border border-amber-100 text-left space-y-2 border-t pt-4">
                <p className="text-xs font-black text-amber-900 uppercase tracking-wide">Recommended Slots</p>
                <div className="grid grid-cols-2 gap-2">
                  {suggestedSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        setStartTime(slot);
                        setIsTimeChangedByUser(true);
                      }}
                      className="h-10 rounded-xl bg-white border border-amber-200 hover:bg-amber-100/50 text-[11px] font-bold text-amber-900 transition"
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pricing & Checkout Summary */}
          {(checking || price !== null || error || validationError) && (
            <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-3">
              {checking && <p className="text-xs font-black text-amber-500 animate-pulse">Checking price...</p>}
              {!checking && (validationError || error) && <p className="text-xs font-black text-rose-500 bg-rose-50 p-3 rounded-xl">{validationError || error}</p>}
              {!checking && price !== null && !error && !validationError && (
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
                    <span>Price:</span>
                    <span className="text-xl text-[var(--primary)]">₹{price}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || checking || !!error || !!validationError || available === false}
            className="h-16 w-full rounded-full bg-[var(--primary)] text-lg font-black text-white hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
          >
            <ShieldCheck size={20} />
            <span>Proceed to Payment</span>
          </button>
        </form>
      </section>
    </main>
  );
}
