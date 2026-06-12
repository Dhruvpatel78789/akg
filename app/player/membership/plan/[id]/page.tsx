import Link from "next/link";
import { ArrowLeft, Dumbbell } from "lucide-react";

const plans = {
  cricket: {
    id: "cricket",
    gameName: "Cricket Turf",
    description: "Fixed membership for Cricket Turf with scheduled playtime.",
    price: "₹1,999",
    originalPrice: "₹2,499",
    duration: "1 Month",
    color: "#D7E528",
  },
  football: {
    id: "football",
    gameName: "Football Turf",
    description: "Fixed football turf membership with selected time slots.",
    price: "₹2,299",
    originalPrice: "₹2,999",
    duration: "1 Month",
    color: "#F6401E",
  },
  badminton: {
    id: "badminton",
    gameName: "Badminton",
    description: "Badminton membership with fixed duration and schedule.",
    price: "₹1,499",
    originalPrice: "₹1,999",
    duration: "1 Month",
    color: "#93D1CC",
  },
};

export default async function PlanDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plan = plans[id as keyof typeof plans];

  if (!plan) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-4">
        <h1 className="text-2xl font-black text-[var(--primary)]">
          Plan not found
        </h1>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-4">
      <section className="mx-auto w-full max-w-md">
        <header className="flex items-center justify-between">
          <Link
            href="/player/membership"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
          >
            <ArrowLeft size={28} className="text-[var(--primary)]" />
          </Link>
        </header>

        <section
          className="mt-8 overflow-hidden rounded-[2.4rem] p-[2px] shadow-sm"
          style={{ backgroundColor: plan.color }}
        >
          <article className="relative overflow-hidden rounded-[2.3rem] bg-white p-6">
            <Dumbbell
              size={90}
              className="absolute -bottom-5 left-4 text-[var(--primary)]/10"
            />

            <Dumbbell
              size={80}
              className="absolute -right-4 top-5 text-[var(--primary)]/10"
            />

            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
                Fixed Membership
              </p>

              <h1 className="mt-4 text-4xl font-black leading-tight text-[var(--primary)]">
                {plan.gameName}
              </h1>

              <p className="mt-3 text-sm font-bold leading-relaxed text-[var(--text-muted)]">
                {plan.description}
              </p>

              <div className="mt-6">
                <p className="text-4xl font-black text-[var(--primary)]">
                  {plan.price}
                </p>

                <p className="mt-1 text-xl font-black text-[var(--text-muted)] line-through">
                  {plan.originalPrice}
                </p>

                <p className="mt-4 inline-flex rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-black text-white">
                  {plan.duration}
                </p>
              </div>
            </div>
          </article>
        </section>

        <Link
          href={`/player/membership/plan/${plan.id}/register`}
          className="mt-7 flex h-14 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-black text-white shadow-sm"
        >
          Buy Plan
        </Link>
      </section>
    </main>
  );
}