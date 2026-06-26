"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Lock, Calendar, Eye, EyeOff, CheckCircle2, AlertCircle, ChevronLeft, Coins } from "lucide-react";

type UserProfile = {
  _id: string;
  name: string;
  phone: string;
  email: string;
  dob?: string;
  coins: number;
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

export default function PlayerProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  // DOB states
  const [dobInput, setDobInput] = useState("");
  const [dobError, setDobError] = useState("");
  const [dobSuccess, setDobSuccess] = useState("");
  const [dobSubmitting, setDobSubmitting] = useState(false);

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

  async function handleSaveDob(e: React.FormEvent) {
    e.preventDefault();
    if (!dobInput) return;

    setDobSubmitting(true);
    setDobError("");
    setDobSuccess("");

    try {
      const res = await fetch("/api/player/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob: dobInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDobSuccess("Date of Birth added successfully!");
        setProfile((prev) => prev ? { ...prev, dob: dobInput } : null);
      } else {
        setDobError(data.message || "Failed to save Date of Birth");
      }
    } catch {
      setDobError("Connection error. Please try again.");
    } finally {
      setDobSubmitting(false);
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
            <Link href="/player/membership/transactions" className="flex h-16 min-w-16 items-center justify-center gap-1 rounded-full bg-white px-4 shadow-sm ring-1 ring-black/5">
              <Coins size={23} className="text-[var(--primary)] animate-coin" />
              <span className="text-sm font-black text-[var(--primary)]">
                {profile.coins}
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

        {/* Profile Card */}
        <section className="mt-4 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-6">
          <div className="flex items-center gap-4 border-b pb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
              <User size={32} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--primary)]">{profile.name}</h2>
              <p className="text-xs font-bold text-[var(--text-muted)]">Player Profile Account</p>
            </div>
          </div>

          <div className="grid gap-4 text-sm font-bold">
            <div className="flex justify-between border-b pb-2.5 border-gray-100">
              <span className="text-gray-400">Phone</span>
              <span className="text-[var(--primary)]">{profile.phone}</span>
            </div>
            <div className="flex justify-between border-b pb-2.5 border-gray-100">
              <span className="text-gray-400">Email</span>
              <span className="text-[var(--primary)]">{profile.email}</span>
            </div>

            {/* DOB Section */}
            <div className="border-b pb-2.5 border-gray-100 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Date of Birth</span>
                {profile.dob ? (
                  <span className="text-[var(--primary)]">{formatDob(profile.dob)}</span>
                ) : (
                  <span className="text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full text-xs font-black">Missing DOB</span>
                )}
              </div>

              {!profile.dob ? (
                <form onSubmit={handleSaveDob} className="mt-2 flex gap-2">
                  <input
                    type="date"
                    required
                    value={dobInput}
                    onChange={(e) => setDobInput(e.target.value)}
                    className="h-11 flex-1 rounded-xl bg-gray-50 px-3 text-xs outline-none border border-gray-100 focus:ring-1 focus:ring-[var(--primary)] text-gray-700 font-black"
                  />
                  <button
                    type="submit"
                    disabled={dobSubmitting}
                    className="h-11 rounded-xl bg-[var(--primary)] text-white px-4 text-xs font-black hover:opacity-90 active:scale-95 transition"
                  >
                    {dobSubmitting ? "Adding..." : "Add DOB"}
                  </button>
                </form>
              ) : null}

              {dobError && (
                <p className="text-xs font-bold text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {dobError}
                </p>
              )}

              {dobSuccess && (
                <p className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  {dobSuccess}
                </p>
              )}
            </div>
          </div>
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
