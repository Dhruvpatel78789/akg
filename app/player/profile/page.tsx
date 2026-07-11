"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Lock, Calendar, Eye, EyeOff, CheckCircle2, AlertCircle, ChevronLeft, Coins } from "lucide-react";

type UserProfile = {
  _id: string;
  name: string;
  phone: string;
  email: string;
  dob?: string;
  coins: number;
  role?: string;
  mustChangePassword?: boolean;
  activePlanId?: string;
  coinPlanExpiryDate?: string;
  coinsAvailable?: number;
  coinsFrozen?: number;
  coinsFrozenReason?: string;
  coinsFrozenAt?: string;
};

function HamburgerIcon() {
  return (
    <div className="flex h-10 w-10 flex-col items-end justify-center gap-2">
      <span className="h-0.5 w-8 rounded-full bg-[var(--primary)]" />
      <span className="h-0.5 w-6 rounded-full bg-[var(--primary)]" />
      <span className="h-0.5 w-4 rounded-full bg-[var(--primary)]" />
    </div>
  );
}

function PlayerProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const changePasswordRequired = searchParams.get("changePasswordRequired") === "true";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  // Profile Edit states
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [dobInput, setDobInput] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // Password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me");
      if (res.status === 401) {
        router.replace("/auth/login?redirect=/player/profile");
        return;
      }
      const data = await res.json();
      if (res.ok && data?.user) {
        setProfile(data.user);
        setNameInput(data.user.name || "");
        setPhoneInput(data.user.phone || "");
        setEmailInput(data.user.email || "");
        if (data.user.dob) {
          setDobInput(new Date(data.user.dob).toISOString().split("T")[0]);
        }
      } else {
        router.replace("/auth/login?redirect=/player/profile");
      }
    } catch {
      router.replace("/auth/login?redirect=/player/profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    if (!nameInput.trim()) {
      setProfileError("Name is required.");
      return;
    }
    if (!/^\d{10}$/.test(phoneInput.trim())) {
      setProfileError("Phone number must be exactly 10 digits.");
      return;
    }
    if (emailInput.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) {
      setProfileError("Please enter a valid email address.");
      return;
    }
    if (dobInput) {
      const selectedDob = new Date(dobInput);
      if (selectedDob > new Date()) {
        setProfileError("Date of Birth cannot be in the future.");
        return;
      }
    }

    setProfileSubmitting(true);
    try {
      const res = await fetch("/api/player/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameInput,
          phone: phoneInput,
          email: emailInput,
          dob: dobInput || null
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProfileSuccess("Profile updated successfully!");
        setProfile((prev) => prev ? {
          ...prev,
          name: nameInput,
          phone: phoneInput,
          email: emailInput,
          dob: dobInput || undefined
        } : null);
      } else {
        setProfileError(data.message || "Failed to update profile.");
      }
    } catch {
      setProfileError("Connection error. Please try again.");
    } finally {
      setProfileSubmitting(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All password fields are required");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setPasswordSubmitting(true);

    try {
      const res = await fetch("/api/player/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordSuccess("Password changed successfully.");
        setProfile((prev) => prev ? { ...prev, mustChangePassword: false } : null);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordError(data.message || "Failed to change password");
      }
    } catch {
      setPasswordError("Connection error. Please try again.");
    } finally {
      setPasswordSubmitting(false);
    }
  }

  function formatDob(dobString?: string) {
    if (!dobString) return "";
    const date = new Date(dobString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="font-black text-[var(--primary)] text-lg animate-pulse">Loading profile...</p>
      </main>
    );
  }

  if (!profile) return null;

  return (
    <main className="min-h-screen bg-[var(--background)] pb-12">
      <section className="mx-auto w-full max-w-md px-4 py-4 md:max-w-2xl">
        <header className="flex items-center justify-between pb-4">
          <Link
            href="/player/dashboard"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 hover:bg-gray-50 active:scale-95 transition-all"
          >
            <ChevronLeft size={24} className="text-[var(--primary)]" />
          </Link>

          <h1 className="text-xl font-black text-[var(--primary)]">My Profile</h1>

          <div className="flex items-center gap-3">
            <Link href="/player/coins/history" className="flex h-16 min-w-16 items-center justify-center gap-1 rounded-full bg-white px-4 shadow-sm ring-1 ring-black/5">
              <Coins size={23} className="text-[var(--primary)] animate-coin" />
              <span className="text-sm font-black text-[var(--primary)]">
                {profile.coinsAvailable ?? profile.coins ?? 0} Coins
                {profile.coinsFrozen ? (profile.coinsFrozen > 0 && <span className="ml-0.5 text-xs">❄️</span>) : null}
              </span>
            </Link>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
              >
                <HamburgerIcon />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-18 z-50 w-52 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-black/5">
                  <nav className="grid gap-1">
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
                      className="block rounded-xl px-4 py-2.5 text-sm font-black text-[var(--primary)] hover:bg-gray-50 bg-gray-50"
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
                  </nav>
                </div>
              )}
            </div>
          </div>
        </header>

        {(changePasswordRequired || profile?.mustChangePassword) && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-[2rem] p-5 text-sm font-bold text-amber-800 flex flex-col gap-1.5 shadow-sm">
            <h4 className="flex items-center gap-2 text-base font-black">
              <AlertCircle size={20} className="text-amber-600 animate-pulse" />
              Password Change Required
            </h4>
            <p className="text-xs">
              For security reasons, your account was created with a temporary default password. Please update your password below to secure your account. Other actions are disabled until this is completed.
            </p>
          </div>
        )}

        {/* Profile Card */}
        <section className="mt-4 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                <User size={32} />
              </div>
              <div>
                <h2 className="text-xl font-black text-[var(--primary)]">{profile.name}</h2>
                <p className="text-xs font-bold text-[var(--text-muted)]">Player Profile Account</p>
              </div>
            </div>

            {/* Account Type Badge */}
            <div className="text-right">
              {profile.activePlanId ? (
                profile.coinPlanExpiryDate ? (
                  <span className="bg-purple-50 text-purple-800 border border-purple-100 px-3 py-1.5 rounded-full text-xs font-black">COIN MEMBER</span>
                ) : (
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1.5 rounded-full text-xs font-black">MEMBER</span>
                )
              ) : (
                <span className="bg-gray-100 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-full text-xs font-black">PLAYER</span>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid gap-1">
              <label className="text-xs font-bold text-[var(--text-muted)]">Name</label>
              <input
                required
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full h-11 rounded-xl bg-gray-50 px-4 text-xs outline-none border border-gray-100 font-bold focus:ring-1 focus:ring-[var(--primary)] text-gray-700"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-bold text-[var(--text-muted)]">Phone Number</label>
              <input
                required
                type="text"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="w-full h-11 rounded-xl bg-gray-50 px-4 text-xs outline-none border border-gray-100 font-bold focus:ring-1 focus:ring-[var(--primary)] text-gray-700"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-bold text-[var(--text-muted)]">Email Address</label>
              <input
                type="email"
                placeholder="Add your email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full h-11 rounded-xl bg-gray-50 px-4 text-xs outline-none border border-gray-100 font-bold focus:ring-1 focus:ring-[var(--primary)] text-gray-700"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-bold text-[var(--text-muted)]">Date of Birth</label>
              <input
                type="date"
                value={dobInput}
                onChange={(e) => setDobInput(e.target.value)}
                disabled={!!profile.dob}
                className="w-full h-11 rounded-xl bg-gray-55 px-4 text-xs outline-none border border-gray-100 font-bold focus:ring-1 focus:ring-[var(--primary)] text-gray-700 disabled:opacity-70"
              />
              {profile.dob && (
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">Date of Birth is set and cannot be changed.</p>
              )}
            </div>

            {profileError && (
              <p className="text-xs font-bold text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                {profileError}
              </p>
            )}

            {profileSuccess && (
              <p className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle2 size={12} />
                {profileSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={profileSubmitting || !!profile.mustChangePassword}
              className="h-11 rounded-full bg-[var(--primary)] text-white px-6 text-xs font-black hover:opacity-90 active:scale-95 transition disabled:opacity-50"
            >
              {profileSubmitting ? "Saving..." : profile.mustChangePassword ? "Change Password First" : "Save Profile Details"}
            </button>
          </form>
        </section>

        {/* Change Password Card */}
        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h3 className="text-lg font-black text-[var(--primary)] flex items-center gap-2 border-b pb-3 mb-4">
            <Lock size={18} className="text-gray-400" />
            Change Password
          </h3>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid gap-1">
              <label className="text-xs font-bold text-[var(--text-muted)]">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  placeholder="Enter current password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full h-12 rounded-xl bg-gray-55 pl-4 pr-12 text-xs outline-none border border-gray-100 font-bold focus:ring-1 focus:ring-[var(--primary)] text-gray-700"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-bold text-[var(--text-muted)]">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-12 rounded-xl bg-gray-55 pl-4 pr-12 text-xs outline-none border border-gray-100 font-bold focus:ring-1 focus:ring-[var(--primary)] text-gray-700"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-bold text-[var(--text-muted)]">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm new password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-12 rounded-xl bg-gray-55 pl-4 pr-12 text-xs outline-none border border-gray-100 font-bold focus:ring-1 focus:ring-[var(--primary)] text-gray-700"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {passwordError && (
              <p className="text-xs font-bold text-red-500 flex items-center gap-1 justify-center pt-1">
                <AlertCircle size={14} />
                {passwordError}
              </p>
            )}

            {passwordSuccess && (
              <p className="text-xs font-bold text-emerald-600 flex items-center gap-1 justify-center pt-1">
                <CheckCircle2 size={14} />
                {passwordSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={passwordSubmitting}
              className="w-full h-12 mt-2 rounded-full bg-[var(--primary)] text-white text-xs font-black hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2 shadow-md"
            >
              {passwordSubmitting ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

export default function PlayerProfilePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="font-black text-[var(--primary)] text-lg animate-pulse">Loading profile...</p>
      </main>
    }>
      <PlayerProfileForm />
    </Suspense>
  );
}
