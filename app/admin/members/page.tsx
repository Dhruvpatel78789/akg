"use client";

import { useEffect, useState } from "react";
import { X, FileSpreadsheet, Printer, User, Award, Calendar, History, CreditCard } from "lucide-react";

type Member = {
  _id: string;
  name: string;
  phone: string;
  email: string;
  coins: number;
  coinsAvailable?: number;
  coinsFrozen?: number;
  coinsFrozenReason?: string;
  coinsFrozenAt?: string;
  rewardCoins?: number;
  daysLeft: number;
  isFixedMember: boolean;
  isCoinsMember: boolean;
  planName?: string;
  membershipType?: "FIXED" | "FLEXIBLE" | "COINS" | null;
  canRescheduleFixedMembership: boolean;
  createdAt: string;
};

type HistoryProfile = {
  user: {
    _id: string;
    name: string;
    phone: string;
    email: string;
    dob?: string;
    coins: number;
    coinsAvailable?: number;
    coinsFrozen?: number;
    coinsFrozenReason?: string;
    coinsFrozenAt?: string;
    rewardCoins?: number;
  };
  memberships: any[];
  bookings: any[];
  playedSessions: any[];
  totalHoursPlayed: number;
  transactions: any[];
  refunds: any[];
  cancellations: any[];
};

