"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { setBarItem } from "./actions";

export function BarChecklist({
  allNames,
  initialBar,
}: {
  allNames: string[];
  initialBar: string[];
}) {
  const initial = useMemo(
    () => new Set(initialBar.map((s) => s.toLowerCase().trim())),
    [initialBar],
  );
  const [owned, setOwned] = useState<Set<string>>(initial);
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = allNames.filter((n) =>
    n.toLowerCase().includes(filter.toLowerCase()),
  );

  function toggle(name: string) {
    const key = name.toLowerCase().trim();
    const next = new Set(owned);
    const isOwned = next.has(key);
    if (isOwned) next.delete(key);
    else next.add(key);
    setOwned(next);
    startTransition(() => setBarItem(name, !isOwned));
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter ingredients…"
        className="w-full bg-parchment-deep/40 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
      />
      <div className="text-xs text-ink-soft flex justify-between">
        <span>{filtered.length} shown</span>
        {pending && <span className="italic">saving…</span>}
      </div>
      <ul className="specimen-card rounded-md max-h-[60vh] overflow-y-auto divide-y divide-paper-edge/60">
        {filtered.map((name) => {
          const key = name.toLowerCase().trim();
          const isOwned = owned.has(key);
          const slug = name.replace(/\s+/g, "_");
          return (
            <li key={name}>
              <label className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-parchment-deep/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOwned}
                  onChange={() => toggle(name)}
                  className="accent-sage-deep"
                />
                <Image
                  src={`https://www.thecocktaildb.com/images/ingredients/${slug}-Small.png`}
                  alt=""
                  width={28}
                  height={28}
                  loading="lazy"
                  className="w-7 h-7 object-contain shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
                <span className={isOwned ? "text-ink" : "text-ink-soft"}>{name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
