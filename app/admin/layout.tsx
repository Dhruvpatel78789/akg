"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Gamepad2,
  Home,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
  X,
  Megaphone,
  LogOut,
  Wallet,
  Clock,
  Building2,
  Shield,
  Coins,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Games", href: "/admin/games", icon: Gamepad2 },
  { label: "Plans", href: "/admin/plans", icon: CalendarClock },
  { label: "Members", href: "/admin/members", icon: Users },
  { label: "Bookings", href: "/admin/bookings", icon: CalendarClock },
  { label: "Active Sessions", href: "/admin/active-sessions", icon: Clock },
  { label: "Companies", href: "/admin/companies", icon: Building2 },
  { label: "Company Entries", href: "/admin/company-entries", icon: Clock },
  { label: "Company Billing", href: "/admin/company-billing", icon: Wallet },
  { label: "Transactions", href: "/admin/transactions", icon: Wallet },
  { label: "Visitors", href: "/admin/visitors", icon: Users },
  { label: "Overtime", href: "/admin/overtime", icon: Clock },
  { label: "Ads & Offers", href: "/admin/promotions", icon: Megaphone },
  { label: "Visitor Coins", href: "/admin/visitor-coins", icon: Coins },
  { label: "Access Control", href: "/admin/access-control", icon: Shield },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) {
          router.replace("/auth/login");
          return;
        }
        const data = await response.json();
        if (!data?.user || (data.user.role !== "ADMIN" && !data.user.roleProfile)) {
          router.replace("/auth/login");
          return;
        }
        setUser(data.user);
        setLoading(false);
      } catch {
        router.replace("/auth/login");
      }
    }
    checkAuth();
  }, [router]);

  async function handleLogout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) {
      window.location.href = "/auth/login";
    }
  }

  if (loading) {
    return (
      <main className="admin-sport-gradient min-h-screen flex items-center justify-center">
        <p className="font-black text-[var(--primary)] text-lg">Loading admin panel...</p>
      </main>
    );
  }

  const Sidebar = (
    <aside className="admin-glass h-full w-72 p-5">
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/admin/dashboard"
          className="text-xl font-black text-[var(--primary)]"
        >
          Akshar Game Zone Admin
        </Link>

        <button
          type="button"
          className="md:hidden"
          onClick={() => setOpen(false)}
        >
          <X size={24} className="text-[var(--primary)]" />
        </button>
      </div>

      <nav className="grid gap-2">
        {navItems.filter(item => {
          if (!user) return false;
          if (user.role === "ADMIN") return true;

          const profile = user.roleProfile;
          if (!profile) return false;

          let sectionKey = "";
          let subKey = "";

          if (item.href === "/admin/dashboard") sectionKey = "dashboard";
          else if (item.href === "/admin/games") sectionKey = "games";
          else if (item.href === "/admin/plans") sectionKey = "plans";
          else if (item.href === "/admin/members") sectionKey = "members";
          else if (item.href === "/admin/bookings") sectionKey = "bookings";
          else if (item.href === "/admin/active-sessions") {
            sectionKey = "bookings";
            subKey = "ongoingSessions";
          }
          else if (item.href === "/admin/companies") sectionKey = "companies";
          else if (item.href === "/admin/company-entries") sectionKey = "companyEntries";
          else if (item.href === "/admin/company-billing") sectionKey = "companyBilling";
          else if (item.href === "/admin/transactions") sectionKey = "companyBilling";
          else if (item.href === "/admin/visitors") sectionKey = "members";
          else if (item.href === "/admin/overtime") {
            sectionKey = "bookings";
            subKey = "overtimeCharges";
          }
          else if (item.href === "/admin/promotions") sectionKey = "couponsOffers";
          else if (item.href === "/admin/visitor-coins") sectionKey = "visitorCoins";
          else if (item.href === "/admin/access-control") sectionKey = "accessControl";
          else if (item.href === "/admin/settings") sectionKey = "settings";

          if (!sectionKey) return true;

          const perm = profile.permissions?.find((p: any) => p.section === sectionKey);
          if (!perm) return false;
          if (!perm.view) return false;

          if (subKey) {
            // Support both Map format and raw object format
            const subSectionsObj = perm.subSections instanceof Map
              ? Object.fromEntries(perm.subSections)
              : perm.subSections || {};
            const subPerm = subSectionsObj[subKey];
            if (subPerm && !subPerm.view) return false;
          }

          return true;
        }).map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black text-[var(--primary)] transition hover:bg-white/55"
            >
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-8 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black text-red-500 transition hover:bg-white/55 text-left"
      >
        <LogOut size={20} />
        Logout
      </button>
    </aside>
  );

  return (
    <main className="admin-sport-gradient min-h-screen">
      <div className="flex min-h-screen">
        <div className="hidden shrink-0 p-4 md:block">{Sidebar}</div>

        {open && (
          <div className="fixed inset-0 z-50 bg-black/40 p-4 md:hidden">
            {Sidebar}
          </div>
        )}

        <section className="min-w-0 flex-1 p-4 md:p-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="admin-glass mb-4 flex h-12 w-12 items-center justify-center rounded-full md:hidden"
          >
            <Menu size={24} className="text-[var(--primary)]" />
          </button>

          <div className="mx-auto max-w-[1800px]">{children}</div>
        </section>
      </div>
    </main>
  );
}