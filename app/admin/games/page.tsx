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
  active: boolean;
};

type Court = {
  _id: string;
  name: string;
  active: boolean;
  disabled: boolean;
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
  });

  const [editGame, setEditGame] = useState({
    name: "",
    duration: 60,
    maximumDuration: 180,
    bufferMinutes: 10,
    active: true,
  });

  const [courtName, setCourtName] = useState("");

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
    const [courtsRes, rulesRes] = await Promise.all([
      fetch(`/api/admin/games/${gameId}/courts`, { cache: "no-store" }),
      fetch(`/api/admin/games/${gameId}/pricing-rules`, {
        cache: "no-store",
      }),
    ]);

    const courtsData = await safeJson(courtsRes);
    const rulesData = await safeJson(rulesRes);

    setCourts(courtsData?.courts || []);
    setRules(rulesData?.rules || []);
  }

  function selectGame(game: Game) {
    setSelectedGame(game);

    setEditGame({
      name: game.name,
      duration: game.duration,
      maximumDuration: game.maximumDuration,
      bufferMinutes: game.bufferMinutes || 0,
      active: game.active,
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

  async function blockCourt() {
    if (!selectedGame || !courtBlockModal) return;

    const response = await fetch(
      `/api/admin/courts/${courtBlockModal.courtId}/block`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(courtBlockForm),
      }
    );

    const data = await safeJson(response);

    if (!response.ok) {
      setMessage(data?.message || "Failed to disable court");
      return;
    }

    setMessage(data?.message || "Court disabled");

    setCourtBlockModal(null);
    setCourtBlockForm({
      blockedFrom: "",
      blockedTo: "",
      reason: "",
    });

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

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {courts.map((court) => (
                <article
                  key={court._id}
                  className={`rounded-[1.5rem] p-4 ring-1 ring-black/5 ${
                    court.disabled
                      ? "bg-gray-100/80 text-gray-500"
                      : "bg-white/50"
                  }`}
                >
                  <h3 className="text-lg font-black text-[var(--primary)]">
                    {court.name}
                  </h3>

                  <p className="mt-1 text-xs font-black uppercase text-[var(--text-muted)]">
                    {court.disabled ? "Disabled" : "Active"}
                  </p>

                  <div className="mt-5 flex justify-end gap-2 border-t border-black/5 pt-4">
                    <button
                      type="button"
                      onClick={() => deleteCourt(court._id)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6401E] text-white"
                    >
                      <Trash2 size={16} />
                    </button>

                    <button
                      type="button"
                      disabled={court.disabled}
                      onClick={() =>
                        setCourtBlockModal({
                          courtId: court._id,
                          courtName: court.name,
                        })
                      }
                      className="flex h-10 items-center gap-1 rounded-full bg-gray-200 px-4 text-xs font-black text-[var(--primary)] disabled:opacity-50"
                    >
                      <ShieldAlert size={14} />
                      {court.disabled ? "Disabled" : "Disable"}
                    </button>
                  </div>
                </article>
              ))}

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
                  onClick={blockCourt}
                  className="h-12 rounded-2xl bg-[var(--primary)] text-sm font-black text-white"
                >
                  Disable Court
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}