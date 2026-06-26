"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateGamePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    duration: 60,
    maximumDuration: 120,
    price: 1000,
    numberOfCourts: 1,
    fixedSlotBooking: false,
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    await fetch("/api/admin/games", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    router.push("/admin/games");
  }

  return (
    <section>
      <h1 className="text-4xl font-black text-[var(--primary)]">
        Add Game
      </h1>

      <form onSubmit={submit} className="mt-7 grid gap-4">
        {Object.entries(form)
          .filter(([key]) => key !== "fixedSlotBooking")
          .map(([key, value]) => (
            <input
              key={key}
              placeholder={key}
              type={typeof value === "number" ? "number" : "text"}
              value={value as any}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  [key]:
                    typeof value === "number"
                      ? Number(event.target.value)
                      : event.target.value,
                }))
              }
              className="h-14 rounded-full bg-white px-5 font-bold outline-none ring-1 ring-black/5"
            />
          ))}

        <label className="flex items-center gap-3 px-5 py-3 rounded-full bg-white ring-1 ring-black/5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.fixedSlotBooking}
            onChange={(e) => setForm((prev) => ({ ...prev, fixedSlotBooking: e.target.checked }))}
            className="h-5 w-5 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
          />
          <span className="font-bold text-sm text-[var(--primary)] select-none">
            Enable Fixed Slot Booking
          </span>
        </label>

        <button className="h-14 rounded-full bg-[var(--primary)] font-black text-white">
          Create Game
        </button>
      </form>
    </section>
  );
}