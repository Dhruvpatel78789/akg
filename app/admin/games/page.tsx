"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  Coins,
  Edit2,
  Gamepad2,
  Layers,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";

type Game = {
  _id: string;
  name: string;
  duration: number;
  maximumDuration: number;
  bufferMinutes: number;
  fixedSlotBooking?: boolean;
  allowCourtSelection?: boolean;
  active: boolean;
  blockedGameIds?: string[];
};

type Court = {
  _id: string;
  name: string;
  active: boolean;
  disabled: boolean;
  blocks?: any[];
};

type PricingRule = {
  _id: string;
  minPlayers: number;
  maxPlayers: number;
  durationMinutes: number;
  mode: "PER_PLAYER" | "COURT_BASE_PLUS_PLAYER";
  baseCourtPrice: number;
  pricePerPlayer: number;
};

const fieldClass =
  "h-12 w-full min-w-0 rounded-2xl border border-black/5 bg-white/75 px-4 font-bold text-[var(--primary)] outline-none shadow-inner";

const cardClass =
  "rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-[0_18px_45px_rgba(0,48,22,0.08)] backdrop-blur-2xl";

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [message, setMessage] = useState("");
  

  const [gameForm, setGameForm] = useState({
    name: "",
    duration: 60,
    maximumDuration: 180,
    bufferMinutes: 10,
    fixedSlotBooking: false,
    allowCourtSelection: false,
  });

  const [editGame, setEditGame] = useState({
    name: "",
    duration: 60,
    maximumDuration: 180,
    bufferMinutes: 10,
    fixedSlotBooking: false,
    allowCourtSelection: false,
    active: true,
    blockedGameIds: [] as string[],
  });

  const [courtName, setCourtName] = useState("");

  // Recurring Blocks states
  const [recurringBlocks, setRecurringBlocks] = useState<any[]>([]);
  const [recurringModal, setRecurringModal] = useState<{
    courtId: string;
    courtName: string;
  } | null>(null);

  const [recurringForm, setRecurringForm] = useState({
    _id: "",
    startTime: "",
    endTime: "",
    daysOfWeek: [] as string[],
    startDate: "",
    endDate: "",
    reason: "",
    active: true,
  });

  const [recurringConflictData, setRecurringConflictData] = useState<{
    conflictsCount: number;
    conflicts: any[];
    message: string;
  } | null>(null);

  const [courtBlockModal, setCourtBlockModal] = useState<{
    courtId: string;
    courtName: string;
  } | null>(null);

  const [courtBlockForm, setCourtBlockForm] = useState({
    blockedFrom: "",
    blockedTo: "",
    reason: "",
  });

  const [pricingForm, setPricingForm] = useState({
    minPlayers: 1,
    maxPlayers: 2,
    durationMinutes: 60,
    mode: "PER_PLAYER" as PricingRule["mode"],
    baseCourtPrice: 0,
    pricePerPlayer: 100,
  });

  const [editingRuleId, setEditingRuleId] = useState("");
  const [editingRule, setEditingRule] = useState({
    minPlayers: 1,
    maxPlayers: 2,
    durationMinutes: 60,
    mode: "PER_PLAYER" as PricingRule["mode"],
    baseCourtPrice: 0,
    pricePerPlayer: 100,
  });
  const [pricingErrors, setPricingErrors] = useState<Record<string, string>>({});
