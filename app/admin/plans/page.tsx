"use client";

import { Plus, Trash2, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";


type Game = {
  _id: string;
  name: string;
};

type DurationOption = {
  label: string;
  months: number;
  days: number;
  playersIncluded: number;
  originalPrice: number;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: number;
};

type Plan = {
  _id: string;
  name: string;
  type: "FIXED" | "COINS";
  gameName?: string;
  allowUserTimeSelection?: boolean;
  adminStartTime?: string;
  adminEndTime?: string;
  durations?: Array<DurationOption & { finalPrice: number }>;
  coinsAmount?: number;
  bonusCoins?: number;
  price?: number;
  dailyCoinSpendLimit?: number;
  validityValue?: number;
  validityUnit?: "DAYS" | "MONTHS";
  active: boolean;
};

const inputClass =
  "h-11 rounded-xl bg-[#EDEBE2] px-4 font-bold outline-none";

const selectClass =
  "h-11 appearance-none rounded-xl bg-[#EDEBE2] px-4 pr-12 font-bold outline-none";

const durationInputClass =
  "h-11 rounded-xl bg-[#F8F7F1] px-4 font-bold outline-none";

const durationSelectClass =
  "h-11 appearance-none rounded-xl bg-[#F8F7F1] px-4 pr-12 font-bold outline-none";

function calculateFinalPrice(duration: DurationOption) {
  if (duration.discountType === "PERCENTAGE") {
    return Math.max(
      0,
      duration.originalPrice -
        (duration.originalPrice * duration.discountValue) / 100
    );
  }

  return Math.max(0, duration.originalPrice - duration.discountValue);
}

export default function AdminPlansPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [message, setMessage] = useState("");
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const [form, setForm] = useState({
    name: "",
    type: "FIXED" as "FIXED" | "COINS",
    gameId: "",
    allowUserTimeSelection: true,
    adminStartTime: "",
    adminEndTime: "",
    coinsAmount: 500,
    bonusCoins: 0,
    price: 499,
    dailyCoinSpendLimit: 0,
    validityValue: 30,
    validityUnit: "DAYS" as "DAYS" | "MONTHS",
    active: true,
  });

  const [duration, setDuration] = useState<DurationOption>({
  label: "1M",
  months: 1,
  days: 0,
  playersIncluded: 1,
    originalPrice: 0,
    discountType: "PERCENTAGE",
    discountValue: 0,
  });

  const [durations, setDurations] = useState<DurationOption[]>([]);

  async function loadData() {
    const [plansRes, gamesRes] = await Promise.all([
      fetch("/api/admin/plans"),
      fetch("/api/admin/games"),
    ]);

    const plansData = await plansRes.json();
    const gamesData = await gamesRes.json();

    setPlans(plansData.plans || []);
    setGames(gamesData.games || []);

    if (!form.gameId && gamesData.games?.[0]) {
      setForm((prev) => ({ ...prev, gameId: gamesData.games[0]._id }));
    }
  }

  async function fetchPriceForPlayers(playersIncluded: number) {
    if (!form.gameId || form.type !== "FIXED") return;

    const response = await fetch(
      `/api/admin/games/${form.gameId}/pricing-preview`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
  playersIncluded,
  months: duration.months,
  days: duration.days,
}),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setDuration((prev) => ({ ...prev, originalPrice: 0 }));
      setMessage(data.message);
      return;
    }

    setMessage("");
    setDuration((prev) => ({
      ...prev,
      originalPrice: data.price,
    }));
  }

  function addDuration() {
    setMessage("");

    if (duration.originalPrice <= 0) {
      setMessage(
        "Price is not available for this player count. Create game pricing rule first."
      );
      return;
    }

    const exists = durations.some((item) => item.months === duration.months);

    if (exists) {
      setMessage(`Duration ${duration.months} months already exists`);
      return;
    }

    setDurations((prev) => [...prev, duration]);

    setDuration({
      label: "",
      months: 0,
      days: 1,
      playersIncluded: duration.playersIncluded,
      originalPrice: duration.originalPrice,
      discountType: "PERCENTAGE",
      discountValue: 0,
    });
  }

  function removeDuration(months: number) {
    setDurations((prev) => prev.filter((item) => item.months !== months));
  }

  async function createPlan(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    const payload =
      form.type === "FIXED"
        ? {
            name: form.name,
            type: "FIXED",
            gameId: form.gameId,
            allowUserTimeSelection: form.allowUserTimeSelection,
            adminStartTime: form.adminStartTime,
            adminEndTime: form.adminEndTime,
            durations: durations.map((item) => ({
  label: item.label,
  months: item.months,
  days: item.days,
  playersIncluded: item.playersIncluded,
              discountType: item.discountType,
              discountValue: item.discountValue,
            })),
            active: form.active,
          }
        : {
            name: form.name,
            type: "COINS",
            coinsAmount: form.coinsAmount,
            bonusCoins: form.bonusCoins,
            price: form.price,
            dailyCoinSpendLimit: form.dailyCoinSpendLimit,
            validityValue: form.validityValue,
            validityUnit: form.validityUnit,
            active: form.active,
          };

    const response = await fetch("/api/admin/plans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Failed to create plan");
      return;
    }

    setMessage("Plan created");
    setForm((prev) => ({ ...prev, name: "", dailyCoinSpendLimit: 0, validityValue: 30, validityUnit: "DAYS" }));
    setDurations([]);
    loadData();
  }

  async function saveEditedPlan(plan: Plan) {
    setMessage("");
    const response = await fetch(`/api/admin/plans/${plan._id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: plan.name,
        coinsAmount: plan.coinsAmount,
        bonusCoins: plan.bonusCoins,
        price: plan.price,
        dailyCoinSpendLimit: plan.dailyCoinSpendLimit,
        validityValue: plan.validityValue,
        validityUnit: plan.validityUnit,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Failed to update plan");
      return;
    }

    setMessage("Plan updated");
    setEditingPlan(null);
    loadData();
  }

  async function togglePlan(plan: Plan) {
    const response = await fetch(`/api/admin/plans/${plan._id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ active: !plan.active }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Failed to update plan");
      return;
    }

    setMessage("Plan updated");
    loadData();
  }

  async function deletePlan(planId: string) {
    const response = await fetch(`/api/admin/plans/${planId}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Failed to delete plan");
      return;
    }

    setMessage("Plan deleted");
    loadData();
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (form.type === "FIXED") {
      fetchPriceForPlayers(duration.playersIncluded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.gameId, duration.playersIncluded, duration.months, duration.days]);

  return (
    <section className="min-w-0">
      <h1 className="text-4xl font-black text-[var(--primary)]">Plans</h1>

      <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
        Create fixed membership plans and coin recharge plans.
      </p>

      {message && (
        <p className="mt-4 rounded-xl bg-white p-3 text-sm font-black text-[var(--primary)] ring-1 ring-black/5">
          {message}
        </p>
      )}

      <section className="mt-8 grid gap-8">
        <form onSubmit={createPlan} className="p-0">
          <h2 className="text-2xl font-black text-[var(--primary)]">
            Create Plan
          </h2>

          <div className="mt-5 grid gap-5">
            <div className="grid gap-4 xl:grid-cols-3">
              <label className="grid gap-1">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                  Plan Name
                </span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className={inputClass}
                />
              </label>

              <div className="relative grid gap-1">
  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
    Plan Type
  </span>

  <select
    value={form.type}
    onChange={(event) =>
      setForm((prev) => ({
        ...prev,
        type: event.target.value as "FIXED" | "COINS",
      }))
    }
    className={selectClass}
  >
    <option value="FIXED">Fixed Membership</option>
    <option value="COINS">Coin Recharge</option>
  </select>

  <ChevronDown
    size={18}
    className="pointer-events-none absolute right-4 top-[42px] text-gray-500"
  />
</div>

              <div className="relative grid gap-1">
  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
    Status
  </span>

  <select
    value={form.active ? "active" : "disabled"}
    onChange={(event) =>
      setForm((prev) => ({
        ...prev,
        active: event.target.value === "active",
      }))
    }
    className={selectClass}
  >
    <option value="active">Active</option>
    <option value="disabled">Disabled</option>
  </select>

  <ChevronDown
    size={18}
    className="pointer-events-none absolute right-4 top-[42px] text-gray-500"
  />
</div>
            </div>

            {form.type === "FIXED" && (
              <>
                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="relative grid gap-1">
  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
    Game
  </span>

  <select
    value={form.gameId}
    onChange={(event) =>
      setForm((prev) => ({
        ...prev,
        gameId: event.target.value,
      }))
    }
    className={selectClass}
  >
    {games.map((game) => (
      <option key={game._id} value={game._id}>
        {game.name}
      </option>
    ))}
  </select>

  <ChevronDown
    size={18}
    className="pointer-events-none absolute right-4 top-[42px] text-gray-500"
  />
</div>

                  <div className="relative grid gap-1">
  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
    Allow User Time Selection
  </span>

  <select
    value={form.allowUserTimeSelection ? "yes" : "no"}
    onChange={(event) =>
      setForm((prev) => ({
        ...prev,
        allowUserTimeSelection: event.target.value === "yes",
      }))
    }
    className={selectClass}
  >
    <option value="yes">Yes</option>
    <option value="no">No</option>
  </select>

  <ChevronDown
    size={18}
    className="pointer-events-none absolute right-4 top-[42px] text-gray-500"
  />
</div>

                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                      Players Included
                    </span>
                    <input
                      type="number"
                      value={duration.playersIncluded}
                      onChange={(event) =>
                        setDuration((prev) => ({
                          ...prev,
                          playersIncluded: Number(event.target.value),
                        }))
                      }
                      className={inputClass}
                    />
                  </label>
                </div>

                {!form.allowUserTimeSelection && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                        Admin Start Time
                      </span>
                      <input
                        type="time"
                        value={form.adminStartTime}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            adminStartTime: event.target.value,
                          }))
                        }
                        className={inputClass}
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                        Admin End Time
                      </span>
                      <input
                        type="time"
                        value={form.adminEndTime}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            adminEndTime: event.target.value,
                          }))
                        }
                        className={inputClass}
                      />
                    </label>
                  </div>
                )}

                <section className="rounded-[2rem] bg-white/70 p-5 shadow-sm ring-1 ring-black/5">
                  <h3 className="text-lg font-black text-[var(--primary)]">
                    Duration Pricing
                  </h3>

                  <div className="mt-4 grid gap-3 xl:grid-cols-4">
                    <label className="grid gap-1">
                      <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                        Label
                      </span>
                      <input
                        value={duration.label}
                        onChange={(event) =>
                          setDuration((prev) => ({
                            ...prev,
                            label: event.target.value,
                          }))
                        }
                        placeholder="1M / 3M"
                        className={durationInputClass}
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                        Months
                      </span>
                      <input
                        type="number"
                        value={duration.months}
                        onChange={(event) =>
                          setDuration((prev) => ({
                            ...prev,
                            months: Number(event.target.value),
                          }))
                        }
                        className={durationInputClass}
                      />
                    </label>
                    <label className="grid gap-1">
  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
    Days
  </span>
  <input
    type="number"
    value={duration.days}
    onChange={(event) =>
      setDuration((prev) => ({
        ...prev,
        days: Number(event.target.value),
      }))
    }
    className={durationInputClass}
  />
</label>

                    <div className="relative grid gap-1">
  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
    Discount Type
  </span>

  <select
    value={duration.discountType}
    onChange={(event) =>
      setDuration((prev) => ({
        ...prev,
        discountType: event.target
          .value as DurationOption["discountType"],
      }))
    }
    className={durationSelectClass}
  >
    <option value="PERCENTAGE">Percentage</option>
    <option value="FLAT">Flat</option>
  </select>

  <ChevronDown
    size={18}
    className="pointer-events-none absolute right-4 top-[42px] text-gray-500"
  />
</div>
                  </div>

                  <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr_1fr_52px]">
                    <label className="grid gap-1">
                      <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                        Price From Game Rule
                      </span>
                      <div className="flex h-11 items-center rounded-xl bg-[#F8F7F1] px-4 font-black text-[var(--primary)]">
                        ₹{duration.originalPrice}
                      </div>
                    </label>

                    <label className="grid gap-1">
                      <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                        Discount
                      </span>
                      <input
                        type="number"
                        value={duration.discountValue}
                        onChange={(event) =>
                          setDuration((prev) => ({
                            ...prev,
                            discountValue: Number(event.target.value),
                          }))
                        }
                        className={durationInputClass}
                      />
                    </label>

                    <div className="grid gap-1">
                      <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                        Final Price
                      </span>
                      <div className="flex h-11 items-center rounded-xl bg-[#F8F7F1] px-4 font-black text-[var(--primary)]">
                        ₹{calculateFinalPrice(duration)}
                      </div>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={addDuration}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-sm"
                      >
                        <Plus size={22} />
                      </button>
                    </div>
                  </div>

                  {durations.length > 0 && (
                    <div className="mt-5 overflow-x-auto">
                      <table className="w-full min-w-[650px] text-left text-sm">
                        <thead>
                          <tr className="border-b text-[var(--text-muted)]">
                            <th className="py-2">Label</th>
                            <th>Months</th>
                            <th>Days</th>
                            <th>Players</th>
                            <th>Original</th>
                            <th>Final</th>
                            <th></th>
                          </tr>
                        </thead>

                        <tbody>
                          {durations.map((item) => (
                            <tr key={item.months} className="border-b">
                              <td className="py-2 font-black">{item.label}</td>
                              <td>{item.months}</td>
                              <td>{item.days}</td>
                              <td>{item.playersIncluded}</td>
                              <td>₹{item.originalPrice}</td>
                              <td>₹{calculateFinalPrice(item)}</td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => removeDuration(item.months)}
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}

            {form.type === "COINS" && (
              <div className="grid gap-4 md:grid-cols-4">
                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                    Coins Given
                  </span>
                  <input
                    type="number"
                    value={form.coinsAmount}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        coinsAmount: Number(event.target.value),
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                    Bonus Coins
                  </span>
                  <input
                    type="number"
                    value={form.bonusCoins}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        bonusCoins: Number(event.target.value),
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                    Price
                  </span>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        price: Number(event.target.value),
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                    Daily Coin Spend Limit
                  </span>
                  <input
                    type="number"
                    value={form.dailyCoinSpendLimit}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        dailyCoinSpendLimit: Number(event.target.value),
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                <div className="grid gap-1">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                    Validity Duration
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      required
                      value={form.validityValue}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          validityValue: Number(event.target.value),
                        }))
                      }
                      className={`${inputClass} flex-1`}
                    />
                    <div className="relative flex items-center">
                      <select
                        value={form.validityUnit}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            validityUnit: event.target.value as "DAYS" | "MONTHS",
                          }))
                        }
                        className={selectClass}
                      >
                        <option value="DAYS">Days</option>
                        <option value="MONTHS">Months</option>
                      </select>
                      <ChevronDown
                        size={16}
                        className="pointer-events-none absolute right-4 text-[var(--primary)]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button className="h-12 rounded-xl bg-[var(--primary)] text-sm font-black text-white shadow-sm">
              Create Plan
            </button>
          </div>
        </form>

        <section className="overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-xl font-black text-[var(--primary)]">
            Plan List
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b text-[var(--text-muted)]">
                  <th className="py-3">Plan</th>
                  <th>Type</th>
                  <th>Game</th>
                  <th>Pricing</th>
                  <th>Time Selection</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {plans.map((plan) => {
                  const isEditing = editingPlan?._id === plan._id;

                  return (
                    <tr key={plan._id} className="border-b last:border-0">
                      <td className="py-3 font-black text-[var(--primary)]">
                        {isEditing ? (
                          <input
                            value={editingPlan.name}
                            onChange={(e) =>
                              setEditingPlan({ ...editingPlan, name: e.target.value })
                            }
                            className="border p-1 rounded font-bold text-sm bg-gray-50 text-[var(--primary)] w-full max-w-[150px]"
                          />
                        ) : (
                          plan.name
                        )}
                      </td>

                      <td>{plan.type}</td>

                      <td>{plan.gameName || "-"}</td>

                      <td>
                        {plan.type === "FIXED" ? (
                          plan.durations
                            ?.map(
                              (item) =>
                               `${item.label} (${item.months}M ${item.days}D, ${item.playersIncluded}P): ₹${item.finalPrice}`
                            )
                            .join(", ")
                        ) : isEditing ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <label className="flex items-center gap-1">
                              <span>Price:</span>
                              <input
                                type="number"
                                value={editingPlan.price || 0}
                                onChange={(e) =>
                                  setEditingPlan({ ...editingPlan, price: Number(e.target.value) })
                                }
                                className="border p-1 rounded font-bold w-16"
                              />
                            </label>
                            <label className="flex items-center gap-1">
                              <span>Coins:</span>
                              <input
                                type="number"
                                value={editingPlan.coinsAmount || 0}
                                onChange={(e) =>
                                  setEditingPlan({ ...editingPlan, coinsAmount: Number(e.target.value) })
                                }
                                className="border p-1 rounded font-bold w-16"
                              />
                            </label>
                            <label className="flex items-center gap-1">
                              <span>Bonus:</span>
                              <input
                                type="number"
                                value={editingPlan.bonusCoins || 0}
                                onChange={(e) =>
                                  setEditingPlan({ ...editingPlan, bonusCoins: Number(e.target.value) })
                                }
                                className="border p-1 rounded font-bold w-12"
                              />
                            </label>
                            <label className="flex items-center gap-1">
                              <span>Limit:</span>
                              <input
                                type="number"
                                value={editingPlan.dailyCoinSpendLimit || 0}
                                onChange={(e) =>
                                  setEditingPlan({ ...editingPlan, dailyCoinSpendLimit: Number(e.target.value) })
                                }
                                className="border p-1 rounded font-bold w-16"
                              />
                            </label>
                            <label className="flex items-center gap-1">
                              <span>Val:</span>
                              <input
                                type="number"
                                min="1"
                                value={editingPlan.validityValue ?? 30}
                                onChange={(e) =>
                                  setEditingPlan({ ...editingPlan, validityValue: Number(e.target.value) })
                                }
                                className="border p-1 rounded font-bold w-12"
                              />
                              <select
                                value={editingPlan.validityUnit ?? "DAYS"}
                                onChange={(e) =>
                                  setEditingPlan({ ...editingPlan, validityUnit: e.target.value as "DAYS" | "MONTHS" })
                                }
                                className="border p-0.5 rounded font-bold text-xs"
                              >
                                <option value="DAYS">Days</option>
                                <option value="MONTHS">Months</option>
                              </select>
                            </label>
                          </div>
                        ) : (
                          `₹${plan.price} → ${(plan.coinsAmount || 0) + (plan.bonusCoins || 0)} coins (Limit: ${plan.dailyCoinSpendLimit || 0}/day, Exp: ${plan.validityValue ?? 30} ${plan.validityUnit ?? "DAYS"})`
                        )}
                      </td>

                      <td>
                        {plan.type === "FIXED"
                          ? plan.allowUserTimeSelection
                            ? "User selected"
                            : `${plan.adminStartTime} - ${plan.adminEndTime}`
                          : "-"}
                      </td>

                      <td>{plan.active ? "Active" : "Disabled"}</td>

                      <td className="flex gap-2 py-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEditedPlan(editingPlan)}
                              className="rounded-lg bg-green-500 px-3 py-2 text-xs font-black text-white"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingPlan(null)}
                              className="rounded-lg bg-gray-500 px-3 py-2 text-xs font-black text-white"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingPlan(plan)}
                              className="rounded-lg bg-blue-500 px-3 py-2 text-xs font-black text-white"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => togglePlan(plan)}
                              className="rounded-lg bg-[#D7E528] px-3 py-2 text-xs font-black text-[var(--primary)]"
                            >
                              {plan.active ? "Disable" : "Enable"}
                            </button>
                            <button
                              onClick={() => deletePlan(plan._id)}
                              className="rounded-lg bg-red-500 px-3 py-2 text-xs font-black text-white"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {plans.length === 0 && (
              <p className="mt-5 text-sm font-bold text-[var(--text-muted)]">
                No plans created yet.
              </p>
            )}
          </div>
        </section>
      </section>
    </section>
  );
}