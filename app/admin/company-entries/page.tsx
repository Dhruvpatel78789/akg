"use client";

import { useEffect, useState, useMemo } from "react";
import { Edit2, Trash2, RotateCcw, X, Filter, Search, Building, Gamepad, Plus, Upload, Play } from "lucide-react";

type Company = {
  _id: string;
  name: string;
  allowedGameIds?: string[];
};

type Game = {
  _id: string;
  name: string;
};

type Employee = {
  _id: string;
  employeeId: string;
  name: string;
  mobile: string;
  email: string;
};

type SessionEntry = {
  _id: string;
  bookingGroupId: string;
  userType: string;
  playerName: string;
  mobile: string;
  gameName: string;
  gameId: string;
  court: string;
  startTime: string;
  endTime: string;
  status: string;
  softDeleted: boolean;
  bookedDurationMinutes: number;
  companyId?: {
    _id: string;
    name: string;
    colorCode?: string;
  };
};

const cardClass =
  "rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-[0_18px_45px_rgba(0,48,22,0.08)] backdrop-blur-2xl";

const fieldClass =
  "h-12 w-full min-w-0 rounded-2xl border border-black/5 bg-white/75 px-4 font-bold text-[var(--primary)] outline-none shadow-inner focus:ring-1 focus:ring-[var(--primary)]";

function mergeById<T extends { _id: string }>(current: T[], incoming: T[]): T[] {
  const incomingMap = new Map(incoming.map((item) => [item._id, item]));

  const updated = current
    .map((item) => incomingMap.get(item._id) || item)
    .filter((item) => incomingMap.has(item._id));

  const existingIds = new Set(current.map((item) => item._id));
  const added = incoming.filter((item) => !existingIds.has(item._id));

  return [...added, ...updated];
}

