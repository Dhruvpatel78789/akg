"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Coins, Dumbbell, Search, Wallet } from "lucide-react";

type DurationOption = {
  label: string;
  months: number;
  days?: number;
  playersIncluded: number;
  originalPrice: number;
  finalPrice: number;
};

type Plan = {
  _id: string;
  name: string;
  type: "FIXED" | "COINS";
  gameName?: string;
  durations?: DurationOption[];
  coinsAmount?: number;
  bonusCoins?: number;
  price?: number;
  dailyCoinSpendLimit?: number;
  active: boolean;
};

type Promotion = {
  _id: string;
  title: string;
  subtitle?: string;
  type: "TEXT" | "IMAGE" | "VIDEO";
  mediaUrl?: string;
  backgroundColor?: string;
};

const cardColors = ["#D7E528", "#93D1CC", "#F6401E", "#F8D66D", "#C7B8FF", "#B6F2A1"];

function getPlanColor(index: number) {
  return cardColors[index % cardColors.length];
}

function HamburgerIcon() {
  return (
    <div className="flex h-8 w-8 flex-col items-end justify-center gap-1.5">
      <span className="h-0.5 w-7 rounded-full bg-[var(--primary)]" />
      <span className="h-0.5 w-5 rounded-full bg-[var(--primary)]" />
      <span className="h-0.5 w-3 rounded-full bg-[var(--primary)]" />
    </div>
  );
}

function getDurationText(duration: DurationOption) {
  const months = duration.months || 0;
  const days = duration.days || 0;

  if (months > 0 && days > 0) return `${months}M ${days}D`;
  if (months > 0) return `${months}M`;
  return `${days}D`;
}

