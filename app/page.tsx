"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Trophy, UserRound, UsersRound, Coins } from "lucide-react";

const actions = [
  { label: "Tournament", icon: Trophy, href: "/player/tournament" },
  { label: "Member", icon: UserRound, href: "/player/membership" },
  { label: "Booking", icon: UsersRound, href: "/player/visitor" },
  { label: "Company", icon: Building2, href: "/company" },
];

function HamburgerIcon() {
  return (
    <div className="flex h-10 w-10 flex-col items-end justify-center gap-2">
      <span className="h-0.5 w-8 rounded-full bg-[var(--primary)]" />
      <span className="h-0.5 w-6 rounded-full bg-[var(--primary)]" />
      <span className="h-0.5 w-4 rounded-full bg-[var(--primary)]" />
    </div>
  );
}

const hookMessages = [
  "🏸 Your next match is just a moment away...",
  "⚡ Preparing your arena...",
  "🎯 Champions don't wait. Neither do we.",
  "🔥 Welcome back to Akshar Game Zone.",
  "🏆 Every game begins with one click.",
  "🎮 Loading your gaming universe...",
  "🚀 Ready for another victory?",
  "💙 Welcome back, Player!"
];

export default function HomePage() {
  const router = useRouter();
  const [activeAd, setActiveAd] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [hookIndex, setHookIndex] = useState(0);

  // Authenticate session on load
  useEffect(() => {
    let active = true;

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.user) {
          setUser(data.user);
          // Redirect immediately depending on the user role
          if (data.user.role === "ADMIN" || data.user.hasRoleProfile) {
            router.replace("/admin/dashboard");
          } else if (data.user.role === "COMPANY_EMPLOYEE") {
            router.replace("/company/dashboard");
          } else {
            router.replace("/player/dashboard");
          }
        } else {
          setCheckingAuth(false);
        }
      })
      .catch(() => {
        if (active) setCheckingAuth(false);
      });

    fetch("/api/promotions?placement=HOME_HERO")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.promotions) {
          setPromotions(data.promotions);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [router]);

  // Rotate ads
  useEffect(() => {
    if (promotions.length === 0) return;
    const timer = setInterval(() => {
      setActiveAd((prev) => (prev + 1) % promotions.length);
    }, 2500);

    return () => clearInterval(timer);
  }, [promotions]);

  // Rotate loading screen hook messages
  useEffect(() => {
    if (!checkingAuth) return;
    const timer = setInterval(() => {
      setHookIndex((prev) => (prev + 1) % hookMessages.length);
    }, 1500);
    return () => clearInterval(timer);
  }, [checkingAuth]);

  const coins = user?.coins || 0;

  if (checkingAuth) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#0c2f1d] via-[#041a0f] to-black text-white p-6 select-none animate-pulse-slow">
        {/* Animated Sporty Graphic & Logo */}
        <div className="relative mb-8 flex flex-col items-center">
          <div className="relative h-28 w-28 animate-bounce">
            <Image
              src="/logo.png"
              alt="Akshar Game Zone Logo"
              fill
              priority
              className="object-contain filter drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
            />
          </div>
          <div className="absolute -bottom-2 h-1.5 w-16 rounded-full bg-white/20 blur-sm animate-scale" />
        </div>

        {/* Brand Text */}
        <h1 className="text-2xl font-black tracking-widest text-[#d8a83d] uppercase text-center mb-1">
          Akshar Game Zone
        </h1>
        <p className="text-[10px] tracking-[0.2em] font-extrabold text-emerald-400 uppercase text-center mb-12">
          Your Arena Awaits
        </p>

        {/* Hook Message */}
        <div className="h-12 flex items-center justify-center px-4 max-w-sm text-center">
          <p className="text-sm font-bold text-gray-200 transition-opacity duration-300">
            {hookMessages[hookIndex]}
          </p>
        </div>

        {/* Styled Progress Ring/Spinner */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#d8a83d] animate-ping" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div className="h-2 w-2 rounded-full bg-[#d8a83d] animate-ping [animation-delay:0.2s]" />
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-[var(--background)] opacity-0 animate-fade-in">
      <section className="mx-auto flex h-screen w-full max-w-md flex-col px-4 py-4 md:max-w-2xl lg:max-w-4xl">
        <header className="flex shrink-0 items-center justify-between pb-4">
          <div className="relative h-16 w-16">
            <Image
              src="/logo.png"
              alt="Akshar Game Zone Logo"
              fill
              priority
              className="object-contain"
            />
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <Link href="/player/membership/transactions" className="flex h-16 min-w-16 items-center justify-center gap-1 rounded-full bg-white px-4 shadow-sm ring-1 ring-black/5">
                <Coins size={31} className="text-[var(--primary)] animate-coin" />
                <span className="text-base font-black text-[var(--primary)]">
                  {coins}
                </span>
              </Link>
            )}

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Open menu"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
              >
                <HamburgerIcon />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-18 z-50 w-52 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-black/5">
                  <nav className="grid gap-1">
                    {user ? (
                      <>
                        <Link
                          href="/player/dashboard"
                          onClick={() => setMenuOpen(false)}
                          className="block rounded-xl px-4 py-2.5 text-sm font-black text-[var(--primary)] hover:bg-gray-50"
                        >
                          Dashboard
                        </Link>
                        <Link
                          href="/player/profile"
                          onClick={() => setMenuOpen(false)}
                          className="block rounded-xl px-4 py-2.5 text-sm font-black text-[var(--primary)] hover:bg-gray-50"
                        >
                          Profile
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
                      </>
                    ) : (
                      <Link
                        href="/auth/login"
                        onClick={() => setMenuOpen(false)}
                        className="block rounded-xl px-4 py-2.5 text-sm font-black text-[var(--primary)] hover:bg-gray-50"
                      >
                        Login
                      </Link>
                    )}
                  </nav>
                </div>
              )}
            </div>
          </div>
        </header>

        {promotions.length > 0 && (
          <section className="relative min-h-0 flex-1 overflow-hidden rounded-[2.5rem]">
            <div
              className="flex h-full transition-transform duration-700 ease-in-out"
              style={{
                width: `${promotions.length * 100}%`,
                transform: `translateX(-${activeAd * (100 / promotions.length)}%)`,
              }}
            >
              {promotions.map((promo, index) => {
                const content = (
                  <div className="relative h-full w-full">
                    {promo.imageUrl && (
                      <Image
                        src={promo.imageUrl}
                        alt={promo.title || "Promotion"}
                        fill
                        priority={index === 0}
                        className="object-cover object-center opacity-85"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-10 left-6 right-6 text-white">
                      <h3 className="text-2xl font-black md:text-3xl leading-snug">
                        {promo.title}
                      </h3>
                      {promo.description && (
                        <p className="mt-2 text-xs font-bold opacity-90 md:text-sm line-clamp-2">
                          {promo.description}
                        </p>
                      )}
                    </div>
                  </div>
                );

                const containerStyle = {
                  width: `${100 / promotions.length}%`,
                  background: promo.type === "TEXT"
                    ? (promo.backgroundColor || "var(--primary)")
                    : "black",
                };

                if (promo.ctaLink) {
                  return (
                    <Link
                      href={promo.ctaLink}
                      key={promo._id || index}
                      className="relative h-full overflow-hidden shadow-xl"
                      style={containerStyle}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div
                    key={promo._id || index}
                    className="relative h-full overflow-hidden shadow-xl"
                    style={containerStyle}
                  >
                    {content}
                  </div>
                );
              })}
            </div>

            <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2">
              {promotions.map((_, index) => (
                <button
                  key={index}
                  aria-label={`Show promotion ${index + 1}`}
                  onClick={() => setActiveAd(index)}
                  className={`h-2 rounded-full transition-all ${
                    activeAd === index
                      ? "w-7 bg-[var(--accent)]"
                      : "w-2 bg-white/50"
                  }`}
                />
              ))}
            </div>
          </section>
        )}

        <nav className="grid shrink-0 grid-cols-4 gap-3 pt-4">
          {actions.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                className="flex flex-col items-center gap-2"
              >
                <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                  <Icon size={34} className="text-[var(--primary)]" />
                </span>

                <span className="text-[11px] font-black text-[var(--primary)] md:text-sm">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </section>
    </main>
  );
}