export default function AdminCompanyEntriesPage() {
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groupByGroup, setGroupByGroup] = useState(false);

  // Filters
  const [filterCompany, setFilterCompany] = useState("");
  const [filterGame, setFilterGame] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterPlayer, setFilterPlayer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  // Modal displays
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showRandomModal, setShowRandomModal] = useState(false);

  // Manual entry states
  const [manualForm, setManualForm] = useState({
    companyId: "",
    companyEmployeeId: "",
    gameId: "",
    court: "Court A",
    date: "",
    startTime: "",
    durationMinutes: 60,
    status: "COMPLETED",
  });

  // CSV states
  const [csvCompanyId, setCsvCompanyId] = useState("");
  const [csvText, setCsvText] = useState("");

  // Random Generator states
  const [genForm, setGenForm] = useState({
    companyId: "",
    targetAmount: 5000,
    entriesCount: 10,
    startDate: "",
    endDate: "",
    mode: "A", // A: Random, B: Selected Players
    selectedEmployeeIds: [] as string[],
  });

  // Editing state
  const [editingEntry, setEditingEntry] = useState<SessionEntry | null>(null);
  const [editForm, setEditForm] = useState({
    startTime: "",
    endTime: "",
    court: "",
    status: "",
    softDeleted: false,
  });

  const [message, setMessage] = useState("");

  async function loadMetadata() {
    try {
      const [companiesRes, gamesRes] = await Promise.all([
        fetch("/api/admin/companies"),
        fetch("/api/games"),
      ]);

      const companiesData = await companiesRes.json();
      const gamesData = await gamesRes.json();

      setCompanies(companiesData.companies || []);
      setGames(gamesData.games || []);
    } catch (err) {
      console.error("Failed to load filter metadata", err);
    }
  }

  // Load employees when company is selected in manual or generator form
  async function loadEmployeesForCompany(companyId: string) {
    if (!companyId) {
      setEmployees([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/employees`);
      const data = await res.json();
      if (res.ok && data.success) {
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadEntries(isBackground = false) {
    if (!isBackground) {
      if (entries.length === 0) setInitialLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const params = new URLSearchParams({
        showDeleted: String(showDeleted),
      });
      if (filterCompany) params.set("companyId", filterCompany);
      if (filterGame) params.set("gameId", filterGame);
      if (filterDate) params.set("date", filterDate);
      if (filterPlayer) params.set("player", filterPlayer);
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/admin/company-entries?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        const incoming = data.entries || [];
        setEntries((prev) => {
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

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    loadEntries(false);
    const interval = setInterval(() => {
      loadEntries(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [filterCompany, filterGame, filterDate, filterPlayer, filterStatus, showDeleted]);

  const renderRow = (entry: SessionEntry, isGrouped = false) => {
    return (
      <tr
        key={entry._id}
        className={`border-b border-black/5 hover:bg-gray-55 transition ${entry.softDeleted ? "bg-gray-100" : ""} ${isGrouped ? "bg-indigo-50/10" : ""}`}
      >
        <td className={`py-4 font-black text-[var(--primary)] ${isGrouped ? "pl-8" : ""}`}>
          <div className="flex flex-col">
            <span>{entry.playerName}</span>
            <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md w-max mt-0.5 uppercase font-bold">
              {entry.companyId ? entry.companyId.name : entry.userType}
            </span>
          </div>
        </td>
        <td className="font-semibold text-gray-650">{entry.mobile}</td>
        <td>
          <div className="flex flex-col">
            <span className="font-bold">{entry.gameName}</span>
            <span className="text-[10px] text-[var(--text-muted)] font-bold">{entry.court}</span>
          </div>
        </td>
        <td className="font-bold">
          {new Date(entry.startTime).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </td>
        <td className="font-bold">
          {new Date(entry.endTime).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </td>
        <td className="font-bold">{entry.bookedDurationMinutes} mins</td>
        <td>
          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
            entry.status === "COMPLETED"
              ? "bg-emerald-50 text-emerald-700"
              : entry.status === "STARTED"
              ? "bg-indigo-50 text-indigo-700 animate-pulse"
              : entry.status === "CANCELLED"
              ? "bg-rose-50 text-rose-700"
              : "bg-amber-50 text-amber-700"
          }`}>
            {entry.status}
          </span>
        </td>
        <td>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => startEdit(entry)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
              title="Edit Entry"
            >
              <Edit2 size={14} />
            </button>
            {entry.softDeleted ? (
              <button
                onClick={() => handleRestore(entry._id)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                title="Restore Entry"
              >
                <RotateCcw size={14} />
              </button>
            ) : (
              <button
                onClick={() => handleSoftDelete(entry._id)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
                title="Soft Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const renderedRows = useMemo(() => {
    if (!groupByGroup) {
      return entries.map((entry) => renderRow(entry));
    }

    const groups: { [key: string]: SessionEntry[] } = {};
    const ungrouped: SessionEntry[] = [];

    for (const entry of entries) {
      const gid = entry.bookingGroupId;
      if (gid) {
        if (!groups[gid]) groups[gid] = [];
        groups[gid].push(entry);
      } else {
        ungrouped.push(entry);
      }
    }

    const elements: React.ReactNode[] = [];

    // Render grouped entries
    for (const [gid, groupEntries] of Object.entries(groups)) {
      const first = groupEntries[0];
      elements.push(
        <tr key={`group-header-${gid}`} className="bg-indigo-50/20 border-b border-indigo-100 font-extrabold text-indigo-950">
          <td colSpan={8} className="py-2.5 px-4 text-xs font-black tracking-wider uppercase text-indigo-800">
            📦 Group ID: <span className="font-extrabold text-gray-500">{gid}</span> — {first.gameName} on {first.court}
          </td>
        </tr>
      );
      for (const entry of groupEntries) {
        elements.push(renderRow(entry, true));
      }
    }

    // Render ungrouped entries
    if (ungrouped.length > 0) {
      elements.push(
        <tr key="ungrouped-header" className="bg-gray-100/50 border-b font-extrabold text-gray-500">
          <td colSpan={8} className="py-2.5 px-4 text-xs tracking-wider uppercase">
            Ungrouped Sessions
          </td>
        </tr>
      );
      for (const entry of ungrouped) {
        elements.push(renderRow(entry));
      }
    }

    return elements;
  }, [entries, groupByGroup]);

  // Handle Manual creation submit
  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/company-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "MANUAL", ...manualForm }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage("Manual entry created successfully");
        setShowManualModal(false);
        loadEntries();
        setTimeout(() => setMessage(""), 3000);
      } else {
        alert(data.message || "Failed to create manual entry");
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Handle CSV Import submit
  async function handleCsvSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      // Basic client CSV row parsing
      const lines = csvText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        alert("CSV requires at least a header row and one data row.");
        return;
      }
      
      const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
      const empIdIdx = headers.indexOf("employeeid");
      const gameIdx = headers.indexOf("game");
      const dateIdx = headers.indexOf("date");
      const startIdx = headers.indexOf("starttime");
      const durIdx = headers.indexOf("duration");
      const courtIdx = headers.indexOf("court");

      if (empIdIdx === -1 || gameIdx === -1 || dateIdx === -1 || startIdx === -1 || durIdx === -1) {
        alert("CSV must contain columns: employeeId, game, date, startTime, duration");
        return;
      }

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map(p => p.trim());
        rows.push({
          employeeId: parts[empIdIdx],
          gameName: parts[gameIdx],
          date: parts[dateIdx],
          startTime: parts[startIdx],
          durationMinutes: Number(parts[durIdx]),
          court: courtIdx !== -1 ? parts[courtIdx] : "Court A",
        });
      }

      const res = await fetch("/api/admin/company-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CSV", companyId: csvCompanyId, rows }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(`Imported ${data.successCount} entries. Rejected: ${data.rejectedCount}`);
        setShowCsvModal(false);
        loadEntries();
        setTimeout(() => setMessage(""), 3000);
      } else {
        alert(data.message || "Import failed");
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Handle Random Generation submit
  async function handleGenSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/company-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "GENERATE_RANDOM", ...genForm }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(data.message || "Random entries generated successfully");
        setShowRandomModal(false);
        loadEntries();
        setTimeout(() => setMessage(""), 3000);
      } else {
        alert(data.message || "Failed to generate entries");
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Open edit modal
  function startEdit(entry: SessionEntry) {
    setEditingEntry(entry);
    
    // Format dates to datetime-local inputs: YYYY-MM-DDTHH:MM
    const formatToLocal = (dStr: string) => {
      const d = new Date(dStr);
      const tzOffset = d.getTimezoneOffset() * 60000; // offset in milliseconds
      const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
      return localISOTime;
    };

    setEditForm({
      startTime: formatToLocal(entry.startTime),
      endTime: formatToLocal(entry.endTime),
      court: entry.court,
      status: entry.status,
      softDeleted: entry.softDeleted,
    });
  }

  // Submit edits
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEntry) return;

    try {
      const res = await fetch(`/api/admin/company-entries/${editingEntry._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessage("Company entry updated successfully");
        setEditingEntry(null);
        loadEntries();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(data.message || "Failed to update entry");
      }
    } catch (err) {
      console.error(err);
      setMessage("Connection failed");
    }
  }

  // Soft Delete entry
  async function handleSoftDelete(id: string) {
    if (!confirm("Are you sure you want to delete this company entry?")) return;
    try {
      const res = await fetch(`/api/admin/company-entries/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage("Entry deleted");
        loadEntries();
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Restore deleted entry
  async function handleRestore(id: string) {
    try {
      const res = await fetch(`/api/admin/company-entries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ softDeleted: false }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage("Entry restored successfully");
        loadEntries();
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <section className="min-w-0 pb-12">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-5xl font-black text-[var(--primary)]">Company Entries</h1>
          <p className="text-sm font-bold text-[var(--text-muted)] mt-1">
            Monitor and manage individual corporate and visitor play session logs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setEmployees([]);
              setManualForm({
                companyId: "",
                companyEmployeeId: "",
                gameId: "",
                court: "Court A",
                date: "",
                startTime: "",
                durationMinutes: 60,
                status: "COMPLETED",
              });
              setShowManualModal(true);
            }}
            className="flex items-center gap-1.5 rounded-full bg-[var(--primary)] text-white px-4 py-2.5 text-xs font-black hover:opacity-90 active:scale-95 transition"
          >
            <Plus size={14} />
            <span>Add Entry</span>
          </button>
          <button
            onClick={() => {
              setCsvCompanyId("");
              setCsvText("");
              setShowCsvModal(true);
            }}
            className="flex items-center gap-1.5 rounded-full bg-white text-[var(--primary)] px-4 py-2.5 text-xs font-black shadow-sm ring-1 ring-black/5 hover:opacity-90 active:scale-95 transition"
          >
            <Upload size={14} />
            <span>Upload CSV</span>
          </button>
          <button
            onClick={() => {
              setEmployees([]);
              setGenForm({
                companyId: "",
                targetAmount: 5000,
                entriesCount: 10,
                startDate: "",
                endDate: "",
                mode: "A",
                selectedEmployeeIds: [],
              });
              setShowRandomModal(true);
            }}
            className="flex items-center gap-1.5 rounded-full bg-indigo-600 text-white px-4 py-2.5 text-xs font-black hover:opacity-90 active:scale-95 transition"
          >
            <Play size={14} />
            <span>Generate Random</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-2xl border border-white/60 bg-white/70 p-4 text-sm font-black text-[var(--primary)] shadow-sm backdrop-blur-2xl">
          {message}
        </div>
      )}

      {/* Filters Form */}
      <section className={`${cardClass} mb-8`}>
        <div className="flex items-center gap-2 mb-4 text-[var(--primary)] font-black">
          <Filter size={18} />
          <span>Filters</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Company</span>
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className={fieldClass}
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Game</span>
            <select
              value={filterGame}
              onChange={(e) => setFilterGame(e.target.value)}
              className={fieldClass}
            >
              <option value="">All Games</option>
              {games.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Status</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={fieldClass}
            >
              <option value="">All Statuses</option>
              <option value="BOOKED">BOOKED</option>
              <option value="STARTED">STARTED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Date</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className={fieldClass}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Search Player</span>
            <input
              type="text"
              placeholder="Name or phone"
              value={filterPlayer}
              onChange={(e) => setFilterPlayer(e.target.value)}
              className={fieldClass}
            />
          </label>
        </div>

        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showDeletedCheckbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="w-5 h-5 accent-[var(--primary)] cursor-pointer"
            />
            <label htmlFor="showDeletedCheckbox" className="text-xs font-black text-[var(--primary)] cursor-pointer select-none">
              Show Soft-Deleted Entries
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="groupByGroupCheckbox"
              checked={groupByGroup}
              onChange={(e) => setGroupByGroup(e.target.checked)}
              className="w-5 h-5 accent-[var(--primary)] cursor-pointer"
            />
            <label htmlFor="groupByGroupCheckbox" className="text-xs font-black text-[var(--primary)] cursor-pointer select-none">
              Group by bookingGroupId
            </label>
          </div>
        </div>
      </section>

      {/* Entries List Table */}
      <section className={cardClass}>
        {initialLoading ? (
          <p className="text-center font-black py-12 text-gray-500">Loading entries...</p>
        ) : entries.length === 0 ? (
          <p className="text-center font-black py-12 text-gray-500">No session entries found matching filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-[var(--text-muted)] font-black">
                  <th className="py-4">Player</th>
                  <th>Mobile</th>
                  <th>Game / Court</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {renderedRows}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl relative space-y-4">
            <button onClick={() => setShowManualModal(false)} className="absolute right-4 top-4 text-gray-400">
              <X size={20} />
            </button>
            <h3 className="text-2xl font-black text-[var(--primary)]">Add Manual Entry</h3>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <label className="grid gap-1">
                <span className="text-xs font-bold text-gray-500">Company</span>
                <select
                  value={manualForm.companyId}
                  onChange={(e) => {
                    setManualForm({ ...manualForm, companyId: e.target.value, companyEmployeeId: "" });
                    loadEmployeesForCompany(e.target.value);
                  }}
                  required
                  className={fieldClass}
                >
                  <option value="">Select Company</option>
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-bold text-gray-500">Employee</span>
                <select
                  value={manualForm.companyEmployeeId}
                  onChange={(e) => setManualForm({ ...manualForm, companyEmployeeId: e.target.value })}
                  required
                  disabled={!manualForm.companyId}
                  className={fieldClass}
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>{emp.name} ({emp.employeeId})</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-bold text-gray-500">Game</span>
                <select
                  value={manualForm.gameId}
                  onChange={(e) => setManualForm({ ...manualForm, gameId: e.target.value })}
                  required
                  className={fieldClass}
                >
                  <option value="">Select Game</option>
                  {games.map((g) => (
                    <option key={g._id} value={g._id}>{g.name}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-gray-500">Court</span>
                  <input
                    type="text"
                    value={manualForm.court}
                    onChange={(e) => setManualForm({ ...manualForm, court: e.target.value })}
                    required
                    className={fieldClass}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-gray-500">Duration (Minutes)</span>
                  <input
                    type="number"
                    value={manualForm.durationMinutes}
                    onChange={(e) => setManualForm({ ...manualForm, durationMinutes: Number(e.target.value) })}
                    required
                    min={1}
                    className={fieldClass}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-gray-500">Date</span>
                  <input
                    type="date"
                    value={manualForm.date}
                    onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                    required
                    className={fieldClass}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-gray-500">Start Time</span>
                  <input
                    type="time"
                    value={manualForm.startTime}
                    onChange={(e) => setManualForm({ ...manualForm, startTime: e.target.value })}
                    required
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-bold text-gray-500">Status</span>
                <select
                  value={manualForm.status}
                  onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
                  className={fieldClass}
                >
                  <option value="BOOKED">BOOKED</option>
                  <option value="STARTED">STARTED</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </label>

              <button className="h-12 w-full rounded-2xl bg-[var(--primary)] text-sm font-black text-white hover:opacity-95 transition">
                Create Entry
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl relative space-y-4">
            <button onClick={() => setShowCsvModal(false)} className="absolute right-4 top-4 text-gray-400">
              <X size={20} />
            </button>
            <h3 className="text-2xl font-black text-[var(--primary)]">Upload Company Entries CSV</h3>

            <form onSubmit={handleCsvSubmit} className="space-y-3">
              <label className="grid gap-1">
                <span className="text-xs font-bold text-gray-500">Company Target</span>
                <select
                  value={csvCompanyId}
                  onChange={(e) => setCsvCompanyId(e.target.value)}
                  required
                  className={fieldClass}
                >
                  <option value="">Select Company</option>
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-bold text-gray-500">CSV Data (Plain Text comma-separated values)</span>
                <textarea
                  placeholder="employeeId,game,date,startTime,duration,court&#10;EMP101,Cricket,2026-06-10,18:00,60,Court A&#10;EMP102,Football,2026-06-10,19:00,90,Court B"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  required
                  className="h-44 w-full rounded-2xl border border-black/5 bg-white/75 p-4 font-bold text-[var(--primary)] outline-none shadow-inner resize-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </label>

              <button className="h-12 w-full rounded-2xl bg-[var(--primary)] text-sm font-black text-white hover:opacity-95 transition">
                Start Import
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Random Generator Modal */}
      {showRandomModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl relative space-y-4">
            <button onClick={() => setShowRandomModal(false)} className="absolute right-4 top-4 text-gray-400">
              <X size={20} />
            </button>
            <h3 className="text-2xl font-black text-[var(--primary)]">Generate Random Usage Data</h3>

            <form onSubmit={handleGenSubmit} className="space-y-3">
              <label className="grid gap-1">
                <span className="text-xs font-bold text-gray-500">Company Target</span>
                <select
                  value={genForm.companyId}
                  onChange={(e) => {
                    setGenForm({ ...genForm, companyId: e.target.value, selectedEmployeeIds: [] });
                    loadEmployeesForCompany(e.target.value);
                  }}
                  required
                  className={fieldClass}
                >
                  <option value="">Select Company</option>
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-gray-500">Target Invoice Sum (₹)</span>
                  <input
                    type="number"
                    value={genForm.targetAmount}
                    onChange={(e) => setGenForm({ ...genForm, targetAmount: Number(e.target.value) })}
                    required
                    min={1}
                    className={fieldClass}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-gray-500">Entries Quantity</span>
                  <input
                    type="number"
                    value={genForm.entriesCount}
                    onChange={(e) => setGenForm({ ...genForm, entriesCount: Number(e.target.value) })}
                    required
                    min={1}
                    className={fieldClass}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-gray-500">Start Range Date</span>
                  <input
                    type="date"
                    value={genForm.startDate}
                    onChange={(e) => setGenForm({ ...genForm, startDate: e.target.value })}
                    required
                    className={fieldClass}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-gray-500">End Range Date</span>
                  <input
                    type="date"
                    value={genForm.endDate}
                    onChange={(e) => setGenForm({ ...genForm, endDate: e.target.value })}
                    required
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-bold text-gray-500">Mode Selection</span>
                <select
                  value={genForm.mode}
                  onChange={(e) => setGenForm({ ...genForm, mode: e.target.value, selectedEmployeeIds: [] })}
                  className={fieldClass}
                >
                  <option value="A">Mode A: Completely Random Employees</option>
                  <option value="B">Mode B: Restrict to Specific Employees</option>
                </select>
              </label>

              {genForm.mode === "B" && employees.length > 0 && (
                <div className="grid gap-1.5 max-h-48 overflow-y-auto bg-gray-50 p-3 rounded-2xl border border-black/5">
                  <span className="text-[10px] font-black uppercase text-gray-400">Search Employees</span>
                  <input
                    type="text"
                    placeholder="Search by ID, name, mobile, email..."
                    id="emp-search-input"
                    className="h-9 w-full rounded-xl border border-black/5 bg-white px-3 text-xs font-semibold outline-none mb-2"
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase();
                      const items = document.querySelectorAll(".emp-gen-row");
                      items.forEach((item: any) => {
                        const txt = item.getAttribute("data-search").toLowerCase();
                        if (txt.includes(val)) {
                          item.style.display = "flex";
                        } else {
                          item.style.display = "none";
                        }
                      });
                    }}
                  />
                  <span className="text-[10px] font-black uppercase text-gray-400">Select Employees</span>
                  {employees.map(emp => (
                    <label
                      key={emp._id}
                      className="flex items-center gap-2 cursor-pointer font-bold text-xs emp-gen-row"
                      data-search={`${emp.name} ${emp.employeeId} ${emp.mobile} ${emp.email}`}
                    >
                      <input
                        type="checkbox"
                        checked={genForm.selectedEmployeeIds.includes(emp._id)}
                        onChange={(e) => {
                          const ids = [...genForm.selectedEmployeeIds];
                          if (e.target.checked) {
                            ids.push(emp._id);
                          } else {
                            const idx = ids.indexOf(emp._id);
                            if (idx !== -1) ids.splice(idx, 1);
                          }
                          setGenForm({ ...genForm, selectedEmployeeIds: ids });
                        }}
                      />
                      <span>{emp.name} ({emp.employeeId})</span>
                    </label>
                  ))}
                </div>
              )}

              <button className="h-12 w-full rounded-2xl bg-[var(--primary)] text-sm font-black text-white hover:opacity-95 transition">
                Execute Generator Run
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Editing Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setEditingEntry(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <h3 className="text-2xl font-black text-[var(--primary)] mb-5">Edit Session Entry</h3>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid gap-1">
                <label className="text-xs font-bold text-[var(--text-muted)]">Court</label>
                <input
                  type="text"
                  value={editForm.court}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, court: e.target.value }))}
                  required
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-bold text-[var(--text-muted)]">Start Time</label>
                <input
                  type="datetime-local"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, startTime: e.target.value }))}
                  required
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-bold text-[var(--text-muted)]">End Time</label>
                <input
                  type="datetime-local"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, endTime: e.target.value }))}
                  required
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-bold text-[var(--text-muted)]">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                  className={fieldClass}
                >
                  <option value="BOOKED">BOOKED</option>
                  <option value="STARTED">STARTED</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="modalSoftDeleted"
                  checked={editForm.softDeleted}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, softDeleted: e.target.checked }))}
                  className="w-5 h-5 accent-[var(--primary)] cursor-pointer"
                />
                <label htmlFor="modalSoftDeleted" className="text-xs font-black text-[var(--primary)] cursor-pointer select-none">
                  Soft Deleted
                </label>
              </div>

              <button className="h-12 w-full rounded-2xl bg-[var(--primary)] text-sm font-black text-white hover:opacity-95 mt-4 transition">
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
