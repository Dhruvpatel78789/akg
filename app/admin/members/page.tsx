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

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
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

  async function loadMembers() {
    const params = new URLSearchParams({
      search,
      sort,
      membershipStatus,
      minCoins,
      maxCoins,
      regStart,
      regEnd,
    });
    const response = await fetch(`/api/admin/members?${params.toString()}`, {
      cache: "no-store",
    });

    const data = await response.json();
    setMembers(data.members || []);
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
    loadMembers();
    const interval = setInterval(() => {
      loadMembers();
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
        <button
          onClick={handleCSVExport}
          className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-black text-white hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center gap-2"
        >
          <FileSpreadsheet size={16} />
          Export CSV
        </button>
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

          {members.length === 0 && (
            <p className="mt-5 text-sm font-bold text-[var(--text-muted)]">
              No members found.
            </p>
          )}
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

                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 col-span-1 md:col-span-3 space-y-2">
                    <h4 className="font-black text-[var(--primary)] border-b pb-1">Additional Stats</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold text-gray-700">
                      <p>Coins Balance: <span className="font-black">{activeProfile.user.coins}</span></p>
                      <p>Date of Birth: <span className="font-black">{activeProfile.user.dob ? new Date(activeProfile.user.dob).toLocaleDateString("en-IN") : "Not provided"}</span></p>
                      <p>Completed Matches: <span className="font-black">{activeProfile.playedSessions.length} Matches</span></p>
                      <p>Total Refunds Logged: <span className="font-black">{activeProfile.refunds.length} Transactions</span></p>
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
                  {activeProfile.transactions.map((t) => (
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
                      <div className="text-right font-black text-[var(--primary)] text-base">
                        {t.coins > 0 ? `${t.coins} Coins` : `₹${t.amount || 0}`}
                      </div>
                    </div>
                  ))}
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
    </section>
  );
}