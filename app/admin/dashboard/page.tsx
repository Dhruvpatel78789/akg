import Link from "next/link";
import { CalendarClock, Gamepad2, Settings, Users } from "lucide-react";

const cards = [
  {
    title: "Games",
    description: "Add, edit, remove games and court count.",
    href: "/admin/games",
    icon: Gamepad2,
    color: "bg-[#D7E528]",
  },
  {
    title: "Plans",
    description: "Create fixed membership and coin plans.",
    href: "/admin/plans",
    icon: CalendarClock,
    color: "bg-[#93D1CC]",
  },
  {
    title: "Members",
    description: "Manage users, reschedule permission and status.",
    href: "/admin/members",
    icon: Users,
    color: "bg-[#F6401E]",
  },
  {
    title: "Settings",
    description: "Control buffer, reschedule and cancellation rules.",
    href: "/admin/settings",
    icon: Settings,
    color: "bg-white",
  },
];

export default function AdminDashboardPage() {
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