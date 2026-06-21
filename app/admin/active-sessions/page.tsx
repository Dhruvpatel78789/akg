"use client";

import { useEffect, useState } from "react";
import { Clock, Play, AlertCircle, ShieldAlert, RefreshCw } from "lucide-react";
import { formatToISTDate, formatToISTTime } from "@/lib/time";

function formatTime24(value?: string | Date) {
  return formatToISTTime(value);
}

function getEndSuffix(startTime?: string | Date, endTime?: string | Date) {
  if (!startTime || !endTime) return "";
  const sDateStr = formatToISTDate(startTime);
  const eDateStr = formatToISTDate(endTime);
  if (!sDateStr || !eDateStr) return "";
  const s = new Date(sDateStr + "T00:00:00Z");
  const e = new Date(eDateStr + "T00:00:00Z");
  const diffDays = Math.round((e.getTime() - s.getTime()) / (24 * 3600 * 1000));
  if (diffDays > 0) {
    return ` (+${diffDays} day${diffDays > 1 ? 's' : ''})`;
  }
  return "";
}

type ActiveSession = {
  _id: string;
  userId?: {
    name?: string;
    phone?: string;
    email?: string;
    role?: string;
  };
  gameName?: string;
  court?: string;
  startTime: string;
  endTime: string;
  playersCount: number;
  price?: number;
  coinCost?: number;
  playerType?: "MEMBER" | "VISITOR" | "COMPANY";
  companyId?: {
    _id: string;
    name: string;
    colorCode?: string;
  };
  companyEmployeeId?: {
    _id: string;
    name: string;
    mobile: string;
  };
};

export default function ActiveSessionsPage() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function loadActiveSessions() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/active-sessions", { cache: "no-store" });
      const data = await response.json();
      if (response.ok && data.success) {
        setSessions(data.activeSessions || []);
      } else {
        setMessage(data.message || "Failed to load active sessions");
      }
    } catch {
      setMessage("Network error loading active sessions");
    } finally {
      setLoading(false);
    }
  }

  async function handleEndSession(bookingId: string, forceEnd: boolean = false) {
    if (processingId) return;
    setProcessingId(bookingId);
    setMessage("");

    try {
      const response = await fetch("/api/admin/active-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, forceEnd }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setMessage(data.message);
        loadActiveSessions();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(data.message || "Failed to end session");
      }
    } catch {
      setMessage("Network error processing request");
    } finally {
      setProcessingId(null);
    }
  }

  useEffect(() => {
    loadActiveSessions();
    const interval = setInterval(() => {
      loadActiveSessions();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Timer helper to show live play duration
  const getPlayDuration = (startTime: string) => {
    const elapsedMs = Date.now() - new Date(startTime).getTime();
    if (elapsedMs < 0) return "0m";
    const minutes = Math.floor(elapsedMs / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000); // refresh duration text every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="min-w-0 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black text-[var(--primary)] flex items-center gap-2">
            <Clock size={32} />
            Active Sessions Panel
          </h1>
          <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
            Monitor ongoing sessions, elapsed play duration, and execute manual checkout actions.
          </p>
        </div>

        <button
          onClick={loadActiveSessions}
          disabled={loading}
          className="h-11 w-11 flex items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 hover:opacity-90 active:scale-95 transition"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-white p-3 text-sm font-black text-[var(--primary)] ring-1 ring-black/5">
          {message}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        {loading && sessions.length === 0 ? (
          <p className="py-10 text-center text-sm font-bold text-[var(--text-muted)] animate-pulse">
            Loading active court play sessions...
          </p>
        ) : sessions.length === 0 ? (
          <div className="py-12 text-center text-gray-500 font-bold">
            <Play size={40} className="mx-auto mb-2 text-gray-300 animate-pulse" />
            No active play sessions right now.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-b text-[var(--text-muted)]">
                  <th className="py-3">Player</th>
                  <th>Contact</th>
                  <th>Game Name</th>
                  <th>Court Assigned</th>
                  <th>Scheduled End</th>
                  <th>Live Play Duration</th>
                  <th>Session Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const isOvertime = Date.now() > new Date(session.endTime).getTime();
                  return (
                    <tr key={session._id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3">
                        <p className="font-black text-[var(--primary)]">{session.companyEmployeeId ? session.companyEmployeeId.name : (session.userId?.name || "Guest Visitor")}</p>
                        <span className={`text-[9px] font-black tracking-wider px-2 py-0.5 rounded ${
                          session.companyId ? "bg-blue-100 text-blue-800" :
                          (session.userId?.role === "VISITOR" || session.playerType === "VISITOR") 
                            ? "bg-amber-100 text-amber-800" 
                            : "bg-purple-100 text-purple-800"
                        }`}>
                          {session.companyId ? session.companyId.name :
                           (session.userId?.role === "VISITOR" || session.playerType === "VISITOR") ? "VISITOR" : "MEMBER"}
                        </span>
                      </td>
                      <td>{session.companyEmployeeId ? session.companyEmployeeId.mobile : (session.userId?.phone || "-")}</td>
                      <td className="font-bold text-gray-700">{session.gameName || "-"}</td>
                      <td className="font-black text-[var(--primary)]">{session.court || "-"}</td>
                      <td>
                        <p className="font-bold">{formatTime24(session.endTime)}{getEndSuffix(session.startTime, session.endTime)}</p>
                        <span className="text-[10px] text-gray-400 font-medium">Starts {formatTime24(session.startTime)}</span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-black ${isOvertime ? "text-rose-600 flex items-center gap-1" : "text-emerald-600"}`}>
                            {getPlayDuration(session.startTime)}
                            {isOvertime && <AlertCircle size={14} className="animate-bounce" />}
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEndSession(session._id, false)}
                            disabled={!!processingId}
                            className="h-9 rounded-full bg-emerald-600 text-white px-4 text-xs font-black hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
                          >
                            End Session
                          </button>
                          <button
                            onClick={() => handleEndSession(session._id, true)}
                            disabled={!!processingId}
                            className="h-9 rounded-full bg-rose-600 text-white px-4 text-xs font-black hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
                            title="Force end play session (bypass buffer calculation)"
                          >
                            <ShieldAlert size={14} />
                            Force End
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