const [autoSavingRuleId, setAutoSavingRuleId] = useState("");
const [lastSavedRuleId, setLastSavedRuleId] = useState("");

  async function safeJson(response: Response) {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  function getPricingErrorClass(field: string) {
  return pricingErrors[field]
    ? "border-red-400 bg-red-50"
    : "";
}

function getApiErrors(data: any) {
  const errors: Record<string, string> = {};

  Object.entries(data?.errors || {}).forEach(([key, value]) => {
    if (Array.isArray(value) && value[0]) {
      errors[key] = String(value[0]);
    }
  });

  if (!Object.keys(errors).length && data?.message) {
    const message = String(data.message).toLowerCase();

    if (message.includes("duration"))
      errors.durationMinutes = data.message;
    else if (message.includes("minimum"))
      errors.minPlayers = data.message;
    else if (message.includes("maximum"))
      errors.maxPlayers = data.message;
    else if (message.includes("conflict"))
      errors.minPlayers = data.message;
    else errors.general = data.message;
  }

  return errors;
}

  async function loadGames() {
    const response = await fetch("/api/admin/games", {
      cache: "no-store",
    });

    const data = await safeJson(response);
    const loadedGames = data?.games || [];

    setGames(loadedGames);

    if (!selectedGame && loadedGames[0]) {
      selectGame(loadedGames[0]);
    }
  }

  async function loadGameDetails(gameId: string) {
    const [courtsRes, rulesRes, recurringRes] = await Promise.all([
      fetch(`/api/admin/games/${gameId}/courts`, { cache: "no-store" }),
      fetch(`/api/admin/games/${gameId}/pricing-rules`, {
        cache: "no-store",
      }),
      fetch(`/api/admin/recurring-blocks?gameId=${gameId}`, { cache: "no-store" }),
    ]);

    const courtsData = await safeJson(courtsRes);
    const rulesData = await safeJson(rulesRes);
    const recurringData = await safeJson(recurringRes);

    setCourts(courtsData?.courts || []);
    setRules(rulesData?.rules || []);
    setRecurringBlocks(recurringData?.blocks || []);
  }

  function selectGame(game: Game) {
    setSelectedGame(game);

    setEditGame({
      name: game.name,
      duration: game.duration,
      maximumDuration: game.maximumDuration,
      bufferMinutes: game.bufferMinutes || 0,
      fixedSlotBooking: game.fixedSlotBooking || false,
      allowCourtSelection: game.allowCourtSelection || false,
      active: game.active,
      blockedGameIds: game.blockedGameIds || [],
    });

    setPricingForm((prev) => ({
      ...prev,
      durationMinutes: game.duration,
    }));

    loadGameDetails(game._id);
  }

  async function createGame(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/admin/games", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gameForm),
    });

    const data = await safeJson(response);

    if (!response.ok) {
      setMessage(data?.message || "Failed to create game");
      return;
    }

    setGameForm({
      name: "",
      duration: 60,
      maximumDuration: 180,
      bufferMinutes: 10,
      fixedSlotBooking: false,
      allowCourtSelection: false,
    });

    setMessage("Game created");
    loadGames();
  }

  async function updateSelectedGame(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedGame) return;

    const response = await fetch(`/api/admin/games/${selectedGame._id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(editGame),
    });

    const data = await safeJson(response);

    if (!response.ok) {
      setMessage(data?.message || "Failed to update game");
      return;
    }

    setMessage("Game updated");
    setSelectedGame(data.game);
    loadGames();
  }

  async function createCourt(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedGame) return;

    const response = await fetch(`/api/admin/games/${selectedGame._id}/courts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: courtName }),
    });

    const data = await safeJson(response);

    if (!response.ok) {
      setMessage(data?.message || "Failed to create court");
      return;
    }

    setCourtName("");
    setMessage("Court created");
    loadGameDetails(selectedGame._id);
  }

  async function blockCourt(overrideMode?: "KEEP" | "OVERRIDE") {
    if (!selectedGame || !courtBlockModal) return;

    const response = await fetch(
      `/api/admin/courts/${courtBlockModal.courtId}/block`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...courtBlockForm, overrideMode }),
      }
    );

    const data = await safeJson(response);

    if (response.ok && data?.hasBookings) {
      // Prompt option A or option B selection
      const choice = window.confirm(
        `${data.message}\n\nClick OK to Keep existing bookings and block only for new bookings (Option A).\nClick Cancel to Override existing bookings and mark them as Reschedule Required (Option B).`
      );
      if (choice) {
        // Option A
        await blockCourt("KEEP");
      } else {
        // Option B
        await blockCourt("OVERRIDE");
      }
      return;
    }

    if (!response.ok) {
      setMessage(data?.message || "Failed to block court");
      return;
    }

    setMessage(data?.message || "Court block scheduled");

    setCourtBlockModal(null);
    setCourtBlockForm({
      blockedFrom: "",
      blockedTo: "",
      reason: "",
    });

    loadGameDetails(selectedGame._id);
  }

  async function submitRecurringBlock(resolutionType?: "KEEP" | "RESCHEDULE") {
    if (!selectedGame || !recurringModal) return;

    const url = recurringForm._id
      ? `/api/admin/recurring-blocks/${recurringForm._id}`
      : "/api/admin/recurring-blocks";
    const method = recurringForm._id ? "PUT" : "POST";

    const payload = {
      gameId: selectedGame._id,
      courtId: recurringModal.courtId,
      startTime: recurringForm.startTime,
      endTime: recurringForm.endTime,
      daysOfWeek: recurringForm.daysOfWeek,
      startDate: recurringForm.startDate || null,
      endDate: recurringForm.endDate || null,
      reason: recurringForm.reason,
      active: recurringForm.active,
      resolutionType
    };

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await safeJson(response);

      if (response.ok) {
        setRecurringModal(null);
        setRecurringForm({
          _id: "",
          startTime: "",
          endTime: "",
          daysOfWeek: [],
          startDate: "",
          endDate: "",
          reason: "",
          active: true,
        });
        setRecurringConflictData(null);
        setMessage(recurringForm._id ? "Recurring block updated successfully" : "Recurring block created successfully");
        loadGameDetails(selectedGame._id);
        return;
      }

      if (data?.hasConflicts) {
        setRecurringConflictData({
          conflictsCount: data.conflictsCount,
          conflicts: data.conflicts,
          message: data.message
        });
        return;
      }

      alert(data?.message || "Operation failed");
    } catch (err: any) {
      console.error(err);
      alert("An error occurred: " + err.message);
    }
  }

  function startEditRecurring(block: any, courtName: string) {
    setRecurringModal({
      courtId: block.courtId._id || block.courtId,
      courtName: courtName
    });
    setRecurringForm({
      _id: block._id,
      startTime: block.startTime,
      endTime: block.endTime,
      daysOfWeek: block.daysOfWeek || [],
      startDate: block.startDate ? new Date(block.startDate).toISOString().split("T")[0] : "",
      endDate: block.endDate ? new Date(block.endDate).toISOString().split("T")[0] : "",
      reason: block.reason || "",
      active: block.active,
    });
    setRecurringConflictData(null);
  }

  async function toggleRecurringBlockActive(block: any) {
    if (!selectedGame) return;
    try {
      const response = await fetch(`/api/admin/recurring-blocks/${block._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !block.active })
      });
      if (response.ok) {
        loadGameDetails(selectedGame._id);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteRecurringBlock(blockId: string) {
    if (!selectedGame) return;
    if (!window.confirm("Are you sure you want to delete this recurring block?")) return;
    try {
      const response = await fetch(`/api/admin/recurring-blocks/${blockId}`, {
        method: "DELETE"
      });
      if (response.ok) {
        loadGameDetails(selectedGame._id);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function getNextOccurrence(rb: any) {
    if (!rb.active || rb.softDeleted) return null;
    
    const DAYS_OF_WEEK = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const now = new Date();
    
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date();
      checkDate.setDate(now.getDate() + i);
      
      if (rb.startDate && checkDate < new Date(rb.startDate)) continue;
      if (rb.endDate && checkDate > new Date(rb.endDate)) break;
      
      const dayName = DAYS_OF_WEEK[checkDate.getDay()];
      if (rb.daysOfWeek.includes(dayName)) {
        const [sh, sm] = rb.startTime.split(":").map(Number);
        const [eh, em] = rb.endTime.split(":").map(Number);
        
        const occurrenceStart = new Date(checkDate);
        occurrenceStart.setHours(sh, sm, 0, 0);
        
        const occurrenceEnd = new Date(checkDate);
        occurrenceEnd.setHours(eh, em, 0, 0);
        if (eh < sh || (eh === sh && em < sm)) {
          occurrenceEnd.setDate(occurrenceEnd.getDate() + 1);
        }
        
        if (occurrenceEnd > now) {
          return { start: occurrenceStart, end: occurrenceEnd };
        }
      }
    }
    return null;
  }

  async function toggleCourtPermanent(courtId: string, isCurrentlyDisabled: boolean, overrideMode?: "KEEP" | "OVERRIDE") {
    if (!selectedGame) return;

    const actionText = isCurrentlyDisabled ? "enable" : "permanently disable";
    if (!overrideMode) {
      const confirmed = window.confirm(`Are you sure you want to ${actionText} this court?`);
      if (!confirmed) return;
    }

    const response = await fetch(`/api/admin/courts/${courtId}/disable`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ disabled: !isCurrentlyDisabled, overrideMode }),
    });

    const data = await safeJson(response);

    if (response.ok && data?.hasBookings) {
      const choice = window.confirm(
        `${data.message}\n\nClick OK to Keep existing bookings and disable court only for new bookings (Option A).\nClick Cancel to Override existing bookings and mark them as Reschedule Required (Option B).`
      );
      if (choice) {
        await toggleCourtPermanent(courtId, isCurrentlyDisabled, "KEEP");
      } else {
        await toggleCourtPermanent(courtId, isCurrentlyDisabled, "OVERRIDE");
      }
      return;
    }

    if (!response.ok) {
      setMessage(data?.message || `Failed to ${actionText} court`);
      return;
    }

    setMessage(`Court ${isCurrentlyDisabled ? "enabled" : "disabled permanently"}`);
    loadGameDetails(selectedGame._id);
  }

  async function cancelCourtBlock(blockId: string) {
    if (!selectedGame) return;

    const confirmed = window.confirm("Cancel this scheduled court block?");
    if (!confirmed) return;

    const response = await fetch(`/api/admin/court-blocks/${blockId}`, {
      method: "DELETE",
    });

    const data = await safeJson(response);

    if (!response.ok) {
      setMessage(data?.message || "Failed to cancel scheduled block");
      return;
    }

    setMessage("Scheduled block cancelled successfully");
    loadGameDetails(selectedGame._id);
  }

  async function deleteCourt(courtId: string) {
    if (!selectedGame) return;

    const confirmed = window.confirm("Delete this court/code permanently?");
    if (!confirmed) return;

    const response = await fetch(`/api/admin/courts/${courtId}`, {
      method: "DELETE",
    });

    const data = await safeJson(response);

    if (!response.ok) {
      setMessage(data?.message || "Failed to delete court");
      return;
    }

    setMessage("Court deleted");
    loadGameDetails(selectedGame._id);
  }

  async function createPricingRule(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedGame) return;

    const response = await fetch(
      `/api/admin/games/${selectedGame._id}/pricing-rules`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pricingForm),
      }
    );

    const data = await safeJson(response);

    if (!response.ok) {
      setMessage(data?.message || "Failed to create pricing rule");
      return;
    }

    setMessage("Pricing rule created");
    loadGameDetails(selectedGame._id);
  }

  async function updatePricingRule(ruleId: string, closeAfterSave = true) {
  if (!selectedGame) return false;

  setPricingErrors({});

  const response = await fetch(`/api/admin/pricing-rules/${ruleId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(editingRule),
  });

  const data = await safeJson(response);

  if (!response.ok) {
    setPricingErrors(getApiErrors(data));
    return false;
  }

  setLastSavedRuleId(ruleId);

  if (closeAfterSave) {
    setEditingRuleId("");
  }

  await loadGameDetails(selectedGame._id);
  return true;
}

  async function deleteRule(ruleId: string) {
    if (!selectedGame) return;

    const confirmed = window.confirm("Delete this pricing rule?");
    if (!confirmed) return;

    const response = await fetch(`/api/admin/pricing-rules/${ruleId}`, {
      method: "DELETE",
    });

    const data = await safeJson(response);

    if (!response.ok) {
      setMessage(data?.message || "Failed to delete pricing rule");
      return;
    }

    setMessage("Pricing rule deleted");
    loadGameDetails(selectedGame._id);
  }

  useEffect(() => {
    loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
  if (!editingRuleId || !selectedGame) return;

  const timer = setTimeout(async () => {
    setAutoSavingRuleId(editingRuleId);

    await updatePricingRule(
      editingRuleId,
      false
    );

    setAutoSavingRuleId("");
  }, 700);

  return () => clearTimeout(timer);
}, [editingRule]);

  return (
    <section className="min-w-0">
      <h1 className="text-5xl font-black text-[var(--primary)]">Games</h1>

      <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
        Manage games, courts, buffer time, session duration and sports pricing.
      </p>

      {message && (
        <p className="mt-4 rounded-2xl border border-white/60 bg-white/70 p-3 text-sm font-black text-[var(--primary)] shadow-sm backdrop-blur-2xl">
          {message}
        </p>
      )}

      <section className="mt-8 grid gap-8">
        <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <form onSubmit={createGame} className={cardClass}>
            <div className="flex items-center gap-2">
              <Gamepad2 size={24} className="text-[#D7E528]" />
              <h2 className="text-2xl font-black text-[var(--primary)]">
                Add Game
              </h2>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-1">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                  Game Name
                </span>
                <input
                  value={gameForm.name}
                  onChange={(event) =>
                    setGameForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className={fieldClass}
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                    Min Duration
                  </span>
                  <input
                    type="number"
                    value={gameForm.duration}
                    onChange={(event) =>
                      setGameForm((prev) => ({
                        ...prev,
                        duration: Number(event.target.value),
                      }))
                    }
                    className={fieldClass}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                    Max Duration
                  </span>
                  <input
                    type="number"
                    value={gameForm.maximumDuration}
                    onChange={(event) =>
                      setGameForm((prev) => ({
                        ...prev,
                        maximumDuration: Number(event.target.value),
                      }))
                    }
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                  Buffer Minutes
                </span>
                <input
                  type="number"
                  value={gameForm.bufferMinutes}
                  onChange={(event) =>
                    setGameForm((prev) => ({
                      ...prev,
                      bufferMinutes: Number(event.target.value),
                    }))
                  }
                  className={fieldClass}
                />
              </label>

              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={gameForm.fixedSlotBooking}
                  onChange={(event) =>
                    setGameForm((prev) => ({
                      ...prev,
                      fixedSlotBooking: event.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)] h-4 w-4"
                />
                <span className="text-xs font-black uppercase text-[var(--text-muted)] select-none">
                  Enable Fixed Slot Booking
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={gameForm.allowCourtSelection}
                  onChange={(event) =>
                    setGameForm((prev) => ({
                      ...prev,
                      allowCourtSelection: event.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)] h-4 w-4"
                />
                <span className="text-xs font-black uppercase text-[var(--text-muted)] select-none">
                  Allow Court Selection
                </span>
              </label>

              <button className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] text-sm font-black text-white">
                <Plus size={18} className="text-[#D7E528]" />
                Create Game
              </button>
            </div>
          </form>

          {selectedGame ? (
            <form onSubmit={updateSelectedGame} className={cardClass}>
              <h2 className="text-2xl font-black text-[var(--primary)]">
                Edit Selected Game
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <label className="grid gap-1 md:col-span-2 xl:col-span-2">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                    Game Name
                  </span>
                  <input
                    value={editGame.name}
                    onChange={(event) =>
                      setEditGame((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                    Status
                  </span>
                  <select
                    value={editGame.active ? "active" : "disabled"}
                    onChange={(event) =>
                      setEditGame((prev) => ({
                        ...prev,
                        active: event.target.value === "active",
                      }))
                    }
                    className={fieldClass}
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                    Min Duration
                  </span>
                  <input
                    type="number"
                    value={editGame.duration}
                    onChange={(event) =>
                      setEditGame((prev) => ({
                        ...prev,
                        duration: Number(event.target.value),
                      }))
                    }
                    className={fieldClass}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                    Max Duration
                  </span>
                  <input
                    type="number"
                    value={editGame.maximumDuration}
                    onChange={(event) =>
                      setEditGame((prev) => ({
                        ...prev,
                        maximumDuration: Number(event.target.value),
                      }))
                    }
                    className={fieldClass}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                    Buffer
                  </span>
                  <input
                    type="number"
                    value={editGame.bufferMinutes}
                    onChange={(event) =>
                      setEditGame((prev) => ({
                        ...prev,
                        bufferMinutes: Number(event.target.value),
                      }))
                    }
                    className={fieldClass}
                  />
                </label>

                <label className="flex items-center gap-2 cursor-pointer mt-1 md:col-span-2 xl:col-span-6">
                  <input
                    type="checkbox"
                    checked={editGame.fixedSlotBooking}
                    onChange={(event) =>
                      setEditGame((prev) => ({
                        ...prev,
                        fixedSlotBooking: event.target.checked,
                      }))
                    }
                    className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)] h-4 w-4"
                  />
                  <span className="text-xs font-black uppercase text-[var(--text-muted)] select-none">
                    Enable Fixed Slot Booking
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer mt-1 md:col-span-2 xl:col-span-6">
                  <input
                    type="checkbox"
                    checked={editGame.allowCourtSelection}
                    onChange={(event) =>
                      setEditGame((prev) => ({
                        ...prev,
                        allowCourtSelection: event.target.checked,
                      }))
                    }
                    className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)] h-4 w-4"
                  />
                  <span className="text-xs font-black uppercase text-[var(--text-muted)] select-none">
                    Allow Court Selection
                  </span>
                </label>

                <div className="md:col-span-2 xl:col-span-6 border-t pt-4 mt-2">
                  <h4 className="text-xs font-black uppercase text-[var(--primary)] mb-2">
                    Shared Court Dependency
                  </h4>
                  <p className="text-[10px] text-[var(--text-muted)] mb-3">
                    Select games that share the same physical court space. When this game is booked, the selected games will be automatically blocked.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto bg-[#EDEBE2] p-3 rounded-xl">
                    {games
                      .filter((g) => g._id !== selectedGame._id)
                      .map((g) => {
                        const isChecked = editGame.blockedGameIds?.includes(g._id) || false;
                        return (
                          <label key={g._id} className="flex items-center gap-2 cursor-pointer p-1">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setEditGame((prev) => {
                                  const list = prev.blockedGameIds || [];
                                  const updated = checked
                                    ? [...list, g._id]
                                    : list.filter((id) => id !== g._id);
                                  return { ...prev, blockedGameIds: updated };
                                });
                              }}
                              className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)] h-4 w-4"
                            />
                            <span className="text-xs font-bold text-[var(--primary)] select-none">
                              {g.name}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                <button className="h-12 rounded-2xl bg-[var(--primary)] text-sm font-black text-white md:col-span-2 xl:col-span-6">
                  Save Game Changes
                </button>
              </div>
            </form>
          ) : (
            <section className={`${cardClass} flex min-h-[280px] flex-col items-center justify-center text-center`}>
              <Gamepad2 size={52} className="text-[#D7E528]" />
              <h2 className="mt-4 text-2xl font-black text-[var(--primary)]">
                No Game Selected
              </h2>
              <p className="mt-2 max-w-sm text-sm font-bold text-[var(--text-muted)]">
                Create or select a game to manage courts and pricing.
              </p>
            </section>
          )}
        </section>

        {selectedGame && (
          <section className={cardClass}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-2">
                <Layers size={24} className="text-[#D7E528]" />
                <h2 className="text-2xl font-black text-[var(--primary)]">
                  Courts / Codes
                </h2>
              </div>

              <form
                onSubmit={createCourt}
                className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_120px] xl:max-w-xl"
              >
                <input
                  required
                  placeholder="e.g. Court A"
                  value={courtName}
                  onChange={(event) => setCourtName(event.target.value)}
                  className={fieldClass}
                />

                <button className="h-12 rounded-2xl bg-[var(--primary)] text-sm font-black text-white">
                  Add
                </button>
              </form>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {courts.map((court) => {
                const now = new Date();
                const isCurrentlyBlocked = court.blocks && court.blocks.some((b: any) => {
                  const start = new Date(b.blockedFrom);
                  const end = new Date(b.blockedTo);
                  return now >= start && now <= end;
                });
                
                const statusText = court.disabled 
                  ? "Permanently Disabled" 
                  : isCurrentlyBlocked 
                    ? "Temporarily Blocked" 
                    : "Active";

                const statusColor = court.disabled
                  ? "bg-rose-100 text-rose-800"
                  : isCurrentlyBlocked
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800";

                return (
                  <article
                    key={court._id}
                    className={`rounded-[1.5rem] p-5 ring-1 ring-black/5 flex flex-col justify-between ${
                      court.disabled ? "bg-gray-100/80 text-gray-500" : "bg-white"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-base font-black text-[var(--primary)]">
                          {court.name}
                        </h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusColor}`}>
                          {statusText}
                        </span>
                      </div>

                      {court.blocks && court.blocks.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-black/5 pt-3">
                          <p className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">Scheduled Blocks:</p>
                          <div className="max-h-[150px] overflow-y-auto space-y-1.5 pr-1">
                            {court.blocks.map((block: any) => (
                              <div key={block._id} className="flex items-center justify-between bg-amber-50 p-2 rounded-xl border border-amber-100 text-[11px] text-amber-900">
                                <div className="space-y-0.5">
                                  <p className="font-bold">
                                    {new Date(block.blockedFrom).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}{" "}
                                    {new Date(block.blockedFrom).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false })}{" - "}
                                    {new Date(block.blockedTo).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false })}
                                  </p>
                                  {block.reason && <p className="text-amber-700 font-medium italic">Reason: {block.reason}</p>}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => cancelCourtBlock(block._id)}
                                  className="text-[10px] font-black text-rose-600 hover:text-rose-700 active:scale-95 transition-all ml-2"
                                >
                                  Cancel
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Recurring Blocks List */}
                      {recurringBlocks.filter((rb) => (rb.courtId._id || rb.courtId) === court._id).length > 0 && (
                        <div className="mt-4 border-t border-black/5 pt-3 space-y-2">
                          <p className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">Recurring Blocks:</p>
                          <div className="grid gap-2 max-h-36 overflow-y-auto">
                            {recurringBlocks
                              .filter((rb) => (rb.courtId._id || rb.courtId) === court._id)
                              .map((rb: any) => {
                                const nextOcc = getNextOccurrence(rb);
                                const nextStr = nextOcc
                                  ? `${new Date(nextOcc.start).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}, ${rb.startTime}–${rb.endTime}`
                                  : "None scheduled";
                                return (
                                  <div key={rb._id} className={`flex items-center justify-between p-2.5 rounded-xl border text-[11px] font-bold ${rb.active ? "bg-indigo-50 border-indigo-100 text-indigo-900" : "bg-gray-50 border-gray-150 text-gray-400"}`}>
                                    <div className="space-y-0.5">
                                      <p className="font-black text-gray-800">
                                        {rb.daysOfWeek.join(", ")} | {rb.startTime}–{rb.endTime}
                                      </p>
                                      {rb.reason && <p className="text-gray-500 italic">Reason: {rb.reason}</p>}
                                      <p className="text-[9px] text-gray-450">
                                        Next block: <span className="font-black text-gray-600">{nextStr}</span>
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-2">
                                      <button
                                        type="button"
                                        onClick={() => toggleRecurringBlockActive(rb)}
                                        className="text-[10px] font-black text-blue-600 hover:text-blue-800 transition"
                                      >
                                        {rb.active ? "Pause" : "Resume"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => startEditRecurring(rb, court.name)}
                                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteRecurringBlock(rb._id)}
                                        className="text-[10px] font-black text-rose-600 hover:text-rose-700 transition"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2 border-t border-black/5 pt-4 justify-between items-center">
                      <button
                        type="button"
                        onClick={() => deleteCourt(court._id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-700 active:scale-95 transition-all"
                        title="Delete Permanently"
                      >
                        <Trash2 size={15} />
                      </button>

                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => toggleCourtPermanent(court._id, !!court.disabled)}
                          className={`h-9 px-3.5 rounded-full text-[11px] font-black active:scale-95 transition-all ${
                            court.disabled
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "bg-rose-600 text-white hover:bg-rose-700"
                          }`}
                        >
                          {court.disabled ? "Enable Court" : "Disable Permanently"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setCourtBlockModal({
                              courtId: court._id,
                              courtName: court.name,
                            })
                          }
                          className="h-9 px-3.5 rounded-full bg-gray-100 text-[11px] font-black text-[var(--primary)] hover:bg-gray-200 active:scale-95 transition-all"
                        >
                          Schedule Block
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRecurringModal({
                              courtId: court._id,
                              courtName: court.name,
                            });
                            setRecurringForm({
                              _id: "",
                              startTime: "18:00",
                              endTime: "20:00",
                              daysOfWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
                              startDate: "",
                              endDate: "",
                              reason: "",
                              active: true,
                            });
                            setRecurringConflictData(null);
                          }}
                          className="h-9 px-3.5 rounded-full bg-indigo-50 text-[11px] font-black text-indigo-700 hover:bg-indigo-100 active:scale-95 transition-all"
                        >
                          Schedule Recurring Block
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}

              {courts.length === 0 && (
                <p className="text-sm font-bold text-[var(--text-muted)]">
                  No courts created.
                </p>
              )}
            </div>
          </section>
        )}

        <section className={cardClass}>
          <h2 className="text-2xl font-black text-[var(--primary)]">
            Game List
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-[var(--text-muted)]">
                  <th className="py-3">Game</th>
                  <th>Status</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Buffer</th>
                </tr>
              </thead>

              <tbody>
                {games.map((game) => (
                  <tr
                    key={game._id}
                    onClick={() => selectGame(game)}
                    className={`cursor-pointer border-b border-black/5 transition ${
                      selectedGame?._id === game._id
                        ? "bg-[#D7E528]/30"
                        : "hover:bg-white/45"
                    }`}
                  >
                    <td className="py-3 font-black text-[var(--primary)]">
                      {game.name}
                    </td>
                    <td>{game.active ? "Active" : "Disabled"}</td>
                    <td>{game.duration}</td>
                    <td>{game.maximumDuration}</td>
                    <td>{game.bufferMinutes || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {games.length === 0 && (
              <p className="mt-4 text-sm font-bold text-[var(--text-muted)]">
                No games created.
              </p>
            )}
          </div>
        </section>

        {selectedGame && (
          <section className={cardClass}>
            <div className="flex items-center gap-2">
              <Coins size={24} className="text-[#D7E528]" />
              <h2 className="text-2xl font-black text-[var(--primary)]">
                Pricing Rules
              </h2>
            </div>

            <p className="mt-2 text-xs font-bold text-[var(--text-muted)]">
              Duration must be between {selectedGame.duration} and{" "}
              {selectedGame.maximumDuration} minutes, and must be a multiple of{" "}
              {selectedGame.duration}.
            </p>

            <form
              onSubmit={createPricingRule}
              className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6"
            >
              <input
                type="number"
                value={pricingForm.minPlayers}
                onChange={(event) =>
                  setPricingForm((prev) => ({
                    ...prev,
                    minPlayers: Number(event.target.value),
                  }))
                }
                className={fieldClass}
                placeholder="Min Players"
              />

              <input
                type="number"
                value={pricingForm.maxPlayers}
                onChange={(event) =>
                  setPricingForm((prev) => ({
                    ...prev,
                    maxPlayers: Number(event.target.value),
                  }))
                }
                className={fieldClass}
                placeholder="Max Players"
              />

              <input
                type="number"
                value={pricingForm.durationMinutes}
                onChange={(event) =>
                  setPricingForm((prev) => ({
                    ...prev,
                    durationMinutes: Number(event.target.value),
                  }))
                }
                className={fieldClass}
                placeholder="Duration Minutes"
              />

              <select
                value={pricingForm.mode}
                onChange={(event) =>
                  setPricingForm((prev) => ({
                    ...prev,
                    mode: event.target.value as PricingRule["mode"],
                  }))
                }
                className={fieldClass}
              >
                <option value="PER_PLAYER">Per Player</option>
                <option value="COURT_BASE_PLUS_PLAYER">
                  Court Base + Player
                </option>
              </select>

              <input
                type="number"
                value={pricingForm.baseCourtPrice}
                onChange={(event) =>
                  setPricingForm((prev) => ({
                    ...prev,
                    baseCourtPrice: Number(event.target.value),
                  }))
                }
                className={fieldClass}
                placeholder="Base"
              />

              <input
                type="number"
                value={pricingForm.pricePerPlayer}
                onChange={(event) =>
                  setPricingForm((prev) => ({
                    ...prev,
                    pricePerPlayer: Number(event.target.value),
                  }))
                }
                className={fieldClass}
                placeholder="Per Player"
              />

              <button className="h-12 rounded-2xl bg-[var(--primary)] text-sm font-black text-white md:col-span-2 xl:col-span-6">
                Add Pricing Rule
              </button>
            </form>

            <div className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {rules.map((rule) => {
                const isEditing = editingRuleId === rule._id;

                return (
                  <article
                    key={rule._id}
                    className="rounded-[1.5rem] bg-white/50 p-4 ring-1 ring-black/5"
                  >
                    {isEditing ? (
                      <div className="grid gap-3">
  <div className="grid gap-2 sm:grid-cols-3">
    <div>
      <input
        type="number"
        value={editingRule.minPlayers ?? 1}
        onChange={(event) =>
          setEditingRule((prev) => ({
            ...prev,
            minPlayers: Number(event.target.value),
          }))
        }
        className={`${fieldClass} ${getPricingErrorClass("minPlayers")}`}
      />
      {pricingErrors.minPlayers && (
        <p className="mt-1 text-xs font-black text-red-500">
          {pricingErrors.minPlayers}
        </p>
      )}
    </div>

    <div>
      <input
        type="number"
        value={editingRule.maxPlayers ?? 1}
        onChange={(event) =>
          setEditingRule((prev) => ({
            ...prev,
            maxPlayers: Number(event.target.value),
          }))
        }
        className={`${fieldClass} ${getPricingErrorClass("maxPlayers")}`}
      />
      {pricingErrors.maxPlayers && (
        <p className="mt-1 text-xs font-black text-red-500">
          {pricingErrors.maxPlayers}
        </p>
      )}
    </div>

    <div>
      <input
        type="number"
        value={editingRule.durationMinutes ?? selectedGame.duration}
        onChange={(event) =>
          setEditingRule((prev) => ({
            ...prev,
            durationMinutes: Number(event.target.value),
          }))
        }
        className={`${fieldClass} ${getPricingErrorClass("durationMinutes")}`}
      />
      {pricingErrors.durationMinutes && (
        <p className="mt-1 text-xs font-black text-red-500">
          {pricingErrors.durationMinutes}
        </p>
      )}
    </div>
  </div>

  <div>
    <select
      value={editingRule.mode}
      onChange={(event) =>
        setEditingRule((prev) => ({
          ...prev,
          mode: event.target.value as PricingRule["mode"],
        }))
      }
      className={`${fieldClass} ${getPricingErrorClass("mode")}`}
    >
      <option value="PER_PLAYER">Per Player</option>
      <option value="COURT_BASE_PLUS_PLAYER">Court + Player</option>
    </select>

    {pricingErrors.mode && (
      <p className="mt-1 text-xs font-black text-red-500">
        {pricingErrors.mode}
      </p>
    )}
  </div>

  <div className="grid gap-2 sm:grid-cols-2">
    <div>
      <input
        type="number"
        value={editingRule.baseCourtPrice ?? 0}
        onChange={(event) =>
          setEditingRule((prev) => ({
            ...prev,
            baseCourtPrice: Number(event.target.value),
          }))
        }
        className={`${fieldClass} ${getPricingErrorClass("baseCourtPrice")}`}
      />
      {pricingErrors.baseCourtPrice && (
        <p className="mt-1 text-xs font-black text-red-500">
          {pricingErrors.baseCourtPrice}
        </p>
      )}
    </div>

    <div>
      <input
        type="number"
        value={editingRule.pricePerPlayer ?? 0}
        onChange={(event) =>
          setEditingRule((prev) => ({
            ...prev,
            pricePerPlayer: Number(event.target.value),
          }))
        }
        className={`${fieldClass} ${getPricingErrorClass("pricePerPlayer")}`}
      />
      {pricingErrors.pricePerPlayer && (
        <p className="mt-1 text-xs font-black text-red-500">
          {pricingErrors.pricePerPlayer}
        </p>
      )}
    </div>
  </div>

  {/* CHANGE 8 GOES HERE */}
  <div className="min-h-5">
    {autoSavingRuleId === rule._id && (
      <p className="text-xs font-black text-[var(--text-muted)]">
        Auto-saving...
      </p>
    )}

    {lastSavedRuleId === rule._id && autoSavingRuleId !== rule._id && (
      <p className="text-xs font-black text-green-600">Saved</p>
    )}

    {pricingErrors.general && (
      <p className="text-xs font-black text-red-500">
        {pricingErrors.general}
      </p>
    )}
  </div>

  <div className="flex justify-end gap-2">
    <button
      type="button"
      onClick={() => updatePricingRule(rule._id, true)}
      className="flex h-10 items-center gap-1 rounded-full bg-[var(--primary)] px-4 text-xs font-black text-white"
    >
      <Check size={14} />
      Save
    </button>

    <button
      type="button"
      onClick={() => {
        setPricingErrors({});
        setEditingRuleId("");
      }}
      className="flex h-10 items-center gap-1 rounded-full bg-gray-200 px-4 text-xs font-black text-[var(--primary)]"
    >
      <X size={14} />
      Cancel
    </button>
  </div>
</div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="flex items-center gap-2 text-lg font-black text-[var(--primary)]">
                            <Users size={18} />
                            {rule.minPlayers}-{rule.maxPlayers} Players
                          </h3>

                          <span className="rounded-full bg-[#D7E528]/50 px-3 py-1 text-xs font-black text-[var(--primary)]">
                            {rule.durationMinutes ?? selectedGame.duration} min
                          </span>
                        </div>

                        <p className="mt-2 text-xs font-black uppercase text-[var(--text-muted)]">
                          {rule.mode === "PER_PLAYER"
                            ? "Per Player"
                            : "Court Base + Player"}
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-3 border-y border-black/5 py-4">
                          <div>
                            <p className="text-xs font-black uppercase text-[var(--text-muted)]">
                              Base
                            </p>
                            <p className="text-xl font-black text-[var(--primary)]">
                              ₹{rule.baseCourtPrice}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-black uppercase text-[var(--text-muted)]">
                              Per Player
                            </p>
                            <p className="text-xl font-black text-[var(--primary)]">
                              ₹{rule.pricePerPlayer}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRuleId(rule._id);
                              setEditingRule({
  minPlayers: rule.minPlayers ?? 1,
  maxPlayers: rule.maxPlayers ?? 2,
  durationMinutes:
    rule.durationMinutes ??
    selectedGame?.duration ??
    60,
  mode: rule.mode ?? "PER_PLAYER",
  baseCourtPrice: rule.baseCourtPrice ?? 0,
  pricePerPlayer: rule.pricePerPlayer ?? 100,
});
                            }}
                            className="flex h-10 items-center gap-1 rounded-full bg-white px-4 text-xs font-black text-[var(--primary)] ring-1 ring-black/10"
                          >
                            <Edit2 size={14} />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteRule(rule._id)}
                            className="flex h-10 items-center gap-1 rounded-full bg-red-50 px-4 text-xs font-black text-[#F6401E]"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}

              {rules.length === 0 && (
                <p className="text-sm font-bold text-[var(--text-muted)]">
                  No pricing rules created.
                </p>
              )}
            </div>
          </section>
        )}
      </section>

      {courtBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <section className="w-full max-w-md rounded-[2rem] border border-white/60 bg-white/75 p-5 shadow-xl backdrop-blur-2xl">
            <div className="flex items-center gap-2">
              <CalendarClock size={24} className="text-[#D7E528]" />
              <h2 className="text-2xl font-black text-[var(--primary)]">
                Disable {courtBlockModal.courtName}
              </h2>
            </div>

            <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
              Select block start/end date-time. Reason is optional.
            </p>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-1">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                  Start Date & Time
                </span>
                <input
                  type="datetime-local"
                  value={courtBlockForm.blockedFrom}
                  onChange={(event) =>
                    setCourtBlockForm((prev) => ({
                      ...prev,
                      blockedFrom: event.target.value,
                    }))
                  }
                  className={fieldClass}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                  End Date & Time
                </span>
                <input
                  type="datetime-local"
                  value={courtBlockForm.blockedTo}
                  onChange={(event) =>
                    setCourtBlockForm((prev) => ({
                      ...prev,
                      blockedTo: event.target.value,
                    }))
                  }
                  className={fieldClass}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                  Reason Optional
                </span>
                <textarea
                  value={courtBlockForm.reason}
                  onChange={(event) =>
                    setCourtBlockForm((prev) => ({
                      ...prev,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="Maintenance, cleaning, repair..."
                  className="min-h-28 resize-none rounded-2xl border border-black/5 bg-white/75 px-4 py-3 font-bold outline-none shadow-inner"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCourtBlockModal(null)}
                  className="h-12 rounded-2xl bg-white/70 text-sm font-black text-[var(--primary)]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => blockCourt()}
                  className="h-12 rounded-2xl bg-[var(--primary)] text-sm font-black text-white"
                >
                  Disable Court
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {recurringModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <section className="w-full max-w-lg rounded-[2rem] border border-white/60 bg-white p-6 shadow-xl backdrop-blur-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center gap-2">
              <CalendarClock size={24} className="text-indigo-650 text-indigo-600" />
              <h2 className="text-2xl font-black text-[var(--primary)]">
                {recurringConflictData
                  ? "Booking Conflict Detected"
                  : recurringForm._id
                  ? `Edit Recurring Block`
                  : `Schedule Recurring Block`}
              </h2>
            </div>
            <p className="text-xs font-bold text-gray-500 mt-1">Court: {recurringModal.courtName}</p>

            {recurringConflictData ? (
              <div className="mt-5 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs font-bold text-amber-900">
                  <p className="font-black text-sm mb-2 text-amber-950">⚠️ {recurringConflictData.message}</p>
                  <p className="mb-3 font-medium">Please choose how you would like to handle these existing conflicts:</p>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 max-h-32 overflow-y-auto bg-white p-2 rounded-lg border">
                    {recurringConflictData.conflicts.map((c, idx) => (
                      <li key={idx}>
                        {new Date(c.startTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} ({c.playersCount} players)
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => submitRecurringBlock("KEEP")}
                    className="h-12 w-full rounded-2xl bg-white border border-gray-300 text-xs font-black text-gray-700 hover:bg-gray-50 transition"
                  >
                    Keep existing bookings and block only future availability
                  </button>
                  <button
                    type="button"
                    onClick={() => submitRecurringBlock("RESCHEDULE")}
                    className="h-12 w-full rounded-2xl bg-amber-600 text-xs font-black text-white hover:bg-amber-700 transition"
                  >
                    Mark affected bookings for rescheduling
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecurringConflictData(null)}
                    className="h-12 w-full rounded-2xl bg-gray-200 text-xs font-black text-gray-700 hover:bg-gray-300 transition"
                  >
                    Cancel block creation
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase text-[var(--text-muted)]">Start Time</span>
                    <input
                      type="time"
                      required
                      value={recurringForm.startTime}
                      onChange={(e) => setRecurringForm(prev => ({ ...prev, startTime: e.target.value }))}
                      className={fieldClass}
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                      End Time {recurringForm.endTime && recurringForm.startTime && recurringForm.endTime < recurringForm.startTime ? " (+1 day)" : ""}
                    </span>
                    <input
                      type="time"
                      required
                      value={recurringForm.endTime}
                      onChange={(e) => setRecurringForm(prev => ({ ...prev, endTime: e.target.value }))}
                      className={fieldClass}
                    />
                  </label>
                </div>

                <div className="grid gap-1">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)]">Applicable Days</span>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const allDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
                        const isAllSelected = recurringForm.daysOfWeek.length === 7;
                        setRecurringForm(prev => ({
                          ...prev,
                          daysOfWeek: isAllSelected ? [] : allDays
                        }));
                      }}
                      className="px-3 h-8 text-[11px] rounded-lg font-black border bg-white hover:bg-gray-50 text-gray-700 active:scale-95 transition"
                    >
                      {recurringForm.daysOfWeek.length === 7 ? "Deselect All" : "Every Day"}
                    </button>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map((day) => {
                      const isSelected = recurringForm.daysOfWeek.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setRecurringForm(prev => {
                              const alreadySelected = prev.daysOfWeek.includes(day);
                              return {
                                ...prev,
                                daysOfWeek: alreadySelected
                                  ? prev.daysOfWeek.filter((d) => d !== day)
                                  : [...prev.daysOfWeek, day]
                              };
                            });
                          }}
                          className={`h-9 text-[9px] rounded-xl font-black border transition ${
                            isSelected
                              ? "bg-indigo-650 text-white border-indigo-650 bg-indigo-600 border-indigo-600"
                              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {day.substring(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase text-[var(--text-muted)]">Start Date (Optional)</span>
                    <input
                      type="date"
                      value={recurringForm.startDate}
                      onChange={(e) => setRecurringForm(prev => ({ ...prev, startDate: e.target.value }))}
                      className={fieldClass}
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase text-[var(--text-muted)]">End Date (Optional)</span>
                    <input
                      type="date"
                      value={recurringForm.endDate}
                      onChange={(e) => setRecurringForm(prev => ({ ...prev, endDate: e.target.value }))}
                      className={fieldClass}
                    />
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase text-[var(--text-muted)]">Reason (Optional)</span>
                  <textarea
                    value={recurringForm.reason}
                    onChange={(e) => setRecurringForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="e.g. Coaching, Training, Maintenance..."
                    className="min-h-20 resize-none rounded-2xl border border-black/5 bg-white px-4 py-3 font-bold outline-none shadow-inner text-xs"
                  />
                </label>

                <label className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={recurringForm.active}
                    onChange={(e) => setRecurringForm(prev => ({ ...prev, active: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 h-4.5 w-4.5"
                  />
                  <span className="text-xs font-black uppercase text-gray-600 select-none">Active Block Status</span>
                </label>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setRecurringModal(null)}
                    className="h-12 rounded-2xl bg-white border text-sm font-black text-[var(--primary)] hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={!recurringForm.startTime || !recurringForm.endTime || recurringForm.daysOfWeek.length === 0}
                    onClick={() => submitRecurringBlock()}
                    className="h-12 rounded-2xl bg-indigo-600 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {recurringForm._id ? "Save Changes" : "Schedule Block"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}