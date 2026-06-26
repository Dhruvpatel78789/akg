"use client";

import { useEffect, useState } from "react";
import { X, FileSpreadsheet, Users, Calendar, TrendingUp } from "lucide-react";

type Visitor = {
  _id: string;
  name: string;
  phone: string;
  email: string;
  dob?: string;
  visitCount: number;
  bookingsCount: number;
  totalAmountSpent: number;
  lastVisitDate: string | null;
  createdAt: string;
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

export default function AdminVisitorsPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("createdAt_desc");

  // Column visibility states
  const [showPhone, setShowPhone] = useState(true);
  const [showEmail, setShowEmail] = useState(true);
  const [showDOB, setShowDOB] = useState(true);
  const [showVisits, setShowVisits] = useState(true);
  const [showSpent, setShowSpent] = useState(true);
  const [showLastVisit, setShowLastVisit] = useState(true);

  async function loadVisitors(isBackground = false) {
    if (!isBackground) {
      if (visitors.length === 0) setInitialLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const response = await fetch(`/api/admin/visitors`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const incoming = data.visitors || [];
        setVisitors((prev) => {
          if (prev.length === 0) return incoming;
          return mergeById(prev, incoming);
        });
      } else {
        setMessage(data.message || "Failed to load visitors");
      }
    } catch (err: any) {
      setMessage("Error loading visitors data");
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadVisitors();
    const interval = setInterval(() => {
      loadVisitors(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter & sort clientside to be extremely fast
  const filteredVisitors = visitors
    .filter((v) => {
      const term = search.toLowerCase();
      return (
        v.name.toLowerCase().includes(term) ||
        v.phone.toLowerCase().includes(term) ||
        v.email.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      if (sort === "createdAt_desc") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sort === "createdAt_asc") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sort === "name_asc") {
        return a.name.localeCompare(b.name);
      }
      if (sort === "name_desc") {
        return b.name.localeCompare(a.name);
      }
      if (sort === "visits_desc") {
        return b.visitCount - a.visitCount;
      }
      if (sort === "spent_desc") {
        return b.totalAmountSpent - a.totalAmountSpent;
      }
      return 0;
    });

  const totalVisitorsCount = visitors.length;
  const totalSpentAll = visitors.reduce((sum, v) => sum + v.totalAmountSpent, 0);
  const totalVisitsCount = visitors.reduce((sum, v) => sum + v.visitCount, 0);

  function handleCSVExport() {
    const headers = ["Name", "Phone", "Email", "DOB", "Visits Count", "Total Amount Spent", "Last Visit", "Registered Date"];
    const rows = filteredVisitors.map((v) => [
      v.name,
      v.phone,
      v.email,
      v.dob ? new Date(v.dob).toLocaleDateString("en-IN") : "N/A",
      v.visitCount,
      v.totalAmountSpent,
      v.lastVisitDate ? new Date(v.lastVisitDate).toLocaleString("en-IN") : "N/A",
      new Date(v.createdAt).toLocaleDateString("en-IN"),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map(val => `"${val}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `visitors_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <section className="min-w-0 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-[var(--primary)]">
            Visitors & Guests
          </h1>
          <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
            Monitor non-member walk-ins, repeat visitors count, bookings, and spendings.
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

      {/* Visitor Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col justify-center items-center text-center shadow-sm">
          <Users className="text-[var(--primary)]" size={32} />
          <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-wider mt-3">Unique Visitors</h4>
          <p className="text-2xl font-black text-[var(--primary)] mt-1">{totalVisitorsCount}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col justify-center items-center text-center shadow-sm">
          <Calendar className="text-emerald-600" size={32} />
          <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-wider mt-3">Total Guest Visits</h4>
          <p className="text-2xl font-black text-emerald-600 mt-1">{totalVisitsCount}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col justify-center items-center text-center shadow-sm">
          <TrendingUp className="text-rose-600" size={32} />
          <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-wider mt-3">Total Spendings</h4>
          <p className="text-2xl font-black text-rose-600 mt-1">₹{totalSpentAll}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-gray-500">Search</span>
            <input
              type="text"
              placeholder="Search visitor name, email, or phone..."
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
              <option value="visits_desc">Visits Count (High to Low)</option>
              <option value="spent_desc">Spendings (High to Low)</option>
            </select>
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
            <input type="checkbox" checked={showDOB} onChange={(e) => setShowDOB(e.target.checked)} />
            DOB
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showVisits} onChange={(e) => setShowVisits(e.target.checked)} />
            Visits Count
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showSpent} onChange={(e) => setShowSpent(e.target.checked)} />
            Total Spent
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showLastVisit} onChange={(e) => setShowLastVisit(e.target.checked)} />
            Last Visit
          </label>
        </div>
      </section>

      {/* Table */}
      <section className="mt-6 overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        {initialLoading ? (
          <p className="text-sm font-bold text-[var(--text-muted)] py-4">Loading visitors data...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-b text-[var(--text-muted)]">
                  <th className="py-3">Visitor Name</th>
                  {showPhone && <th>Phone</th>}
                  {showEmail && <th>Email</th>}
                  {showDOB && <th>Date of Birth</th>}
                  {showVisits && <th>Visits</th>}
                  {showSpent && <th>Total Spent</th>}
                  {showLastVisit && <th>Last Visit Date</th>}
                </tr>
              </thead>

              <tbody>
                {filteredVisitors.map((visitor) => (
                  <tr key={visitor._id} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="py-3 font-black text-[var(--primary)]">
                      {visitor.name}
                    </td>

                    {showPhone && <td>{visitor.phone}</td>}

                    {showEmail && <td>{visitor.email.includes("@visitor.") ? "N/A" : visitor.email}</td>}

                    {showDOB && <td>{visitor.dob ? new Date(visitor.dob).toLocaleDateString("en-IN") : "N/A"}</td>}

                    {showVisits && <td className="font-bold">{visitor.visitCount}</td>}

                    {showSpent && <td className="font-black text-rose-600">₹{visitor.totalAmountSpent}</td>}

                    {showLastVisit && (
                      <td>
                        {visitor.lastVisitDate
                          ? new Date(visitor.lastVisitDate).toLocaleString("en-IN")
                          : "N/A"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredVisitors.length === 0 && (
              <p className="mt-5 text-sm font-bold text-[var(--text-muted)]">
                No visitor data matched your parameters.
              </p>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