export default function MembershipPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedType, setSelectedType] = useState<"FIXED" | "COINS">("FIXED");
  const [selectedDurations, setSelectedDurations] = useState<Record<string, number>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/plans", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Plans API failed");
        return res.json();
      })
      .then((data) => {
        if (active) {
          setPlans(data.plans || []);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          setPlans([]);
          setLoading(false);
        }
      });

    fetch("/api/promotions?placement=MEMBERSHIP_TOP", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Promotions API failed");
        return res.json();
      })
      .then((data) => {
        if (active) {
          setPromotions(data.promotions || []);
        }
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          setPromotions([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      const matchesType = plan.type === selectedType;
      const text = `${plan.name} ${plan.gameName || ""}`.toLowerCase();
      const matchesSearch = text.includes(query.toLowerCase());

      return matchesType && matchesSearch;
    });
  }, [plans, selectedType, query]);



  return (
    <main
      onClick={() => {
        if (searchOpen) setSearchOpen(false);
      }}
      className="min-h-screen bg-[var(--background)] px-4 py-4"
    >
      <section className="mx-auto w-full max-w-md md:max-w-2xl lg:max-w-4xl">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
          >
            <ArrowLeft size={25} className="text-[var(--primary)]" />
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/player/membership/transactions"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
            >
              <Wallet size={23} className="text-[var(--primary)]" />
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
                      href="/player/membership"
                      className="block rounded-xl px-4 py-2.5 text-sm font-black text-[var(--primary)] hover:bg-gray-50"
                    >
                      Membership & Coins
                    </Link>
                    <Link
                      href="/player/membership/transactions"
                      className="block rounded-xl px-4 py-2.5 text-sm font-black text-[var(--primary)] hover:bg-gray-50"
                    >
                      Transactions
                    </Link>
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/auth/logout", { method: "POST" });
                        if (res.ok) {
                          window.location.href = "/auth/login";
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

        {promotions.length > 0 && (
          <section className="mt-7">
            <h1 className="text-4xl font-black text-[var(--primary)]">
              Popular
            </h1>

            <div className="mt-5 flex gap-4 overflow-x-auto pb-2">
              {promotions.map((promo) => (
                <article
                  key={promo._id}
                  className="relative h-40 min-w-[78%] overflow-hidden rounded-[2rem] p-5 shadow-sm ring-1 ring-black/5 md:min-w-[380px]"
                  style={{
                    background:
                      promo.type === "TEXT"
                        ? promo.backgroundColor || "#D7E528"
                        : "#111",
                  }}
                >
                  {promo.type === "IMAGE" && promo.mediaUrl && (
                    <img
                      src={promo.mediaUrl}
                      alt={promo.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}

                  {promo.type === "VIDEO" && promo.mediaUrl && (
                    <video
                      src={promo.mediaUrl}
                      className="absolute inset-0 h-full w-full object-cover"
                      muted
                      autoPlay
                      loop
                      playsInline
                    />
                  )}

                  <div className="absolute inset-0 bg-black/10" />

                  <div className="relative z-10">
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-white/50">
                      {promo.type}
                    </p>

                    <div className="absolute top-16">
                      <h2 className="text-2xl font-black leading-tight text-white">
                        {promo.title}
                      </h2>

                      {promo.subtitle && (
                        <p className="mt-2 text-sm font-bold text-white/80">
                          {promo.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section
          className="relative mt-5 flex items-center gap-2 overflow-hidden"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            onClick={() => setSelectedType("FIXED")}
            className={`h-12 flex-1 rounded-full text-sm font-black transition-all ${
              selectedType === "FIXED"
                ? "bg-[var(--primary)] text-white"
                : "bg-white text-[var(--primary)]"
            } ${searchOpen ? "-translate-x-[120%] opacity-0" : ""}`}
          >
            Fixed Membership
          </button>

          <button
            onClick={() => setSelectedType("COINS")}
            className={`h-12 flex-1 rounded-full text-sm font-black transition-all ${
              selectedType === "COINS"
                ? "bg-[var(--primary)] text-white"
                : "bg-white text-[var(--primary)]"
            } ${searchOpen ? "-translate-x-[120%] opacity-0" : ""}`}
          >
            Buy Coins
          </button>

          <div
            className={`flex h-12 items-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-all ${
              searchOpen ? "absolute left-0 right-0 px-4" : "w-12 justify-center"
            }`}
          >
            <Search
              size={22}
              onClick={() => setSearchOpen(true)}
              className="shrink-0 cursor-pointer text-[var(--primary)]"
            />

            {searchOpen && (
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search plans..."
                className="ml-3 w-full bg-transparent text-sm font-bold outline-none"
              />
            )}
          </div>
        </section>

        <section className="mt-7 grid gap-4">
          {loading && (
            <p className="font-black text-[var(--primary)]">Loading plans...</p>
          )}

          {!loading && filteredPlans.length === 0 && (
            <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h2 className="text-xl font-black text-[var(--primary)]">
                No plans found
              </h2>

              <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
                Create active plans from the admin panel first.
              </p>
            </section>
          )}

          {filteredPlans.map((plan, planIndex) => {
            const planColor = getPlanColor(planIndex);
            const selectedDurationIndex = selectedDurations[plan._id] ?? 0;
            const selectedDuration = plan.durations?.[selectedDurationIndex];

            return (
              <div
                key={plan._id}
                onClick={() => router.push(`/player/membership/configure/${plan._id}`)}
                className="relative w-full overflow-hidden rounded-[2rem] bg-white p-5 text-left shadow-sm ring-1 transition-all active:scale-[0.98] cursor-pointer"
                style={{ border: `2px solid ${planColor}` }}
              >
                {plan.type === "FIXED" ? (
                  <Dumbbell
                    size={74}
                    className="absolute -bottom-3 left-4 text-[var(--primary)]/10"
                  />
                ) : (
                  <Coins
                    size={74}
                    className="absolute -bottom-3 left-4 text-[var(--primary)]/10"
                  />
                )}

                <Dumbbell
                  size={64}
                  className="absolute -right-3 top-4 text-[var(--primary)]/10"
                />

                <div className="relative z-10">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
                    {plan.type === "FIXED" ? "Fixed Membership" : "Coin Plan"}
                  </p>

                  <h2 className="mt-3 text-2xl font-black text-[var(--primary)]">
                    {plan.name}
                  </h2>

                  {plan.type === "FIXED" && (
                    <p className="mt-1 text-sm font-bold text-[var(--text-muted)]">
                      {plan.gameName}
                    </p>
                  )}

                  <div className="mt-4">
                    {plan.type === "FIXED" && selectedDuration && (
                      <>
                        <p className="text-3xl font-black text-[var(--primary)]">
                          ₹{selectedDuration.finalPrice}
                        </p>

                        <p className="text-lg font-black text-[var(--text-muted)] line-through">
                          ₹{selectedDuration.originalPrice}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {plan.durations?.map((duration, index) => {
                            const active = selectedDurationIndex === index;

                            return (
                              <button
                                key={`${duration.label}-${duration.months}-${duration.days}-${duration.playersIncluded}`}
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();

                                  setSelectedDurations((prev) => ({
                                    ...prev,
                                    [plan._id]: index,
                                  }));
                                }}
                                className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-black transition-all ${
                                  active
                                    ? "bg-[var(--primary)] text-white"
                                    : "border-2 border-[var(--primary)] bg-transparent text-[var(--primary)]"
                                }`}
                              >
                                {duration.label || getDurationText(duration)}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {plan.type === "COINS" && (
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex flex-col text-left">
                          <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                            Coins
                          </span>
                          <span className="text-2xl font-black text-[var(--primary)]">
                            {(plan.coinsAmount || 0) + (plan.bonusCoins || 0)}
                          </span>
                        </div>
                        <div className="flex flex-col text-center">
                          <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                            Price
                          </span>
                          <span className="text-2xl font-black text-[var(--primary)]">
                            ₹{plan.price}
                          </span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                            Daily Limit
                          </span>
                          <span className="text-2xl font-black text-[var(--primary)]">
                            {plan.dailyCoinSpendLimit || 800}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </section>
    </main>
  );
}