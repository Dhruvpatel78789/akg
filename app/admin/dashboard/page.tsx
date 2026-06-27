"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Gamepad2, Settings, Users, Clock, Shield } from "lucide-react";

const cards = [
  {
    title: "Games",
    description: "Add, edit, remove games and court count.",
    href: "/admin/games",
    icon: Gamepad2,
    color: "bg-[#D7E528]",
    section: "games",
  },
  {
    title: "Plans",
    description: "Create fixed membership and coin plans.",
    href: "/admin/plans",
    icon: CalendarClock,
    color: "bg-[#93D1CC]",
    section: "plans",
  },
  {
    title: "Members",
    description: "Manage users, reschedule permission and status.",
    href: "/admin/members",
    icon: Users,
    color: "bg-[#F6401E]",
    section: "members",
  },
  {
    title: "Settings",
    description: "Control buffer, reschedule and cancellation rules.",
    href: "/admin/settings",
    icon: Settings,
    color: "bg-white",
    section: "settings",
  },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkDashboardPermission() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.replace("/auth/login");
          return;
        }
        const data = await res.json();
        const user = data.user;

        if (!user) {
          router.replace("/auth/login");
          return;
        }

        if (user.role === "ADMIN") {
          setLoading(false);
          return;
        }

        const profile = user.roleProfile;
        if (!profile) {
          router.replace("/auth/login");
          return;
        }

        // Check if user has view permission for dashboard section
        const dashPerm = profile.permissions?.find((p: any) => p.section === "dashboard");
        if (dashPerm && dashPerm.view) {
          setLoading(false);
          return;
        }

        // Otherwise, redirect to the first section that is viewable
        const routeMap: Record<string, string> = {
          dashboard: "/admin/dashboard",
          games: "/admin/games",
          plans: "/admin/plans",
          members: "/admin/members",
          bookings: "/admin/bookings",
          passes: "/admin/passes",
          companies: "/admin/companies",
          companyEntries: "/admin/company-entries",
          companyBilling: "/admin/company-billing",
          visitorCoins: "/admin/visitor-coins",
          accessControl: "/admin/access-control",
          settings: "/admin/settings",
        };

        const firstPermitted = profile.permissions?.find((p: any) => {
          if (p.section === "bookings") {
            const subsObj = p.subSections instanceof Map ? Object.fromEntries(p.subSections) : p.subSections || {};
            return Object.values(subsObj).some((sub: any) => sub?.view);
          }
          return p.view;
        });

        if (firstPermitted && routeMap[firstPermitted.section]) {
          router.replace(routeMap[firstPermitted.section]);
        } else {
          router.replace("/auth/login");
        }
      } catch (err) {
        console.error(err);
        router.replace("/auth/login");
      }
    }

    checkDashboardPermission();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm font-bold text-gray-500 animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <section>
      <h1 className="text-4xl font-black text-[var(--primary)]">
        Admin Control
      </h1>

      <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
        Manage games, plans, bookings, members and system rules.
      </p>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.href}
              href={card.href}
              className={`rounded-[2rem] ${card.color} p-5 shadow-sm ring-1 ring-black/5`}
            >
              <Icon size={32} className="text-[var(--primary)]" />

              <h2 className="mt-5 text-2xl font-black text-[var(--primary)]">
                {card.title}
              </h2>

              <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
                {card.description}
              </p>
            </Link>
          );
        })}
      </section>
    </section>
  );
}