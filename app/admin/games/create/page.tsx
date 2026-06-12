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
        {Object.entries(form).map(([key, value]) => (
          <input
            key={key}
            placeholder={key}
            type={typeof value === "number" ? "number" : "text"}
            value={value}
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

        <button className="h-14 rounded-full bg-[var(--primary)] font-black text-white">
          Create Game
        </button>
      </form>
    </section>
  );
}