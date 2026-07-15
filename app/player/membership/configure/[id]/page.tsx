"use client";

import { ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";

type DurationOption = {
  label: string;
  months: number;
  days?: number;
  playersIncluded: number;
  perDayDuration?: number;
  originalPrice: number;
  finalPrice: number;
};

type Plan = {
  _id: string;
  name: string;
  type: "FIXED" | "COINS";
  gameName?: string;
  allowUserTimeSelection?: boolean;
  adminStartTime?: string;
  adminEndTime?: string;
  durations?: DurationOption[];
  price?: number;
  coinsAmount?: number;
  bonusCoins?: number;
  sessionDuration?: number;
  game?: {
    name: string;
    duration: number;
    maximumDuration: number;
    bufferMinutes?: number;
    fixedSlotBooking?: boolean;
    allowCourtSelection?: boolean;
  };
};

function getMinutes(start: string, end: string) {
  if (!start || !end) return 0;

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  return eh * 60 + em - (sh * 60 + sm);
}

export default function ConfigurePlanPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedDurationIndex, setSelectedDurationIndex] = useState(0);
  const [duration, setDuration] = useState(0);
  const [crossMidnight, setCrossMidnight] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const fixedSlots = useMemo(() => {
    if (!plan?.game || !plan.game.fixedSlotBooking) return [];
    const minDur = plan.game.duration || 60;
    const slots: string[] = [];
    for (let mins = 0; mins < 1440; mins += minDur) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
    return slots;
  }, [plan]);

  useEffect(() => {
    if (!plan) return;
    const selectedDuration = plan.durations?.[selectedDurationIndex];
    if (plan.type === "FIXED" && !selectedDuration) {
      setValidationError("Select plan duration");
      return;
    }
    if (plan.type === "FIXED" && plan.allowUserTimeSelection) {
      if (!startTime) {
        setValidationError("Select start time");
        return;
      }
      const sessionMinutes = duration;
      const minDuration = plan.game?.duration || 0;
      const maxDuration = plan.game?.maximumDuration || 0;

      if (sessionMinutes <= 0) {
        setValidationError("End time must be after start time");
        return;
      }
      if (sessionMinutes < minDuration || sessionMinutes > maxDuration) {
        setValidationError(`Session duration must be between ${minDuration} and ${maxDuration} minutes`);
        return;
      }
      if (sessionMinutes % minDuration !== 0) {
        setValidationError(`Session duration must be in multiples of ${minDuration} minutes`);
        return;
      }
    }
    setValidationError("");
  }, [plan, selectedDurationIndex, startTime, duration]);

  // Set default duration to selected duration option's perDayDuration or game's duration when plan loads/changes
  useEffect(() => {
    if (plan) {
      const selectedDuration = plan.durations?.[selectedDurationIndex];
      const fixedDur = selectedDuration?.perDayDuration || plan.game?.duration || 60;
      setDuration(fixedDur);
      if (plan.game?.fixedSlotBooking) {
        // Calculate nearest or first slot
        const minDur = plan.game?.duration || 60;
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const totalMinutes = currentHours * 60 + currentMinutes;
        const remainder = totalMinutes % minDur;
        const nextSlotMinutes = totalMinutes + (minDur - remainder);
        const finalMinutes = nextSlotMinutes >= 1440 ? 0 : nextSlotMinutes;
        const h = Math.floor(finalMinutes / 60);
        const m = finalMinutes % 60;
        const nearestSlot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        setStartTime(nearestSlot);
      }
    }
  }, [plan, selectedDurationIndex]);

  // Handle auto end-time calculation
  useEffect(() => {
    if (!startTime || !plan?.game) return;
    const [sh, sm] = startTime.split(":").map(Number);
    const totalMinutes = sh * 60 + sm + duration;
    const eh = Math.floor((totalMinutes % (24 * 60)) / 60);
    const em = totalMinutes % 60;
    const formattedEndTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    setEndTime(formattedEndTime);

    const isCross = (eh * 60 + em) < (sh * 60 + sm);
    setCrossMidnight(isCross);
  }, [startTime, duration, plan]);

  // Adjust duration clicks
  function handleDurationChange(direction: "up" | "down") {
    if (!plan?.game) return;
    const step = plan.game.duration;
    const max = plan.game.maximumDuration;
    if (direction === "up") {
      setDuration((prev) => Math.min(max, prev + step));
    } else {
      setDuration((prev) => Math.max(step, prev - step));
    }
  }

  async function handleBuyPlan() {
    if (!plan) return;

    setError("");

    const selectedDuration = plan.durations?.[selectedDurationIndex];

    if (plan.type === "FIXED" && !selectedDuration) {
      setError("Select plan duration");
      return;
    }

    if (plan.type === "FIXED" && plan.allowUserTimeSelection) {
      if (!startTime || !endTime) {
        setError("Select start time");
        return;
      }

      const sessionMinutes = duration;
      const minDuration = plan.game?.duration || 0;
      const maxDuration = plan.game?.maximumDuration || 0;

      if (sessionMinutes <= 0) {
        setError("End time must be after start time");
        return;
      }

      if (sessionMinutes < minDuration || sessionMinutes > maxDuration) {
        setError(
          `Session duration must be between ${minDuration} and ${maxDuration} minutes`
        );
        return;
      }

      if (sessionMinutes % minDuration !== 0) {
        setError(
          `Session duration must be in multiples of ${minDuration} minutes`
        );
        return;
      }
    }

    const redirect = `/player/payment?type=plan&planId=${plan._id}&durationIndex=${selectedDurationIndex}&startTime=${startTime}&endTime=${endTime}`;

    const authResponse = await fetch("/api/auth/me", {
      cache: "no-store",
    });

    if (authResponse.ok) {
      router.push(redirect);
      return;
    }

    router.push(`/auth/register?redirect=${encodeURIComponent(redirect)}`);
  }

  useEffect(() => {
    let active = true;
    fetch(`/api/plans/${planId}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Plan not found");
        return res.json();
      })
      .then((data) => {
        if (active) {
          setPlan(data.plan);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Failed to load plan");
        }
      });
    return () => {
      active = false;
    };
  }, [planId]);

  if (!plan) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-6">
        <p className="font-black text-[var(--primary)]">
          {error || "Loading plan..."}
        </p>
      </main>
    );
  }

  const selectedDuration = plan.durations?.[selectedDurationIndex];

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6">
      <section className="mx-auto max-w-md">
        <header className="flex items-center gap-3">
          <Link
            href="/player/membership"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
          >
            <ArrowLeft size={24} className="text-[var(--primary)]" />
          </Link>

          <h1 className="text-4xl font-black text-[var(--primary)]">
            Configure Plan
          </h1>
        </header>

        <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
            Selected Plan
          </p>

          <h2 className="mt-3 text-3xl font-black text-[var(--primary)]">
            {plan.name}
          </h2>

          <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
            {plan.type === "FIXED" ? plan.gameName : "Coin Recharge"}
          </p>

          {plan.type === "FIXED" && selectedDuration && (
            <>
              <p className="mt-4 text-3xl font-black text-[var(--primary)]">
                ₹{selectedDuration.finalPrice}
              </p>

              <p className="text-lg font-black text-[var(--text-muted)] line-through">
                ₹{selectedDuration.originalPrice}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {plan.durations?.map((duration, index) => (
                  <button
                    key={`${duration.label}-${index}`}
                    type="button"
                    onClick={() => setSelectedDurationIndex(index)}
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-black ${
                      selectedDurationIndex === index
                        ? "bg-[var(--primary)] text-white"
                        : "border-2 border-[var(--primary)] text-[var(--primary)]"
                    }`}
                  >
                    {duration.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {plan.type === "COINS" && (
            <p className="mt-4 text-3xl font-black text-[var(--primary)]">
              ₹{plan.price} → {(plan.coinsAmount || 0) + (plan.bonusCoins || 0)} coins
            </p>
          )}
        </section>

        {plan.type === "FIXED" && (
          <section className="mt-5 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h3 className="text-xl font-black text-[var(--primary)]">
              Session Configuration
            </h3>

            <div className="mt-4 grid gap-4">
              <label className="grid gap-1">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                  Game
                </span>
                <input
                  value={plan.game?.name || plan.gameName || ""}
                  disabled
                  className="h-14 rounded-full bg-[#EDEBE2] px-5 font-bold outline-none"
                />
              </label>

              <p className="rounded-2xl bg-[#EDEBE2] p-4 text-sm font-black text-[var(--primary)]">
                Session allowed: {plan.game?.duration || 0} to{" "}
                {plan.game?.maximumDuration || 0} minutes, in multiples of{" "}
                {plan.game?.duration || 0} minutes.
              </p>

              {plan.allowUserTimeSelection ? (
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <label className="grid gap-1 relative cursor-pointer">
                      <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                        Start Time
                      </span>
                      <div className="relative">
                        {plan.game?.fixedSlotBooking ? (
                          <select
                            value={startTime}
                            onChange={(event) => setStartTime(event.target.value)}
                            className="h-14 w-full rounded-full bg-white pl-12 pr-5 font-bold outline-none ring-1 ring-black/5 cursor-pointer appearance-none"
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
                            value={startTime}
                            onChange={(event) => setStartTime(event.target.value)}
                            onClick={(e) => {
                              try {
                                e.currentTarget.showPicker();
                              } catch (err) {}
                            }}
                            className="h-14 w-full rounded-full bg-white pl-12 pr-5 font-bold outline-none ring-1 ring-black/5 cursor-pointer"
                          />
                        )}
                        <Clock size={18} className="absolute left-4 top-4.5 text-[var(--primary)]/70 pointer-events-none" />
                      </div>
                    </label>

                    <div className="grid gap-1">
                      <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                        Duration
                      </span>
                      <div className="flex items-center h-14 rounded-full bg-[#EDEBE2] px-4 justify-center font-bold text-[var(--primary)]">
                        <span>{duration} Min</span>
                      </div>
                    </div>
                  </div>

                  {/* Calculated End Time Display */}
                  {startTime && (
                    <div className="p-4 rounded-2xl bg-gray-50 flex items-center justify-between text-sm font-bold text-[var(--primary)]">
                      <span>Calculated End Time:</span>
                      <span className="flex items-center gap-1 font-black">
                        {endTime} {crossMidnight && <span className="text-xs text-red-500 font-extrabold">(+1 Day)</span>}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="rounded-2xl bg-[#EDEBE2] p-4 text-sm font-black text-[var(--primary)]">
                  Fixed Time: {plan.adminStartTime} - {plan.adminEndTime}
                </p>
              )}
            </div>
          </section>
        )}

        {(validationError || error) && (
          <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-black text-red-500">
            {validationError || error}
          </p>
        )}

        <button
          onClick={handleBuyPlan}
          disabled={!!validationError}
          className="mt-6 h-16 w-full rounded-full bg-[var(--primary)] text-lg font-black text-white disabled:opacity-55 disabled:pointer-events-none"
        >
          Buy Plan
        </button>
      </section>
    </main>
  );
}