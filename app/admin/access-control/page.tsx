"use client";

import { useState, useEffect } from "react";
import { Shield, Plus, Trash2, Mail, Building, CheckSquare, Square, Save, Loader2, Gamepad2, Columns, Eye, Edit3, ChevronDown, ChevronRight } from "lucide-react";

interface SubSectionPerm {
  view: boolean;
  edit: boolean;
}

interface SectionPerm {
  section: string;
  view: boolean;
  edit: boolean;
  subSections: Record<string, SubSectionPerm>;
}

interface UserRoleProfile {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
  };
  permissions: SectionPerm[];
  allowedCompanyIds: {
    _id: string;
    name: string;
  }[];
  allowedGameIds: {
    _id: string;
    name: string;
  }[];
  allowedColumns: string[];
  createdAt: string;
}

interface Company {
  _id: string;
  name: string;
}

interface Game {
  _id: string;
  name: string;
}

const SECTIONS_CONFIG = [
  {
    key: "dashboard",
    label: "Dashboard",
    subSections: [],
  },
  {
    key: "games",
    label: "Games",
    subSections: [
      { key: "gameList", label: "Game List" },
      { key: "courtsCodes", label: "Courts / Codes" },
      { key: "pricingRules", label: "Pricing Rules" },
      { key: "blockedCourts", label: "Blocked Courts" },
      { key: "gameStatus", label: "Game Status" },
    ],
  },
  {
    key: "plans",
    label: "Plans",
    subSections: [
      { key: "fixedMembershipPlans", label: "Fixed Membership Plans" },
      { key: "coinPlans", label: "Coin Plans" },
      { key: "durationPricing", label: "Duration Pricing" },
      { key: "planStatus", label: "Plan Status" },
    ],
  },
  {
    key: "members",
    label: "Members",
    subSections: [
      { key: "memberList", label: "Member List" },
      { key: "coinBalance", label: "Coin Balance" },
      { key: "coinFreeze", label: "Coin Freeze" },
      { key: "rescheduleAccess", label: "Reschedule Access" },
      { key: "membershipStatus", label: "Membership Status" },
    ],
  },
  {
    key: "bookings",
    label: "Bookings",
    subSections: [
      { key: "advancedBookings", label: "Advanced Bookings" },
      { key: "ongoingSessions", label: "Ongoing Sessions" },
      { key: "bookingHistory", label: "All Booking History" },
      { key: "pendingPayments", label: "Pending Payments" },
      { key: "failedPayments", label: "Failed Payments" },
      { key: "cancellationRequests", label: "Cancellation Requests" },
      { key: "timeChangeRequests", label: "Time Change Requests" },
      { key: "overtimeCharges", label: "Overtime Charges" },
      { key: "autoEndedSessions", label: "Auto-Ended Sessions" },
    ],
  },
  {
    key: "passes",
    label: "Passes",
    subSections: [
      { key: "viewPasses", label: "View Passes" },
      { key: "createPasses", label: "Create Passes" },
    ],
  },
  {
    key: "companies",
    label: "Companies",
    subSections: [
      { key: "companyList", label: "Company List" },
      { key: "companyEmployees", label: "Company Employees" },
      { key: "allowedGames", label: "Allowed Games" },
      { key: "companyDiscounts", label: "Company Discounts" },
      { key: "employeeUpload", label: "Employee Upload" },
      { key: "employeePasswordReset", label: "Employee Password Reset" },
    ],
  },
  {
    key: "companyEntries",
    label: "Company Entries",
    subSections: [
      { key: "entryList", label: "Entry List" },
      { key: "manualEntry", label: "Manual Entry" },
      { key: "csvUpload", label: "CSV Upload" },
      { key: "randomEntryGenerator", label: "Random Entry Generator" },
      { key: "deletedEntries", label: "Deleted Entries" },
    ],
  },
  {
    key: "companyBilling",
    label: "Company Billing",
    subSections: [
      { key: "billList", label: "Bill List" },
      { key: "generateBill", label: "Generate Bill" },
      { key: "letterhead", label: "Letterhead" },
      { key: "discounts", label: "Discounts" },
      { key: "exportBill", label: "Export Bill" },
    ],
  },
  {
    key: "couponsOffers",
    label: "Coupons & Offers",
    subSections: [
      { key: "coupons", label: "Coupons" },
      { key: "offers", label: "Offers" },
      { key: "couponUsage", label: "Coupon Usage" },
      { key: "offerScheduling", label: "Offer Scheduling" },
    ],
  },
  {
    key: "visitorCoins",
    label: "Visitor Coins",
    subSections: [
      { key: "visitorCoinBalance", label: "Visitor Coin Balance" },
      { key: "addCoins", label: "Add Coins" },
      { key: "deductCoins", label: "Deduct Coins" },
      { key: "coinUsagePercentage", label: "Coin Usage Percentage" },
      { key: "coinHistory", label: "Coin History" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    subSections: [
      { key: "generalSettings", label: "General Settings" },
      { key: "bookingRules", label: "Booking Rules" },
      { key: "rescheduleRules", label: "Reschedule Rules" },
      { key: "cancellationRules", label: "Cancellation Rules" },
      { key: "billingSettings", label: "Billing Settings" },
      { key: "paymentSettings", label: "Payment Settings" },
      { key: "qrSettings", label: "QR Settings" },
    ],
  },
];

const COLUMNS_CONFIG = [
  "playerName",
  "gameName",
  "startTime",
  "endTime",
  "status",
  "court",
  "price",
  "paymentStatus",
  "playersCount",
];

export default function AccessControlPage() {
  const [profiles, setProfiles] = useState<UserRoleProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form State
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<Record<string, { view: boolean; edit: boolean; subSections: Record<string, { view: boolean; edit: boolean }> }>>({});
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  // Expanded UI states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  async function loadData() {
    setLoading(true);
    try {
      const [profilesRes, companiesRes, gamesRes] = await Promise.all([
        fetch("/api/admin/access-control"),
        fetch("/api/admin/companies"),
        fetch("/api/games"),
      ]);

      const profilesData = await profilesRes.json();
      const companiesData = await companiesRes.json();
      const gamesData = await gamesRes.json();

      if (profilesData.success) setProfiles(profilesData.roles || []);
      if (companiesData.success) setCompanies(companiesData.companies || []);
      if (gamesData.success) setGames(gamesData.games || []);
    } catch (err: any) {
      setError("Failed to load access control profiles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // Initialize permissions dictionary with default state
    const initPerms: any = {};
    SECTIONS_CONFIG.forEach((sec) => {
      const subs: any = {};
      sec.subSections.forEach((sub) => {
        subs[sub.key] = { view: false, edit: false };
      });
      initPerms[sec.key] = { view: false, edit: false, subSections: subs };
    });
    setPermissions(initPerms);
  }, []);

  function handleEditProfile(profile: UserRoleProfile) {
    setEmail(profile.userId.email);
    setName(profile.userId.name || "");
    setPhone(profile.userId.phone || "");
    setSelectedCompanies(profile.allowedCompanyIds.map((c) => c._id));
    setSelectedGames(profile.allowedGameIds.map((g) => g._id));
    setSelectedColumns(profile.allowedColumns || []);

    const updatedPerms: any = {};
    SECTIONS_CONFIG.forEach((sec) => {
      const dbPerm = profile.permissions.find((p) => p.section === sec.key);
      const subs: any = {};
      sec.subSections.forEach((sub) => {
        const dbSub = dbPerm?.subSections?.[sub.key] || (dbPerm?.subSections as any)?.get?.(sub.key) || { view: false, edit: false };
        subs[sub.key] = { view: !!dbSub.view, edit: !!dbSub.edit };
      });

      const hasSubs = sec.subSections.length > 0;
      const derivedView = hasSubs ? Object.values(subs).some((s: any) => s.view) : !!dbPerm?.view;
      const derivedEdit = hasSubs ? Object.values(subs).some((s: any) => s.edit) : !!dbPerm?.edit;

      updatedPerms[sec.key] = {
        view: derivedView,
        edit: derivedEdit,
        subSections: subs,
      };
    });
    setPermissions(updatedPerms);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Email is required");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    // Transform permissions record to database array format
    const permissionsArray = Object.entries(permissions).map(([sectionKey, val]) => ({
      section: sectionKey,
      view: val.view,
      edit: val.edit,
      subSections: val.subSections,
    }));

    try {
      const response = await fetch("/api/admin/access-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          permissions: permissionsArray,
          allowedCompanyIds: selectedCompanies,
          allowedGameIds: selectedGames,
          allowedColumns: selectedColumns,
          name,
          phone,
          password,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccess("Permission profile created/updated successfully!");
        setEmail("");
        setName("");
        setPhone("");
        setPassword("");
        setSelectedCompanies([]);
        setSelectedGames([]);
        setSelectedColumns([]);
        // Reset permissions
        const initPerms: any = {};
        SECTIONS_CONFIG.forEach((sec) => {
          const subs: any = {};
          sec.subSections.forEach((sub) => {
            subs[sub.key] = { view: false, edit: false };
          });
          initPerms[sec.key] = { view: false, edit: false, subSections: subs };
        });
        setPermissions(initPerms);
        loadData();
      } else {
        setError(data.message || "Failed to save permission profile");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this permission profile?")) return;

    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/access-control/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccess("Permission profile deleted successfully!");
        loadData();
      } else {
        setError(data.message || "Failed to delete permission profile");
      }
    } catch {
      setError("Network error. Please try again.");
    }
  }

  const toggleSectionView = (sectionKey: string) => {
    const sec = SECTIONS_CONFIG.find((s) => s.key === sectionKey);
    if (sec && sec.subSections.length > 0) {
      // Expanding section instead of granting access directly
      setExpandedSections((prev) => ({ ...prev, [sectionKey]: true }));
      return;
    }

    setPermissions((prev) => {
      const current = prev[sectionKey] || { view: false, edit: false, subSections: {} };
      const nextView = !current.view;
      const nextEdit = nextView ? current.edit : false;

      return {
        ...prev,
        [sectionKey]: {
          ...current,
          view: nextView,
          edit: nextEdit,
        },
      };
    });
  };

  const toggleSectionEdit = (sectionKey: string) => {
    const sec = SECTIONS_CONFIG.find((s) => s.key === sectionKey);
    if (sec && sec.subSections.length > 0) {
      // Expanding section instead of granting access directly
      setExpandedSections((prev) => ({ ...prev, [sectionKey]: true }));
      return;
    }

    setPermissions((prev) => {
      const current = prev[sectionKey] || { view: false, edit: false, subSections: {} };
      const nextEdit = !current.edit;
      const nextView = nextEdit ? true : current.view;

      return {
        ...prev,
        [sectionKey]: {
          ...current,
          view: nextView,
          edit: nextEdit,
        },
      };
    });
  };

  const toggleSubSectionView = (sectionKey: string, subKey: string) => {
    setPermissions((prev) => {
      const current = prev[sectionKey] || { view: false, edit: false, subSections: {} };
      const sub = current.subSections[subKey] || { view: false, edit: false };
      const nextView = !sub.view;
      const nextEdit = nextView ? sub.edit : false;

      const updatedSubs = {
        ...current.subSections,
        [subKey]: { view: nextView, edit: nextEdit },
      };

      const mainView = Object.values(updatedSubs).some((s: any) => s.view);
      const mainEdit = Object.values(updatedSubs).some((s: any) => s.edit);

      return {
        ...prev,
        [sectionKey]: {
          ...current,
          view: mainView,
          edit: mainEdit,
          subSections: updatedSubs,
        },
      };
    });
  };

  const toggleSubSectionEdit = (sectionKey: string, subKey: string) => {
    setPermissions((prev) => {
      const current = prev[sectionKey] || { view: false, edit: false, subSections: {} };
      const sub = current.subSections[subKey] || { view: false, edit: false };
      const nextEdit = !sub.edit;
      const nextView = nextEdit ? true : sub.view;

      const updatedSubs = {
        ...current.subSections,
        [subKey]: { view: nextView, edit: nextEdit },
      };

      const mainView = Object.values(updatedSubs).some((s: any) => s.view);
      const mainEdit = Object.values(updatedSubs).some((s: any) => s.edit);

      return {
        ...prev,
        [sectionKey]: {
          ...current,
          view: mainView,
          edit: mainEdit,
          subSections: updatedSubs,
        },
      };
    });
  };

  const toggleCompany = (companyId: string) => {
    setSelectedCompanies((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
    );
  };

  const toggleGame = (gameId: string) => {
    setSelectedGames((prev) =>
      prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
    );
  };

  const toggleColumn = (colName: string) => {
    setSelectedColumns((prev) =>
      prev.includes(colName) ? prev.filter((col) => col !== colName) : [...prev, colName]
    );
  };

  const toggleExpandSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  return (
    <section className="min-w-0 pb-10">
      <div>
        <h1 className="text-4xl font-black text-[var(--primary)] flex items-center gap-3">
          <Shield size={36} className="text-[var(--primary)]" />
          Access Control & RBAC Configuration
        </h1>
        <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
          Manage roles, sub-admin permissions, and restrict staff access to specific companies, games, columns, or features.
        </p>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-black text-red-600 ring-1 ring-red-100">
          {error}
        </p>
      )}

      {success && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-black text-emerald-600 ring-1 ring-emerald-100">
          {success}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mt-6">
        {/* Permission Form */}
        <div className="xl:col-span-2 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-lg font-black text-[var(--primary)] border-b pb-2 flex items-center gap-2">
              <Plus size={20} />
              Set User Permissions
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-gray-400">User Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                  <input
                    type="email"
                    required
                    placeholder="staff@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 bg-gray-50 rounded-xl pl-10 pr-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-gray-400">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 bg-gray-50 rounded-xl px-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-gray-400">Mobile Number</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-11 bg-gray-50 rounded-xl px-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-gray-400">Account Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 bg-gray-50 rounded-xl px-3 border border-gray-100 outline-none text-xs font-bold text-gray-700 focus:ring-1 focus:ring-[var(--primary)]"
                />
              </div>
            </div>

            <p className="text-[10px] text-gray-400 font-bold max-w-2xl leading-relaxed mt-1">
              * Note: If the email matches an existing user account, they will be updated with the configured permissions. Filling in Full Name, Mobile Number, and Password will automatically create a new user profile if they do not exist. If the user already exists, specifying a password will reset/change their login credential.
            </p>

            <div className="space-y-4">
              <label className="text-xs font-black uppercase text-gray-400 block border-b pb-1">Section & Sub-Section Access levels</label>
              
              <div className="space-y-3">
                {SECTIONS_CONFIG.map((sec) => {
                  const sectionPerm = permissions[sec.key] || { view: false, edit: false, subSections: {} };
                  const isExpanded = expandedSections[sec.key];

                  return (
                    <div key={sec.key} className="border border-gray-100 rounded-2xl bg-gray-50/50 overflow-hidden">
                      {/* Section Header */}
                      <div className="p-4 flex flex-wrap items-center justify-between gap-4 bg-gray-50 border-b border-gray-100">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleExpandSection(sec.key)}>
                          {sec.subSections.length > 0 ? (
                            isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />
                          ) : (
                            <div className="w-4" />
                          )}
                          <span className="text-sm font-black text-[var(--primary)]">{sec.label}</span>
                        </div>

                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => toggleSectionView(sec.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                              sectionPerm.view
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-100"
                            }`}
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleSectionEdit(sec.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                              sectionPerm.edit
                                ? "bg-amber-50 border-amber-200 text-amber-800"
                                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-100"
                            }`}
                          >
                            <Edit3 size={13} />
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>

                      {/* Sub-sections items */}
                      {isExpanded && sec.subSections.length > 0 && (
                        <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-gray-100">
                          {sec.subSections.map((sub) => {
                            const subPerm = sectionPerm.subSections?.[sub.key] || { view: false, edit: false };

                            return (
                              <div key={sub.key} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between gap-4">
                                <span className="text-xs font-black text-gray-700">{sub.label}</span>
                                
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleSubSectionView(sec.key, sub.key)}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border transition ${
                                      subPerm.view
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                        : "bg-white border-gray-200 text-gray-400 hover:bg-gray-100"
                                    }`}
                                  >
                                    <Eye size={11} />
                                    <span>View</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => toggleSubSectionEdit(sec.key, sub.key)}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border transition ${
                                      subPerm.edit
                                        ? "bg-amber-50 border-amber-200 text-amber-800"
                                        : "bg-white border-gray-200 text-gray-400 hover:bg-gray-100"
                                    }`}
                                  >
                                    <Edit3 size={11} />
                                    <span>Edit</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Restrictions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-100">
              {/* Allowed Companies */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-400 block">Allowed Companies</label>
                {companies.length === 0 ? (
                  <p className="text-xs font-bold text-gray-400">No companies configured</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                    {companies.map((comp) => {
                      const isChecked = selectedCompanies.includes(comp._id);
                      return (
                        <button
                          type="button"
                          key={comp._id}
                          onClick={() => toggleCompany(comp._id)}
                          className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-left transition text-xs font-bold ${
                            isChecked ? "text-[var(--primary)]" : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          {isChecked ? <CheckSquare size={14} className="text-emerald-600 shrink-0" /> : <Square size={14} className="text-gray-400 shrink-0" />}
                          <span className="truncate">{comp.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Allowed Games */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-400 block">Allowed Games</label>
                {games.length === 0 ? (
                  <p className="text-xs font-bold text-gray-400">No games configured</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                    {games.map((g) => {
                      const isChecked = selectedGames.includes(g._id);
                      return (
                        <button
                          type="button"
                          key={g._id}
                          onClick={() => toggleGame(g._id)}
                          className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-left transition text-xs font-bold ${
                            isChecked ? "text-[var(--primary)]" : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          {isChecked ? <CheckSquare size={14} className="text-emerald-600 shrink-0" /> : <Square size={14} className="text-gray-400 shrink-0" />}
                          <span className="truncate">{g.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Allowed Columns */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-400 block">Visible Columns</label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                  {COLUMNS_CONFIG.map((col) => {
                    const isChecked = selectedColumns.includes(col);
                    return (
                      <button
                        type="button"
                        key={col}
                        onClick={() => toggleColumn(col)}
                        className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-left transition text-xs font-bold ${
                          isChecked ? "text-[var(--primary)]" : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {isChecked ? <CheckSquare size={14} className="text-emerald-600 shrink-0" /> : <Square size={14} className="text-gray-400 shrink-0" />}
                        <span className="truncate">{col}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-full bg-[var(--primary)] text-white text-xs font-black hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {submitting ? "Saving Config..." : "Save Permission Profile"}
            </button>
          </form>
        </div>

        {/* Profiles List */}
        <div className="xl:col-span-1 space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h3 className="text-lg font-black text-[var(--primary)] border-b pb-2 mb-4 flex items-center gap-2">
              <Shield size={20} />
              Active RBAC Profiles
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-[var(--primary)]" />
              </div>
            ) : profiles.length === 0 ? (
              <p className="text-xs font-bold text-gray-400 text-center py-10">No profiles configured.</p>
            ) : (
              <div className="space-y-4">
                {profiles.map((profile) => (
                  <div key={profile._id} className="p-4 border border-gray-100 bg-gray-50 rounded-2xl space-y-3 relative group">
                    <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5">
                      <button
                        onClick={() => handleEditProfile(profile)}
                        className="p-1.5 rounded-full hover:bg-white text-[var(--primary)] shadow-sm border border-gray-150 transition"
                        title="Edit Profile"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(profile._id)}
                        className="p-1.5 rounded-full hover:bg-red-50 text-red-500 shadow-sm border border-red-150 transition"
                        title="Delete Profile"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div>
                      <h4 className="text-xs font-black text-[var(--primary)] truncate w-4/5">{profile.userId?.name}</h4>
                      <p className="text-[10px] font-bold text-gray-400 truncate w-4/5 mt-0.5">{profile.userId?.email}</p>
                    </div>

                    {/* Permissions list summary */}
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-gray-400">Granted Section Views</span>
                      <div className="flex flex-wrap gap-1">
                        {profile.permissions.filter((p) => p.view).map((p) => (
                          <span key={p.section} className="text-[9px] font-bold bg-white text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                            {p.section} {p.edit && <span className="text-amber-600 font-extrabold">+E</span>}
                          </span>
                        ))}
                      </div>
                    </div>

                    {profile.allowedCompanyIds.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-gray-400">Companies</span>
                        <div className="flex flex-wrap gap-1">
                          {profile.allowedCompanyIds.map((c) => (
                            <span key={c._id} className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-0.5">
                              <Building size={8} /> {c.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {profile.allowedGameIds.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-gray-400">Games</span>
                        <div className="flex flex-wrap gap-1">
                          {profile.allowedGameIds.map((g) => (
                            <span key={g._id} className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-0.5">
                              <Gamepad2 size={8} /> {g.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {profile.allowedColumns && profile.allowedColumns.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-gray-400">Columns</span>
                        <div className="flex flex-wrap gap-1">
                          {profile.allowedColumns.map((col) => (
                            <span key={col} className="text-[9px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 flex items-center gap-0.5">
                              <Columns size={8} /> {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