function mergeById<T extends { _id: string }>(current: T[], incoming: T[]): T[] {
  const incomingMap = new Map(incoming.map((item) => [item._id, item]));

  const updated = current
    .map((item) => incomingMap.get(item._id) || item)
    .filter((item) => incomingMap.has(item._id));

  const existingIds = new Set(current.map((item) => item._id));
  const added = incoming.filter((item) => !existingIds.has(item._id));

  return [...added, ...updated];
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("createdAt_desc");
  const [membershipStatus, setMembershipStatus] = useState("ALL");
  const [minCoins, setMinCoins] = useState("");
  const [maxCoins, setMaxCoins] = useState("");
  const [regStart, setRegStart] = useState("");
  const [regEnd, setRegEnd] = useState("");

  // Column visibility states
  const [showPhone, setShowPhone] = useState(true);
  const [showEmail, setShowEmail] = useState(true);
  const [showCoins, setShowCoins] = useState(true);
  const [showMembership, setShowMembership] = useState(true);
  const [showDaysLeft, setShowDaysLeft] = useState(true);
  const [showReschedule, setShowReschedule] = useState(true);

  // History modal states
  const [activeProfile, setActiveProfile] = useState<HistoryProfile | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTab, setModalTab] = useState<"overview" | "memberships" | "bookings" | "transactions" | "coins">("overview");

  // Coin Adjustment States
  const [coinAction, setCoinAction] = useState<"ADD" | "DEDUCT" | "FREEZE" | "UNFREEZE">("ADD");
  const [coinAmount, setCoinAmount] = useState("");
  const [coinReason, setCoinReason] = useState("");
  const [adjustingCoins, setAdjustingCoins] = useState(false);

  // Create Membership States
  const [showCreateMembershipModal, setShowCreateMembershipModal] = useState(false);
  const [games, setGames] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [createMemForm, setCreateMemForm] = useState({
    assignmentType: "MEMBERSHIP", // "MEMBERSHIP" | "COIN_PLAN" | "ADD_COINS"
    name: "",
    phone: "",
    email: "",
    planId: "",
    durationIndex: 0,
    gameId: "",
    startTime: "",
    endTime: "",
    startDate: new Date().toISOString().split("T")[0],
    coinsToAdd: "",
    reason: "",
    offlinePaymentNote: ""
  });
  const [matches, setMatches] = useState<any[]>([]);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmUserId, setConfirmUserId] = useState("");
  const [existingPlayer, setExistingPlayer] = useState<any | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [visitorConversionRequired, setVisitorConversionRequired] = useState(false);
  const [visitorConversionPlayer, setVisitorConversionPlayer] = useState<any | null>(null);
  const [createMemSubmitting, setCreateMemSubmitting] = useState(false);
  const [createMemError, setCreateMemError] = useState("");
  const [createMemSuccess, setCreateMemSuccess] = useState("");

  // Reset Password States
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordTargetId, setResetPasswordTargetId] = useState<string | null>(null);
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [resetPasswordReason, setResetPasswordReason] = useState("");
  const [resetPasswordSubmitting, setResetPasswordSubmitting] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState("");

  async function loadMembers(isBackground = false) {
    if (!isBackground) {
      if (members.length === 0) setInitialLoading(true);
    } else {
      setRefreshing(true);
    }
    const params = new URLSearchParams({
      search,
      sort,
      membershipStatus,
      minCoins,
      maxCoins,
      regStart,
      regEnd,
    });
    try {
      const response = await fetch(`/api/admin/members?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        const incoming = data.members || [];
        setMembers((prev) => {
          if (!isBackground || prev.length === 0) return incoming;
          return mergeById(prev, incoming);
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }

  async function toggleReschedule(member: Member) {
    const response = await fetch(
      `/api/admin/members/${member._id}/reschedule`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          canRescheduleFixedMembership:
            !member.canRescheduleFixedMembership,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Failed to update member");
      return;
    }

    setMessage("Member updated");
    loadMembers();
  }

  function addMinutesToTime(timeStr: string, minutes: number) {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const total = h * 60 + m + minutes;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
  }

  async function handleCreateMembershipClick() {
    setCreateMemError("");
    setCreateMemSuccess("");
    setCreateMemForm({
      assignmentType: "MEMBERSHIP",
      name: "",
      phone: "",
      email: "",
      planId: "",
      durationIndex: 0,
      gameId: "",
      startTime: "",
      endTime: "",
      startDate: new Date().toISOString().split("T")[0],
      coinsToAdd: "",
      reason: "",
      offlinePaymentNote: ""
    });
    setMatches([]);
    setNeedsConfirmation(false);
    setConfirmUserId("");
    setExistingPlayer(null);
    setSearchQuery("");
    setVisitorConversionRequired(false);
    setVisitorConversionPlayer(null);
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setShowCreateMembershipModal(true);

    try {
      const [resGames, resPlans] = await Promise.all([
        fetch("/api/games"),
        fetch("/api/admin/plans")
      ]);
      const dataGames = await resGames.json();
      const dataPlans = await resPlans.json();
      setGames(dataGames.games || []);
      setPlans((dataPlans.plans || []).filter((p: any) => p.active && !p.softDeleted));
    } catch (err: any) {
      setCreateMemError("Failed to load plans and games list: " + err.message);
    }
  }

  async function handlePlayerSearch(val: string) {
    setSearchQuery(val);
    if (!val || val.trim().length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/player-search?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (res.ok && data.results) {
        setSearchSuggestions(data.results);
        setShowSuggestions(data.results.length > 0);
      }
    } catch (err) {
      console.error("Autocomplete search failed", err);
    }
  }

  async function handleSelectSuggestion(player: any) {
    setConfirmUserId(player.id);
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setSearchQuery("");

    // Check if Visitor Conversion is required
    if (player.accountType === "Visitor" || player.role === "VISITOR") {
      setVisitorConversionPlayer(player);
      setVisitorConversionRequired(true);
      return;
    }

    try {
      const res = await fetch("/api/admin/members/create-membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentType: createMemForm.assignmentType,
          phone: player.phone,
          confirmUserId: player.id,
          checkOnly: true
        })
      });
      const data = await res.json();
      if (res.ok && data.player) {
        setExistingPlayer(data.player);
        setCreateMemForm(prev => ({
          ...prev,
          name: data.player.name,
          phone: data.player.phone,
          email: data.player.email || ""
        }));
      } else {
        setExistingPlayer({
          _id: player.id,
          name: player.name,
          phone: player.phone,
          email: player.email,
          coins: player.coins ?? 0,
          currentMembership: player.currentMembership || "None",
          currentCoinPlan: player.currentCoinPlan || "None"
        });
        setCreateMemForm(prev => ({
          ...prev,
          name: player.name,
          phone: player.phone,
          email: player.email || ""
        }));
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleConfirmVisitorConversion() {
    if (!visitorConversionPlayer) return;
    const player = visitorConversionPlayer;
    setVisitorConversionRequired(false);
    setVisitorConversionPlayer(null);

    try {
      const res = await fetch("/api/admin/members/create-membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentType: createMemForm.assignmentType,
          phone: player.phone,
          confirmUserId: player.id,
          checkOnly: true
        })
      });
      const data = await res.json();
      if (res.ok && data.player) {
        setExistingPlayer(data.player);
        setCreateMemForm(prev => ({
          ...prev,
          name: data.player.name,
          phone: data.player.phone,
          email: data.player.email || ""
        }));
      } else {
        setExistingPlayer({
          _id: player.id,
          name: player.name,
          phone: player.phone,
          email: player.email,
          coins: player.coins ?? 0,
          currentMembership: player.currentMembership || "None",
          currentCoinPlan: player.currentCoinPlan || "None"
        });
        setCreateMemForm(prev => ({
          ...prev,
          name: player.name,
          phone: player.phone,
          email: player.email || ""
        }));
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateMembershipSubmit(e: React.FormEvent, checkOnly = false) {
    e.preventDefault();
    setCreateMemError("");
    setCreateMemSuccess("");
    setCreateMemSubmitting(true);

    try {
      const res = await fetch("/api/admin/members/create-membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createMemForm,
          confirmUserId,
          checkOnly
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateMemError(data.message || "Failed to submit assignment.");
        setCreateMemSubmitting(false);
        return;
      }

      if (data.needsConfirmation) {
        setMatches(data.matches);
        setNeedsConfirmation(true);
        setCreateMemSubmitting(false);
        return;
      }

      if (checkOnly) {
        // Validation succeeded without duplicates, proceed to final activation
        await handleCreateMembershipSubmit(e, false);
        return;
      }

      setCreateMemSuccess(data.message || "Action processed successfully!");
      setTimeout(() => {
        setShowCreateMembershipModal(false);
        loadMembers();
      }, 1500);

    } catch (err: any) {
      setCreateMemError("Network error: " + err.message);
    } finally {
      setCreateMemSubmitting(false);
    }
  }

  function handleResetPasswordClick(userId: string) {
    setResetPasswordTargetId(userId);
    setAdminConfirmPassword("");
    setResetPasswordReason("");
    setResetPasswordError("");
    setResetPasswordSuccess("");
    setShowResetPasswordModal(true);
  }

  async function handleResetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResetPasswordError("");
    setResetPasswordSuccess("");
    setResetPasswordSubmitting(true);

    try {
      const res = await fetch(`/api/admin/members/${resetPasswordTargetId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPassword: adminConfirmPassword,
          reason: resetPasswordReason
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResetPasswordSuccess(data.message);
        setTimeout(() => {
          setShowResetPasswordModal(false);
        }, 2000);
      } else {
        setResetPasswordError(data.message || "Password reset failed.");
      }
    } catch (err: any) {
      setResetPasswordError("Network error: " + err.message);
    } finally {
      setResetPasswordSubmitting(false);
    }
  }

  function handleCSVExport() {
    const headers = ["Name", "Phone", "Email", "Coins", "Membership Type", "Plan", "Days Left", "Reschedule Allowed", "Registration Date"];
    const rows = members.map((m) => [
      m.name,
      m.phone,
      m.email,
      m.coins,
      m.membershipType || "NONE",
      m.planName || "N/A",
      m.isFixedMember ? m.daysLeft : "N/A",
      m.canRescheduleFixedMembership ? "Yes" : "No",
      new Date(m.createdAt).toLocaleDateString("en-IN"),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map(val => `"${val}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `members_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleOpenHistory(memberId: string) {
    setModalLoading(true);
    setModalTab("overview");
    try {
      const response = await fetch(`/api/admin/members/${memberId}/history`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setActiveProfile(data.profile);
      } else {
        setMessage(data.message || "Failed to load member profile history");
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to load profile details");
    } finally {
      setModalLoading(false);
    }
  }

  async function handleAdjustCoins() {
    if (!activeProfile) return;
    if ((coinAction === "ADD" || coinAction === "DEDUCT") && (!coinAmount || Number(coinAmount) <= 0)) {
      alert("Please enter a valid amount");
      return;
    }

    setAdjustingCoins(true);
    try {
      const response = await fetch(`/api/admin/members/${activeProfile.user._id}/coins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: coinAction,
          amount: Number(coinAmount || 0),
          reason: coinReason,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert(data.message);
        setCoinAmount("");
        setCoinReason("");
        // Reload details
        handleOpenHistory(activeProfile.user._id);
        loadMembers();
      } else {
        alert(data.message || "Failed to adjust coins");
      }
    } catch (err: any) {
      alert("Error calling coin API: " + err.message);
    } finally {
      setCoinAdjustingState(false);
    }
  }

  // To fix a variable naming inconsistency in setCoinAdjustingState / setAdjustingCoins
  function setCoinAdjustingState(val: boolean) {
    setAdjustingCoins(val);
  }

  function handleExportMemberCSV() {
    if (!activeProfile) return;
    const headers = ["Name", "Phone", "Email", "DOB", "Hours Played", "Coins", "Plan Name", "Plan Type", "Plan Status"];
    const row = [
      activeProfile.user.name,
      activeProfile.user.phone,
      activeProfile.user.email,
      activeProfile.user.dob ? new Date(activeProfile.user.dob).toLocaleDateString("en-IN") : "N/A",
      activeProfile.totalHoursPlayed,
      activeProfile.user.coins,
      activeProfile.memberships[0]?.gameName || "None",
      activeProfile.memberships[0]?.membershipType || "N/A",
      activeProfile.memberships[0]?.status || "N/A"
    ];

    const csvContent = [headers.join(","), row.map(val => `"${val}"`).join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `member_${activeProfile.user.name.replace(/\s+/g, "_")}_history.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleExportMemberPDF() {
    if (!activeProfile) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Member History Report - ${activeProfile.user.name}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #111; line-height: 1.5; }
            h1 { margin-bottom: 5px; color: #03210f; font-size: 28px; }
            p { margin: 5px 0; }
            h2 { border-bottom: 2px solid #03210f; padding-bottom: 5px; margin-top: 30px; color: #03210f; font-size: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
            th { background-color: #f5f4ec; font-weight: bold; }
            .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
            .card { padding: 15px; border: 1px solid #ddd; border-radius: 10px; background-color: #fafafa; }
          </style>
        </head>
        <body>
          <h1>Member History Report</h1>
          <p>Generated on: ${new Date().toLocaleString("en-IN")}</p>
          
          <h2>Personal Details</h2>
          <div class="summary">
            <div class="card">
              <p><strong>Name:</strong> ${activeProfile.user.name}</p>
              <p><strong>Phone:</strong> ${activeProfile.user.phone}</p>
              <p><strong>Email:</strong> ${activeProfile.user.email}</p>
              <p><strong>DOB:</strong> ${activeProfile.user.dob ? new Date(activeProfile.user.dob).toLocaleDateString("en-IN") : "N/A"}</p>
            </div>
            <div class="card">
              <p><strong>Total Hours Played:</strong> ${activeProfile.totalHoursPlayed} Hours</p>
              <p><strong>Remaining Coins:</strong> ${activeProfile.user.coins || 0}</p>
              <p><strong>Cancellations:</strong> ${activeProfile.cancellations.length}</p>
              <p><strong>Refunds:</strong> ${activeProfile.refunds.length}</p>
            </div>
          </div>

          <h2>Active & Past Memberships</h2>
          <table>
            <thead>
              <tr>
                <th>Plan Name</th>
                <th>Type</th>
                <th>Label</th>
                <th>Status</th>
                <th>Price</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              ${activeProfile.memberships.map((m: any) => `
                <tr>
                  <td>${m.gameName || "Coin Plan"}</td>
                  <td>${m.membershipType}</td>
                  <td>${m.durationLabel}</td>
                  <td>${m.status}</td>
                  <td>₹${m.price || 0}</td>
                  <td>${new Date(m.createdAt).toLocaleDateString("en-IN")}</td>
                </tr>
              `).join("")}
              ${activeProfile.memberships.length === 0 ? "<tr><td colspan='6' style='text-align:center;'>No membership records</td></tr>" : ""}
            </tbody>
          </table>

          <h2>Booking Sessions</h2>
          <table>
            <thead>
              <tr>
                <th>Game</th>
                <th>Court</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Status</th>
                <th>Cost (Coins/₹)</th>
              </tr>
            </thead>
            <tbody>
              ${activeProfile.bookings.map((b: any) => `
                <tr>
                  <td>${b.gameName}</td>
                  <td>${b.court || "-"}</td>
                  <td>${new Date(b.startTime).toLocaleString("en-IN")}</td>
                  <td>${new Date(b.endTime).toLocaleString("en-IN")}</td>
                  <td>${b.status}</td>
                  <td>${b.coinCost > 0 ? `${b.coinCost} Coins` : `₹${b.price || 0}`}</td>
                </tr>
              `).join("")}
              ${activeProfile.bookings.length === 0 ? "<tr><td colspan='6' style='text-align:center;'>No booking sessions</td></tr>" : ""}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  useEffect(() => {
    loadMembers(false);
    const interval = setInterval(() => {
      loadMembers(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [search, sort, membershipStatus, minCoins, maxCoins, regStart, regEnd]);

  return (
    <section className="min-w-0 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-[var(--primary)]">
            Members
          </h1>
          <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
            View all members, coin balance, membership days left and reschedule access.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateMembershipClick}
            className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-black text-white hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center gap-2"
          >
            <User size={16} />
            Assign Membership / Coins
          </button>
          <button
            onClick={handleCSVExport}
            className="rounded-full bg-white border px-6 py-3 text-sm font-black text-[var(--primary)] hover:bg-gray-50 active:scale-95 transition-all shadow-sm flex items-center gap-2"
          >
            <FileSpreadsheet size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-white p-3 text-sm font-black text-[var(--primary)] ring-1 ring-black/5">
          {message}
        </p>
      )}

      {/* Advanced Filter UI */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-gray-500">Search</span>
            <input
              type="text"
              placeholder="Name, phone, or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-xl bg-gray-50 px-4 text-sm font-semibold border-0 outline-none ring-1 ring-gray-200 focus:ring-[var(--primary)]"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-gray-500">Sort By</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-11 rounded-xl bg-gray-50 px-4 text-sm font-semibold border-0 outline-none ring-1 ring-gray-200 cursor-pointer"
            >
              <option value="createdAt_desc">Newest Registered</option>
              <option value="createdAt_asc">Oldest Registered</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="coins_desc">Coins (High to Low)</option>
              <option value="coins_asc">Coins (Low to High)</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-gray-500">Membership type</span>
            <select
              value={membershipStatus}
              onChange={(e) => setMembershipStatus(e.target.value)}
              className="h-11 rounded-xl bg-gray-50 px-4 text-sm font-semibold border-0 outline-none ring-1 ring-gray-200 cursor-pointer"
            >
              <option value="ALL">All statuses</option>
              <option value="FIXED">Fixed Membership</option>
              <option value="COINS">Coins Membership</option>
              <option value="NONE">No Active Plan</option>
            </select>
          </label>

          <div className="grid gap-1">
            <span className="text-xs font-black uppercase text-gray-500">Coin Balance Range</span>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                value={minCoins}
                onChange={(e) => setMinCoins(e.target.value)}
                className="h-11 w-full rounded-xl bg-gray-50 px-3 text-sm font-semibold border-0 outline-none ring-1 ring-gray-200"
              />
              <input
                type="number"
                placeholder="Max"
                value={maxCoins}
                onChange={(e) => setMaxCoins(e.target.value)}
                className="h-11 w-full rounded-xl bg-gray-50 px-3 text-sm font-semibold border-0 outline-none ring-1 ring-gray-200"
              />
            </div>
          </div>

          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-gray-500">Reg. Date From</span>
            <input
              type="date"
              value={regStart}
              onChange={(e) => setRegStart(e.target.value)}
              className="h-11 rounded-xl bg-gray-50 px-4 text-sm font-semibold border-0 outline-none ring-1 ring-gray-200"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-gray-500">Reg. Date To</span>
            <input
              type="date"
              value={regEnd}
              onChange={(e) => setRegEnd(e.target.value)}
              className="h-11 rounded-xl bg-gray-50 px-4 text-sm font-semibold border-0 outline-none ring-1 ring-gray-200"
            />
          </label>
        </div>

        {/* Column Visibility Toggles */}
        <div className="pt-2 border-t flex flex-wrap items-center gap-4 text-xs font-bold text-gray-600">
          <span>Toggle Columns:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} />
            Phone
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showEmail} onChange={(e) => setShowEmail(e.target.checked)} />
            Email
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showCoins} onChange={(e) => setShowCoins(e.target.checked)} />
            Coins
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showMembership} onChange={(e) => setShowMembership(e.target.checked)} />
            Membership
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showDaysLeft} onChange={(e) => setShowDaysLeft(e.target.checked)} />
            Days Left
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showReschedule} onChange={(e) => setShowReschedule(e.target.checked)} />
            Reschedule
          </label>
        </div>
      </section>

      {/* Table */}
      <section className="mt-6 overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b text-[var(--text-muted)]">
                <th className="py-3">Member</th>
                {showPhone && <th>Phone</th>}
                {showEmail && <th>Email</th>}
                {showCoins && <th>Coins</th>}
                {showMembership && <th>Membership</th>}
                {showDaysLeft && <th>Days Left</th>}
                {showReschedule && <th>Reschedule Access</th>}
              </tr>
            </thead>

            <tbody>
              {members.map((member) => (
                <tr key={member._id} className="border-b last:border-0 hover:bg-gray-50/50">
                  <td 
                    onClick={() => handleOpenHistory(member._id)}
                    className="py-3 font-black text-[var(--primary)] cursor-pointer hover:underline"
                  >
                    {member.name}
                  </td>

                  {showPhone && <td>{member.phone}</td>}

                  {showEmail && <td>{member.email}</td>}

                  {showCoins && (
                    <td className="font-black">
                      <div className="flex items-center gap-1.5">
                        <span>{member.coins || 0}</span>
                        {member.coinsFrozen && member.coinsFrozen > 0 ? (
                          <span className="text-red-500 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border border-red-200 bg-red-50">
                            ❄ {member.coinsFrozen} Frozen
                          </span>
                        ) : null}
                      </div>
                    </td>
                  )}

                  {showMembership && (
                    <td>
                      {member.planName
                        ? `${member.membershipType} - ${member.planName}`
                        : "No active membership"}
                    </td>
                  )}

                  {showDaysLeft && (
                    <td>
                      {member.isFixedMember ? `${member.daysLeft} days` : "-"}
                    </td>
                  )}

                  {showReschedule && (
                    <td>
                      {member.isFixedMember ? (
                        <button
                          onClick={() => toggleReschedule(member)}
                          className={`rounded-lg px-3 py-2 text-xs font-black ${
                            member.canRescheduleFixedMembership
                              ? "bg-[#D7E528] text-[var(--primary)]"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {member.canRescheduleFixedMembership
                            ? "Allowed"
                            : "Not Allowed"}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {initialLoading ? (
            <p className="mt-5 text-sm font-bold text-[var(--text-muted)] animate-pulse">
              Loading members...
            </p>
          ) : members.length === 0 ? (
            <p className="mt-5 text-sm font-bold text-[var(--text-muted)]">
              No members found.
            </p>
          ) : null}
        </div>
      </section>

      {/* Member detailed profile modal */}
      {activeProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl h-[85vh] bg-white rounded-3xl p-6 shadow-xl relative animate-fade-in flex flex-col">
            <button
              onClick={() => setActiveProfile(null)}
              className="absolute right-6 top-6 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>

            <header className="flex justify-between items-start border-b pb-4 shrink-0">
              <div>
                <h3 className="text-2xl font-black text-[var(--primary)] flex items-center gap-2">
                  <User size={24} />
                  {activeProfile.user.name}
                </h3>
                <p className="text-xs font-semibold text-gray-500 mt-1">
                  Phone: {activeProfile.user.phone} • Email: {activeProfile.user.email}
                </p>
              </div>

              <div className="flex gap-2 mr-10">
                <button
                  onClick={handleExportMemberCSV}
                  className="h-10 flex items-center gap-2 rounded-full border px-4 text-xs font-black hover:bg-gray-50"
                >
                  <FileSpreadsheet size={14} />
                  CSV
                </button>
                <button
                  onClick={handleExportMemberPDF}
                  className="h-10 flex items-center gap-2 rounded-full bg-[var(--primary)] text-white px-4 text-xs font-black hover:opacity-90"
                >
                  <Printer size={14} />
                  Print PDF Report
                </button>
              </div>
            </header>

            {/* Modal Tabs */}
            <nav className="flex gap-3 border-b py-3 shrink-0">
              {(["overview", "memberships", "bookings", "transactions", "coins"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setModalTab(tab)}
                  className={`px-4 py-2 text-xs font-black capitalize rounded-full transition-all ${
                    modalTab === tab ? "bg-[var(--primary)] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tab === "coins" ? "Manage Wallet/Coins" : tab}
                </button>
              ))}
            </nav>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto py-4 min-h-0 text-sm">
              {modalTab === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex flex-col justify-center items-center text-center">
                    <Award className="text-[var(--primary)]" size={32} />
                    <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-wider mt-3">Total Playtime</h4>
                    <p className="text-2xl font-black text-[var(--primary)] mt-1">{activeProfile.totalHoursPlayed} Hours</p>
                  </div>

                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex flex-col justify-center items-center text-center">
                    <Calendar className="text-emerald-600" size={32} />
                    <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-wider mt-3">Scheduled Bookings</h4>
                    <p className="text-2xl font-black text-emerald-600 mt-1">{activeProfile.bookings.filter(b => b.status === "BOOKED").length} Sessions</p>
                  </div>

                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex flex-col justify-center items-center text-center">
                    <History className="text-rose-600" size={32} />
                    <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-wider mt-3">Cancellations</h4>
                    <p className="text-2xl font-black text-rose-600 mt-1">{activeProfile.cancellations.length} Bookings</p>
                  </div>

                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 col-span-1 md:col-span-3 space-y-4">
                    <h4 className="font-black text-[var(--primary)] border-b pb-1">Additional Stats</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold text-gray-700">
                      <p>Coins Balance: <span className="font-black">{activeProfile.user.coins}</span></p>
                      <p>Date of Birth: <span className="font-black">{activeProfile.user.dob ? new Date(activeProfile.user.dob).toLocaleDateString("en-IN") : "Not provided"}</span></p>
                      <p>Completed Matches: <span className="font-black">{activeProfile.playedSessions.length} Matches</span></p>
                      <p>Total Refunds Logged: <span className="font-black">{activeProfile.refunds.length} Transactions</span></p>
                    </div>
                    <div className="pt-3 border-t flex justify-end">
                      <button
                        onClick={() => handleResetPasswordClick(activeProfile.user._id)}
                        className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition"
                      >
                        Reset Password
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {modalTab === "memberships" && (
                <div className="space-y-3">
                  {activeProfile.memberships.map((m) => (
                    <div key={m._id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                      <div>
                        <h4 className="font-black text-[var(--primary)] text-base">{m.gameName || "Coin Recharge Plan"}</h4>
                        <p className="text-xs text-gray-500 font-semibold mt-1">
                          Type: {m.membershipType} • Validity: {m.durationLabel}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">Purchased: {new Date(m.createdAt).toLocaleDateString("en-IN")}</p>
                      </div>
                      <div className="text-right">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                          m.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                        }`}>
                          {m.status}
                        </span>
                        <p className="font-black text-[var(--primary)] mt-2">₹{m.price}</p>
                      </div>
                    </div>
                  ))}
                  {activeProfile.memberships.length === 0 && <p className="text-gray-400 font-semibold text-center py-6">No memberships purchased yet.</p>}
                </div>
              )}

              {modalTab === "bookings" && (
                <div className="space-y-3">
                  {activeProfile.bookings.map((b) => (
                    <div key={b._id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                      <div>
                        <h4 className="font-black text-[var(--primary)] text-base">{b.gameName} (Court: {b.court || "N/A"})</h4>
                        <p className="text-xs text-gray-500 font-semibold mt-1">
                          {new Date(b.startTime).toLocaleString("en-IN")} - {new Date(b.endTime).toLocaleTimeString("en-IN")}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                          b.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" :
                          b.status === "BOOKED" ? "bg-blue-100 text-blue-800" :
                          "bg-rose-100 text-rose-800"
                        }`}>
                          {b.status}
                        </span>
                        <p className="font-black text-[var(--primary)] mt-2">{b.coinCost > 0 ? `${b.coinCost} Coins` : `₹${b.price || 0}`}</p>
                      </div>
                    </div>
                  ))}
                  {activeProfile.bookings.length === 0 && <p className="text-gray-400 font-semibold text-center py-6">No bookings created yet.</p>}
                </div>
              )}

              {modalTab === "transactions" && (
                <div className="space-y-3">
                  {activeProfile.transactions.map((t) => {
                    // Check if deduction or addition
                    const isCoins = t.coins !== undefined && t.coins > 0;
                    const isAdjustmentDeduct = t.type === "COINS_ADJUSTMENT" && t.note && t.note.toLowerCase().includes("deduct");
                    const isDeduction = t.type === "SESSION_DEDUCTION" || isAdjustmentDeduct;

                    // Display value
                    let valStr = "";
                    let isGreen = false;

                    if (t.type === "COINS_ADJUSTMENT") {
                      if (isAdjustmentDeduct) {
                        valStr = `-${t.coins} Coins`;
                        isGreen = false;
                      } else if (t.note && t.note.toLowerCase().includes("added")) {
                        valStr = `+${t.coins} Coins`;
                        isGreen = true;
                      } else if (t.note && t.note.toLowerCase().includes("unfrozen")) {
                        valStr = `+${t.coins} Coins`;
                        isGreen = true;
                      } else if (t.note && t.note.toLowerCase().includes("frozen")) {
                        valStr = `-${t.coins} Coins`;
                        isGreen = false;
                      } else {
                        valStr = `${t.coins} Coins`;
                      }
                    } else if (t.type === "SESSION_DEDUCTION") {
                      if (isCoins) {
                        valStr = `-${t.coins} Coins`;
                      } else {
                        valStr = `-₹${t.amount || 0}`;
                      }
                      isGreen = false;
                    } else if (t.type === "PLAN_PURCHASE" || t.type === "COINS_PURCHASE") {
                      valStr = `+₹${t.amount || 0}`;
                      isGreen = true;
                    } else if (t.type === "REFUND") {
                      if (isCoins) {
                        valStr = `+${t.coins} Coins`;
                      } else {
                        valStr = `+₹${t.amount || 0}`;
                      }
                      isGreen = true;
                    } else {
                      valStr = isCoins ? `${t.coins} Coins` : `₹${t.amount || 0}`;
                    }

                    return (
                      <div key={t._id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                        <div>
                          <h4 className="font-black text-[var(--primary)] text-base flex items-center gap-1.5">
                            <CreditCard size={16} />
                            {t.type}
                          </h4>
                          <p className="text-xs text-gray-500 font-semibold mt-1">
                            Mode: {t.paymentMode || "online"} {t.transactionId && `• Txn: ${t.transactionId}`}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">{t.note}</p>
                        </div>
                        <div className={`text-right font-black text-base ${isGreen ? "text-emerald-600" : "text-rose-600"}`}>
                          {valStr}
                        </div>
                      </div>
                    );
                  })}
                  {activeProfile.transactions.length === 0 && <p className="text-gray-400 font-semibold text-center py-6">No transactions recorded.</p>}
                </div>
              )}

              {modalTab === "coins" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
                  {/* Current Wallet Status */}
                  <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                    <h4 className="font-black text-sm text-[var(--primary)] border-b pb-2">
                      Wallet Status
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-xs font-bold text-gray-500">Available Coins</span>
                        <span className="text-sm font-black text-[var(--primary)]">{activeProfile.user.coinsAvailable || 0} Coins</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-xs font-bold text-gray-500">Frozen Coins</span>
                        <span className="text-sm font-black text-rose-600">{activeProfile.user.coinsFrozen || 0} Coins</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-xs font-bold text-gray-500">Reward Coins</span>
                        <span className="text-sm font-black text-emerald-600">{activeProfile.user.rewardCoins || 0} Reward Coins</span>
                      </div>
                      {activeProfile.user.coinsFrozen && activeProfile.user.coinsFrozen > 0 ? (
                        <div className="p-3 bg-red-50 text-[11px] font-bold text-red-700 rounded-xl leading-relaxed mt-2 border border-red-100 space-y-1">
                          <p><strong>Freeze Reason:</strong> {activeProfile.user.coinsFrozenReason || "No reason specified."}</p>
                          {activeProfile.user.coinsFrozenAt && (
                            <p><strong>Freeze Date:</strong> {new Date(activeProfile.user.coinsFrozenAt).toLocaleDateString("en-IN")}</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Wallet Action Form */}
                  <div className="space-y-4 bg-white p-5 rounded-2xl border border-gray-100">
                    <h4 className="font-black text-sm text-[var(--primary)] border-b pb-2">
                      Adjust Wallet / Coins
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Select Action</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["ADD", "DEDUCT", "FREEZE", "UNFREEZE"] as const).map((action) => (
                            <button
                              key={action}
                              type="button"
                              onClick={() => setCoinAction(action)}
                              className={`h-9 rounded-lg text-xs font-bold transition ${
                                coinAction === action
                                  ? "bg-[var(--primary)] text-white font-black"
                                  : "bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-100"
                              }`}
                            >
                              {action}
                            </button>
                          ))}
                        </div>
                      </div>

                      {(coinAction === "ADD" || coinAction === "DEDUCT") && (
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Coin Amount</label>
                          <input
                            type="number"
                            min="1"
                            value={coinAmount}
                            onChange={(e) => setCoinAmount(e.target.value)}
                            placeholder="Enter coins count"
                            className="w-full h-10 bg-gray-50 rounded-xl px-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)]"
                          />
                        </div>
                      )}

                      {coinAction !== "UNFREEZE" && (
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Reason / Notes</label>
                          <textarea
                            value={coinReason}
                            onChange={(e) => setCoinReason(e.target.value)}
                            placeholder={coinAction === "FREEZE" ? "Reason for freezing coins" : "Reason for adjusting coins"}
                            className="w-full h-16 bg-gray-50 rounded-xl p-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)] resize-none"
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleAdjustCoins}
                        disabled={adjustingCoins}
                        className="w-full h-10 mt-3 rounded-full bg-[var(--primary)] text-white text-xs font-black hover:opacity-90 active:scale-95 transition flex items-center justify-center"
                      >
                        {adjustingCoins ? "Processing..." : "Confirm Action"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Assign Membership / Coins Modal */}
      {showCreateMembershipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden ring-1 ring-black/5 animate-[flip_0.2s_ease-out]">
            <header className="px-6 py-4 border-b flex items-center justify-between bg-gray-50 shrink-0">
              <h2 className="text-lg font-black text-[var(--primary)] flex items-center gap-2">
                <User size={18} />
                Assign Membership / Coins
              </h2>
              <button
                onClick={() => setShowCreateMembershipModal(false)}
                className="h-8 w-8 text-gray-400 hover:text-gray-650 hover:bg-gray-100 rounded-full flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </header>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateMembershipSubmit(e, !needsConfirmation);
              }}
              className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-semibold text-gray-700"
            >
              {createMemError && (
                <p className="bg-red-50 text-red-700 border border-red-100 rounded-2xl p-4 font-black">
                  ⚠️ {createMemError}
                </p>
              )}

              {createMemSuccess && (
                <p className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl p-4 font-black">
                  ✓ {createMemSuccess}
                </p>
              )}

              {needsConfirmation ? (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-amber-800">
                    <p className="font-black text-sm">Matches Found</p>
                    <p className="text-xs mt-1">
                      We found existing accounts with the same phone number or email address. Select one of the accounts below to assign this plan, or close this window to edit details.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {matches.map((m) => (
                      <div
                        key={m._id}
                        onClick={() => setConfirmUserId(m._id)}
                        className={`p-4 border rounded-2xl cursor-pointer flex items-center justify-between transition ${
                          confirmUserId === m._id
                            ? "border-[var(--primary)] bg-emerald-50/20 ring-1 ring-[var(--primary)]"
                            : "border-gray-150 hover:bg-gray-50"
                        }`}
                      >
                        <div>
                          <p className="font-black text-sm text-[var(--primary)]">{m.name}</p>
                          <p className="text-xs text-gray-500 font-semibold mt-1">
                            Phone: {m.phone} • Email: {m.email}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Wallet: {m.coins} Coins • Registered: {new Date(m.createdAt).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                        <div className="h-6 w-6 rounded-full border flex items-center justify-center font-bold text-xs">
                          {confirmUserId === m._id ? "✓" : ""}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={createMemSubmitting || !confirmUserId}
                    className="h-12 w-full mt-4 rounded-full bg-[var(--primary)] text-white font-black hover:opacity-90 active:scale-95 transition flex items-center justify-center disabled:opacity-50"
                  >
                    {createMemSubmitting ? "Processing..." : "Confirm & Mark as Paid"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Member Loading & Suggestion Flow */}
                  {existingPlayer ? (
                    <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="bg-emerald-600 text-white font-black text-[9px] uppercase px-2 py-0.5 rounded-full">Existing Member Found</span>
                        <button
                          type="button"
                          onClick={() => {
                            setExistingPlayer(null);
                            setConfirmUserId("");
                          }}
                          className="text-xs font-black text-emerald-800 underline hover:text-emerald-950"
                        >
                          Change Member
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-bold text-emerald-900 mt-1">
                        <p>Name: <span className="font-black">{existingPlayer.name}</span></p>
                        <p>Phone: <span className="font-black">{existingPlayer.phone}</span></p>
                        <p>Email: <span className="font-black">{(existingPlayer.email && !existingPlayer.email.includes("@visitor.")) ? existingPlayer.email : "None"}</span></p>
                        <p>Coins Balance: <span className="font-black">{existingPlayer.coins} Coins</span></p>
                        <p>Current Membership: <span className="font-black">{existingPlayer.currentMembership}</span></p>
                        <p>Current Coin Plan: <span className="font-black">{existingPlayer.currentCoinPlan}</span></p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Search Member or Visitor Autocomplete */}
                      <div className="relative grid gap-1">
                        <span className="text-[10px] font-black uppercase text-gray-400">Search Member or Visitor</span>
                        <input
                          type="text"
                          placeholder="Type Name, Phone, Email or Booking name to search..."
                          value={searchQuery}
                          onChange={(e) => handlePlayerSearch(e.target.value)}
                          className="h-10 bg-gray-50 rounded-xl px-3 border outline-none text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] text-gray-700"
                        />
                        {showSuggestions && searchSuggestions.length > 0 && (
                          <div className="absolute top-15 z-55 left-0 right-0 max-h-48 overflow-y-auto bg-white border border-gray-150 rounded-xl shadow-lg divide-y divide-gray-100">
                            {searchSuggestions.map((s) => {
                              const masked = s.phone.length >= 4 ? "XXXXXX" + s.phone.slice(-4) : s.phone;
                              const lastBookingDate = s.lastBookingAt ? new Date(s.lastBookingAt).toLocaleDateString("en-IN") : "N/A";
                              const dispEmail = (s.email && !s.email.includes("@visitor.")) ? s.email : "None";
                              return (
                                <div
                                  key={s.id}
                                  onClick={() => handleSelectSuggestion(s)}
                                  className="p-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between text-xs font-bold text-gray-700"
                                >
                                  <div className="space-y-0.5">
                                    <p className="font-black text-gray-800">{s.name}</p>
                                    <p className="text-[10px] text-gray-400">
                                      {masked} • {dispEmail === "None" ? "No Email" : dispEmail}
                                    </p>
                                    <p className="text-[9px] text-gray-450 font-medium">
                                      Type: <span className="font-bold">{s.accountType}</span> • Coins: {s.coins} • Last Booking: {lastBookingDate}
                                    </p>
                                  </div>
                                  <span className="text-[9px] bg-[var(--primary)]/10 text-[var(--primary)] px-2.5 py-0.5 rounded-full font-black uppercase">Use</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {visitorConversionRequired && visitorConversionPlayer && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                          <p className="text-xs font-black text-amber-800">
                            ⚠️ This visitor does not have a login account yet. Create member account and continue?
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleConfirmVisitorConversion}
                              className="px-3 h-8 rounded-lg bg-amber-600 text-white font-black text-[10px] hover:bg-amber-700 transition"
                            >
                              Convert to Member
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setVisitorConversionRequired(false);
                                setVisitorConversionPlayer(null);
                              }}
                              className="px-3 h-8 rounded-lg border border-amber-300 text-amber-700 font-bold text-[10px] hover:bg-amber-100/55 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <label className="grid gap-1">
                          <span className="text-[10px] font-black uppercase text-gray-400">Phone Number (10 digits)</span>
                          <input
                            required
                            type="text"
                            placeholder="e.g. 9876543210"
                            value={createMemForm.phone}
                            onChange={(e) => setCreateMemForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="h-10 bg-gray-50 rounded-xl px-3 border outline-none text-xs font-bold focus:ring-1 focus:ring-[var(--primary)]"
                          />
                        </label>

                        <label className="grid gap-1">
                          <span className="text-[10px] font-black uppercase text-gray-400">Member Name</span>
                          <input
                            required
                            type="text"
                            placeholder="Member full name"
                            value={createMemForm.name}
                            onChange={(e) => setCreateMemForm(prev => ({ ...prev, name: e.target.value }))}
                            className="h-10 bg-gray-50 rounded-xl px-3 border outline-none text-xs font-bold focus:ring-1 focus:ring-[var(--primary)]"
                          />
                        </label>
                      </div>

                      <label className="grid gap-1">
                        <span className="text-[10px] font-black uppercase text-gray-400">Email Address (Optional)</span>
                        <input
                          type="email"
                          placeholder="e.g. member@domain.com"
                          value={createMemForm.email}
                          onChange={(e) => setCreateMemForm(prev => ({ ...prev, email: e.target.value }))}
                          className="h-10 bg-gray-50 rounded-xl px-3 border outline-none text-xs font-bold focus:ring-1 focus:ring-[var(--primary)]"
                        />
                      </label>
                    </div>
                  )}

                  {/* Assignment Type Selector */}
                  <label className="grid gap-1">
                    <span className="text-[10px] font-black uppercase text-gray-400">Assignment Type</span>
                    <select
                      value={createMemForm.assignmentType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCreateMemForm(prev => ({
                          ...prev,
                          assignmentType: val,
                          planId: "",
                          durationIndex: 0,
                          coinsToAdd: "",
                          reason: ""
                        }));
                      }}
                      className="h-10 bg-gray-50 rounded-xl px-3 border outline-none text-xs font-bold cursor-pointer"
                    >
                      <option value="MEMBERSHIP">Membership Plan</option>
                      <option value="COIN_PLAN">Coin Plan</option>
                      <option value="ADD_COINS">Add Coins</option>
                    </select>
                  </label>

                  {/* Conditional Assignment Areas */}
                  {createMemForm.assignmentType === "MEMBERSHIP" && (
                    <div className="space-y-4">
                      <label className="grid gap-1">
                        <span className="text-[10px] font-black uppercase text-gray-400">Membership Plan</span>
                        <select
                          required
                          value={createMemForm.planId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCreateMemForm(prev => ({ ...prev, planId: val, durationIndex: 0 }));
                          }}
                          className="h-10 bg-gray-50 rounded-xl px-3 border outline-none text-xs font-bold cursor-pointer"
                        >
                          <option value="">Select Membership plan</option>
                          {plans
                            .filter((p) => p.type === "FIXED")
                            .map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </label>

                      {createMemForm.planId && (
                        <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl border">
                          <label className="grid gap-1 col-span-2">
                            <span className="text-[10px] font-black uppercase text-gray-400">Plan Duration</span>
                            <select
                              required
                              value={createMemForm.durationIndex}
                              onChange={(e) => setCreateMemForm(prev => ({ ...prev, durationIndex: Number(e.target.value) }))}
                              className="h-10 bg-white rounded-xl px-3 border outline-none text-xs font-bold cursor-pointer"
                            >
                              {plans
                                .find((p) => p._id === createMemForm.planId)
                                ?.durations.map((d: any, idx: number) => (
                                  <option key={idx} value={idx}>
                                    {d.label} - ₹{d.finalPrice} ({d.totalDays} Days)
                                  </option>
                                ))}
                            </select>
                          </label>

                          <label className="grid gap-1">
                            <span className="text-[10px] font-black uppercase text-gray-400">Sport Game</span>
                            <select
                              value={createMemForm.gameId}
                              onChange={(e) => setCreateMemForm(prev => ({ ...prev, gameId: e.target.value }))}
                              className="h-10 bg-white rounded-xl px-3 border outline-none text-xs font-bold cursor-pointer"
                            >
                              <option value="">Select sport</option>
                              {games.map((g) => (
                                <option key={g._id} value={g._id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="grid gap-1">
                            <span className="text-[10px] font-black uppercase text-gray-400">Start Date</span>
                            <input
                              type="date"
                              required
                              value={createMemForm.startDate}
                              onChange={(e) => setCreateMemForm(prev => ({ ...prev, startDate: e.target.value }))}
                              className="h-10 bg-white rounded-xl px-3 border outline-none text-xs font-bold"
                            />
                          </label>

                          {(() => {
                            const plan = plans.find((p) => p._id === createMemForm.planId);
                            const game = games.find((g) => g._id === (createMemForm.gameId || plan?.gameId));
                            const isTimeSelectionAllowed = plan?.allowUserTimeSelection === true;

                            return isTimeSelectionAllowed ? (
                              <>
                                <label className="grid gap-1">
                                  <span className="text-[10px] font-black uppercase text-gray-400">Daily Slot Start Time</span>
                                  <input
                                    type="time"
                                    required
                                    value={createMemForm.startTime}
                                    onChange={(e) => {
                                      const newStart = e.target.value;
                                      setCreateMemForm(prev => {
                                        const currentDiff = prev.startTime && prev.endTime ? 
                                          ((Number(prev.endTime.split(":")[0]) * 60 + Number(prev.endTime.split(":")[1])) -
                                           (Number(prev.startTime.split(":")[0]) * 60 + Number(prev.startTime.split(":")[1]))) : (game?.duration || 60);
                                        const normalizedDiff = currentDiff <= 0 ? (game?.duration || 60) : currentDiff;
                                        return {
                                          ...prev,
                                          startTime: newStart,
                                          endTime: addMinutesToTime(newStart, normalizedDiff)
                                        };
                                      });
                                    }}
                                    className="h-10 bg-white rounded-xl px-3 border outline-none text-xs font-bold"
                                  />
                                </label>

                                <label className="grid gap-1">
                                  <span className="text-[10px] font-black uppercase text-gray-400">Daily Session Duration</span>
                                  <select
                                    required
                                    onChange={(e) => {
                                      const mins = Number(e.target.value);
                                      if (createMemForm.startTime) {
                                        setCreateMemForm(prev => ({
                                          ...prev,
                                          endTime: addMinutesToTime(prev.startTime, mins)
                                        }));
                                      }
                                    }}
                                    className="h-10 bg-white rounded-xl px-3 border outline-none text-xs font-bold cursor-pointer"
                                  >
                                    {game ? (
                                      Array.from(
                                        { length: Math.floor((game.maximumDuration - game.duration) / game.duration) + 1 },
                                        (_, i) => game.duration + i * game.duration
                                      ).map((mins) => (
                                        <option key={mins} value={mins}>
                                          {mins} Minutes
                                        </option>
                                      ))
                                    ) : (
                                      <option value="60">60 Minutes</option>
                                    )}
                                  </select>
                                </label>

                                <div className="col-span-2 text-xs font-black uppercase text-[var(--primary)] bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex justify-between items-center">
                                  <span>Calculated End Time:</span>
                                  <span className="font-black text-sm">{createMemForm.endTime || "--:--"}</span>
                                </div>
                              </>
                            ) : (
                              <div className="col-span-2 text-[11px] font-bold text-gray-650 bg-gray-100 p-3.5 rounded-xl border border-gray-200">
                                <p className="font-black text-[var(--primary)] uppercase text-[9px] text-gray-400 mb-1">Fixed Time Session (Set by Plan)</p>
                                <p className="text-gray-800 text-xs">
                                  {plan?.adminStartTime || "--:--"} to {plan?.adminEndTime || "--:--"}
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {createMemForm.assignmentType === "COIN_PLAN" && (
                    <div className="space-y-4">
                      <label className="grid gap-1">
                        <span className="text-[10px] font-black uppercase text-gray-400">Coin Plan</span>
                        <select
                          required
                          value={createMemForm.planId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCreateMemForm(prev => ({ ...prev, planId: val, durationIndex: 0 }));
                          }}
                          className="h-10 bg-gray-50 rounded-xl px-3 border outline-none text-xs font-bold cursor-pointer"
                        >
                          <option value="">Select Coin plan</option>
                          {plans
                            .filter((p) => p.type === "COINS")
                            .map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.name} ({p.coinsAmount || 0} Coins)
                              </option>
                            ))}
                        </select>
                      </label>

                      {createMemForm.planId && (
                        <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl border text-xs font-bold text-gray-700">
                          <div className="col-span-2 space-y-1">
                            <p>
                              Price: <span className="font-black text-gray-900">₹{plans.find((p) => p._id === createMemForm.planId)?.price || 0}</span>
                            </p>
                            <p>
                              Validity: <span className="font-black text-gray-900">{plans.find((p) => p._id === createMemForm.planId)?.validityDays || 30} Days</span>
                            </p>
                            <p>
                              Coins Credited: <span className="font-black text-emerald-600">{(plans.find((p) => p._id === createMemForm.planId)?.coinsAmount || 0) + (plans.find((p) => p._id === createMemForm.planId)?.bonusCoins || 0)} Coins</span>
                            </p>
                          </div>

                          <label className="grid gap-1 col-span-2 mt-2">
                            <span className="text-[10px] font-black uppercase text-gray-400">Start Date</span>
                            <input
                              type="date"
                              required
                              value={createMemForm.startDate}
                              onChange={(e) => setCreateMemForm(prev => ({ ...prev, startDate: e.target.value }))}
                              className="h-10 bg-white rounded-xl px-3 border outline-none text-xs font-bold"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {createMemForm.assignmentType === "ADD_COINS" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="grid gap-1 col-span-2">
                          <span className="text-[10px] font-black uppercase text-gray-400">Coins to Add</span>
                          <input
                            required
                            type="number"
                            min="1"
                            placeholder="Enter coins amount"
                            value={createMemForm.coinsToAdd}
                            onChange={(e) => setCreateMemForm(prev => ({ ...prev, coinsToAdd: e.target.value }))}
                            className="h-10 bg-gray-50 rounded-xl px-3 border outline-none text-xs font-bold focus:ring-1 focus:ring-[var(--primary)]"
                          />
                        </label>
                      </div>

                      <label className="grid gap-1">
                        <span className="text-[10px] font-black uppercase text-gray-400">Reason</span>
                        <input
                          type="text"
                          placeholder="e.g. Festival Bonus, Tournament Reward, customer compensation"
                          value={createMemForm.reason}
                          onChange={(e) => setCreateMemForm(prev => ({ ...prev, reason: e.target.value }))}
                          className="h-10 bg-gray-50 rounded-xl px-3 border outline-none text-xs font-bold focus:ring-1 focus:ring-[var(--primary)]"
                        />
                      </label>
                    </div>
                  )}

                  <label className="grid gap-1">
                    <span className="text-[10px] font-black uppercase text-gray-400">Payment Notes / Custom Description</span>
                    <input
                      type="text"
                      placeholder="e.g. Cash received by admin at counter"
                      value={createMemForm.offlinePaymentNote}
                      onChange={(e) => setCreateMemForm(prev => ({ ...prev, offlinePaymentNote: e.target.value }))}
                      className="h-10 bg-gray-50 rounded-xl px-3 border outline-none text-xs font-bold focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={createMemSubmitting}
                    className="h-12 w-full mt-4 rounded-full bg-[var(--primary)] text-white font-black hover:opacity-90 active:scale-95 transition flex items-center justify-center"
                  >
                    {createMemSubmitting ? "Validating..." : "Confirm & Mark as Paid"}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Confirmation Modal */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl overflow-hidden ring-1 ring-black/5 animate-[flip_0.2s_ease-out] space-y-4">
            <header className="border-b pb-2 flex items-center justify-between">
              <h3 className="text-lg font-black text-rose-650">Confirm Reset Password</h3>
              <button
                onClick={() => setShowResetPasswordModal(false)}
                className="h-8 w-8 text-gray-400 hover:text-gray-650 hover:bg-gray-100 rounded-full flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </header>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs font-bold text-gray-700">
              {resetPasswordError && (
                <p className="bg-red-50 text-red-700 border border-red-100 rounded-xl p-3 font-black">
                  ⚠️ {resetPasswordError}
                </p>
              )}

              {resetPasswordSuccess && (
                <p className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl p-3 font-black">
                  ✓ {resetPasswordSuccess}
                </p>
              )}

              <p className="text-xs text-gray-500 font-semibold leading-relaxed">
                This action will reset the player's password to <strong className="text-[var(--primary)] font-black">NEW1234</strong>. The player will be forced to change it on their first login.
              </p>

              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Admin Password Confirmation</span>
                <input
                  required
                  type="password"
                  placeholder="Enter your admin password"
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                  className="h-10 bg-gray-50 rounded-xl px-3 border outline-none text-xs font-bold focus:ring-1 focus:ring-[var(--primary)]"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400">Reason (Optional)</span>
                <input
                  type="text"
                  placeholder="e.g. Player requested reset"
                  value={resetPasswordReason}
                  onChange={(e) => setResetPasswordReason(e.target.value)}
                  className="h-10 bg-gray-50 rounded-xl px-3 border outline-none text-xs font-bold focus:ring-1 focus:ring-[var(--primary)]"
                />
              </label>

              <button
                type="submit"
                disabled={resetPasswordSubmitting}
                className="h-12 w-full rounded-full bg-rose-600 text-white font-black hover:opacity-90 active:scale-95 transition flex items-center justify-center disabled:opacity-50"
              >
                {resetPasswordSubmitting ? "Resetting..." : "Confirm & Reset Password"}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}