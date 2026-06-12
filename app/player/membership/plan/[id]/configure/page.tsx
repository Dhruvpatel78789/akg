import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ConfigurePlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-4">
      <section className="mx-auto w-full max-w-md">
        <Link
          href={`/player/membership/plan/${id}`}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
        >
          <ArrowLeft size={28} className="text-[var(--primary)]" />
        </Link>

        <section className="mt-7 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
            Step 2
          </p>

          <h1 className="mt-3 text-3xl font-black text-[var(--primary)]">
            Configure Plan
          </h1>

          <p className="mt-2 text-sm font-bold text-[var(--text-muted)]">
            Selected plan: {id}
          </p>

          <p className="mt-4 text-sm font-bold text-[var(--text-muted)]">
            Game selection, time selection, and duration setup will be designed
            here next.
          </p>
        </section>
      </section>
    </main>
  );
}