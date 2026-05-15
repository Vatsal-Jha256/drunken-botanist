"use client";

import { useMemo, useState, useTransition } from "react";
import type { Canonical, RecipeMatch, BillLineItem } from "@/lib/calculator";
import {
  calculate,
  buildBillFromPicks,
  type CalcInput,
  type CalcOutput,
} from "./actions";

type InvRow = { canonical: string; ml: number };
type Pick = { recipeId: string; servings: number; name: string };

const DEFAULT_UNLIMITED = ["Soda Water", "Tonic Water"];

const OPTIONAL_UNLIMITED_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Other carbonated mixers",
    items: ["Cola", "Lemon-Lime Soda", "Ginger Ale", "Ginger Beer"],
  },
  {
    label: "Bitters (specialty — toggle if you can find them locally)",
    items: ["Angostura Bitters", "Orange Bitters", "Peychaud's Bitters", "Bitters"],
  },
  {
    label: "Pantry staples (toggle on if you keep them stocked)",
    items: ["Simple Syrup", "Honey Syrup", "Sugar", "Salt"],
  },
];

export function CalculatorUI({ canonicals }: { canonicals: Canonical[] }) {
  // Inventory
  const [rows, setRows] = useState<InvRow[]>([
    { canonical: "Bourbon", ml: 750 },
  ]);
  const [extraUnlimited, setExtraUnlimited] = useState<Set<string>>(new Set());
  const [strictAlcohol, setStrictAlcohol] = useState(true);
  const [servings, setServings] = useState(4);

  // Results + menu
  const [output, setOutput] = useState<CalcOutput | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [bill, setBill] = useState<{ lineItems: BillLineItem[]; totalDrinks: number } | null>(null);
  const [busy, startBusy] = useTransition();

  const grouped = useMemo(() => {
    const map: Record<string, Canonical[]> = {};
    for (const c of canonicals) (map[c.category] ??= []).push(c);
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [canonicals]);

  const usedKeys = new Set(rows.map((r) => r.canonical));

  function addRow(canonical: string) {
    if (usedKeys.has(canonical)) return;
    setRows((p) => [...p, { canonical, ml: 750 }]);
  }
  function update(i: number, patch: Partial<InvRow>) {
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    setRows((p) => p.filter((_, idx) => idx !== i));
  }
  function toggleUnlimited(name: string) {
    setExtraUnlimited((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function compute() {
    const byCanonical: Record<string, number> = {};
    for (const r of rows) if (r.ml > 0) byCanonical[r.canonical] = r.ml;
    const input: CalcInput = {
      byCanonical,
      unlimited: [...extraUnlimited],
      servings,
      strictAlcohol,
    };
    startBusy(async () => {
      const out = await calculate(input);
      setOutput(out);
      setBill(null);
    });
  }

  function addPick(m: RecipeMatch) {
    if (picks.some((p) => p.recipeId === m.recipe.id)) return;
    setPicks((p) => [...p, { recipeId: m.recipe.id, servings, name: m.recipe.name }]);
    setBill(null);
  }
  function removePick(id: string) {
    setPicks((p) => p.filter((x) => x.recipeId !== id));
    setBill(null);
  }
  function updatePickServings(id: string, s: number) {
    setPicks((p) => p.map((x) => (x.recipeId === id ? { ...x, servings: Math.max(1, s) } : x)));
    setBill(null);
  }

  function computeBill() {
    const byCanonical: Record<string, number> = {};
    for (const r of rows) if (r.ml > 0) byCanonical[r.canonical] = r.ml;
    startBusy(async () => {
      const b = await buildBillFromPicks({
        byCanonical,
        unlimited: [...extraUnlimited],
        picks: picks.map((p) => ({ recipeId: p.recipeId, servings: p.servings })),
      });
      setBill(b);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-8">
      {/* ─── Left: setup ─── */}
      <aside className="space-y-5 lg:sticky lg:top-6 self-start">
        <section className="specimen-card rounded-md p-5">
          <h2 className="font-serif text-lg text-ink">Your bottles</h2>
          <p className="text-xs text-ink-soft mb-3">
            Alcohol only — list what you actually have, in millilitres.
          </p>

          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.canonical} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{r.canonical}</span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={r.ml}
                  onChange={(e) => update(i, { ml: +e.target.value || 0 })}
                  className="w-20 bg-parchment-deep/40 border border-paper-edge rounded-sm px-2 py-1 text-right text-xs tabular-nums"
                />
                <span className="text-xs text-ink-soft">ml</span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-ink-soft hover:text-burgundy text-base leading-none px-1"
                  aria-label={`Remove ${r.canonical}`}
                >
                  ×
                </button>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="text-xs italic text-ink-soft">No bottles yet — pick from below.</li>
            )}
          </ul>

          <div className="mt-4">
            <p className="smallcaps text-[10px] text-ink-soft mb-1.5">add alcohol</p>
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {["spirit", "fortified", "liqueur"].map((cat) =>
                grouped[cat] ? (
                  <div key={cat}>
                    <p className="smallcaps text-[9px] text-ink-soft mb-1">{cat}</p>
                    <div className="flex flex-wrap gap-1">
                      {grouped[cat].map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          disabled={usedKeys.has(c.name)}
                          onClick={() => addRow(c.name)}
                          className={`text-[11px] px-2 py-0.5 rounded-full border ${
                            usedKeys.has(c.name)
                              ? "border-paper-edge/40 text-ink-soft/40 cursor-not-allowed"
                              : "border-paper-edge text-ink-soft hover:bg-sage/10 hover:text-ink"
                          }`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        </section>

        <section className="specimen-card rounded-md p-5">
          <h2 className="font-serif text-lg text-ink">Mixers & staples</h2>
          <p className="text-xs text-ink-soft mb-3">
            What you treat as &ldquo;unlimited&rdquo;. Soda &amp; Tonic Water are on by
            default (globally easy). Tick anything else you keep in supply.
          </p>

          <div className="space-y-3 text-sm">
            <div>
              <p className="smallcaps text-[9px] text-ink-soft mb-1">always on</p>
              <ul className="flex flex-wrap gap-1.5 text-xs">
                {DEFAULT_UNLIMITED.map((m) => (
                  <li
                    key={m}
                    className="px-2 py-0.5 rounded-full border border-sage/60 bg-sage/10 text-sage-deep"
                  >
                    ✓ {m}
                  </li>
                ))}
              </ul>
            </div>
            {OPTIONAL_UNLIMITED_GROUPS.map((g) => (
              <div key={g.label}>
                <p className="smallcaps text-[9px] text-ink-soft mb-1">{g.label}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {g.items.map((item) => {
                    const on = extraUnlimited.has(item);
                    return (
                      <li key={item}>
                        <button
                          type="button"
                          onClick={() => toggleUnlimited(item)}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                            on
                              ? "border-sage bg-sage/15 text-sage-deep"
                              : "border-paper-edge text-ink-soft hover:bg-parchment-deep/40"
                          }`}
                        >
                          {on ? "✓ " : ""}
                          {item}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="specimen-card rounded-md p-5">
          <h2 className="font-serif text-lg text-ink">Run</h2>
          <label className="flex items-center justify-between text-sm mt-3">
            <span>Guests / servings</span>
            <input
              type="number"
              min={1}
              max={50}
              value={servings}
              onChange={(e) => setServings(Math.max(1, +e.target.value || 1))}
              className="w-16 bg-parchment-deep/40 border border-paper-edge rounded-sm px-2 py-1 text-right text-xs tabular-nums"
            />
          </label>
          <label className="flex items-start gap-2 mt-3 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={strictAlcohol}
              onChange={(e) => setStrictAlcohol(e.target.checked)}
              className="accent-sage-deep mt-0.5"
            />
            <span className="text-ink-soft">
              <strong className="text-ink">Strict mode</strong> — only show recipes whose
              alcohols are all in my bottles list above. Uncheck to also see drinks I&apos;d
              need to pick up one more bottle for.
            </span>
          </label>
          <button
            type="button"
            onClick={compute}
            disabled={busy || rows.length === 0}
            className="mt-4 w-full bg-sage text-parchment py-2 rounded-sm smallcaps text-sm hover:bg-sage-deep disabled:opacity-60"
          >
            {busy ? "scanning…" : "compute"}
          </button>
        </section>
      </aside>

      {/* ─── Right: results + cart + bill ─── */}
      <main className="space-y-10 min-w-0">
        {!output ? (
          <div className="specimen-card rounded-md p-10 text-center">
            <p className="font-serif text-xl text-ink mb-2">Ready when you are.</p>
            <p className="text-ink-soft text-sm">
              Add bottles on the left, tick which mixers you have stocked, then hit{" "}
              <span className="smallcaps">compute</span>.
            </p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="font-serif text-2xl text-ink mb-1">
                Fully makeable ({output.fullyMakeable.length})
              </h2>
              <p className="text-xs text-ink-soft mb-4">
                Every ingredient covered by your bottles + your unlimited list. Tap{" "}
                <span className="smallcaps">add to menu</span> to start building tonight&apos;s
                cart.
              </p>
              {output.fullyMakeable.length === 0 ? (
                <p className="specimen-card rounded-md p-5 text-sm text-ink-soft">
                  Nothing fully makeable with these bottles. Try the suggestions below
                  or untick &ldquo;Strict mode&rdquo; to see what you&apos;re close to.
                </p>
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {output.fullyMakeable.map((m) => (
                    <li key={m.recipe.id}>
                      <RecipeCard
                        match={m}
                        servings={servings}
                        onAdd={() => addPick(m)}
                        picked={picks.some((p) => p.recipeId === m.recipe.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {output.recommendedAdditions.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl text-ink mb-1">
                  Buy one of these to unlock more
                </h2>
                <p className="text-xs text-ink-soft mb-3">
                  How many extra cocktails each missing ingredient would unlock.
                </p>
                <ul className="flex flex-wrap gap-2">
                  {output.recommendedAdditions.map((r) => (
                    <li
                      key={r.canonical}
                      className="specimen-card rounded-full px-3 py-1 text-xs flex items-center gap-2"
                    >
                      <span className="font-serif">{r.canonical}</span>
                      <span className="text-ink-soft">
                        +{r.unlocks} {r.unlocks === 1 ? "drink" : "drinks"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!strictAlcohol && output.oneAway.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl text-ink mb-1">
                  One bottle away ({output.oneAway.length})
                </h2>
                <p className="text-xs text-ink-soft mb-3">
                  Discovery mode — recipes that need one ingredient you don&apos;t have.
                </p>
                <ul className="space-y-2">
                  {output.oneAway.slice(0, 10).map((m) => (
                    <li
                      key={m.recipe.id}
                      className="flex flex-wrap items-center justify-between gap-3 specimen-card rounded-sm px-4 py-2 text-sm"
                    >
                      <span className="font-serif">{m.recipe.name}</span>
                      <span className="text-xs text-burgundy">
                        needs <strong>{m.uncovered[0].canonical ?? m.uncovered[0].name}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {picks.length > 0 && (
              <section className="specimen-card rounded-md p-5">
                <h2 className="font-serif text-2xl text-ink mb-1">
                  Tonight&apos;s menu ({picks.length})
                </h2>
                <p className="text-xs text-ink-soft mb-4">
                  Adjust servings per drink, then build the shopping bill.
                </p>
                <ul className="divide-y divide-paper-edge/60">
                  {picks.map((p) => (
                    <li
                      key={p.recipeId}
                      className="flex items-center gap-3 py-2 text-sm"
                    >
                      <span className="flex-1 font-serif">{p.name}</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={p.servings}
                        onChange={(e) => updatePickServings(p.recipeId, +e.target.value || 1)}
                        className="w-14 bg-parchment-deep/40 border border-paper-edge rounded-sm px-2 py-1 text-right text-xs tabular-nums"
                      />
                      <span className="text-xs text-ink-soft">×</span>
                      <button
                        type="button"
                        onClick={() => removePick(p.recipeId)}
                        className="text-ink-soft hover:text-burgundy text-sm"
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setPicks([]);
                      setBill(null);
                    }}
                    className="text-xs smallcaps text-ink-soft hover:text-ink"
                  >
                    clear
                  </button>
                  <button
                    type="button"
                    onClick={computeBill}
                    disabled={busy}
                    className="bg-burgundy text-parchment px-4 py-1.5 rounded-sm smallcaps text-xs hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? "building bill…" : "build shopping bill"}
                  </button>
                </div>
              </section>
            )}

            {bill && <BillTable bill={bill} />}
          </>
        )}
      </main>
    </div>
  );
}

function BillTable({
  bill,
}: {
  bill: { lineItems: BillLineItem[]; totalDrinks: number };
}) {
  const groups = useMemo(() => {
    const g: Record<string, BillLineItem[]> = {};
    for (const li of bill.lineItems) (g[li.category] ??= []).push(li);
    return g;
  }, [bill]);

  const CATEGORY_ORDER = [
    "spirit",
    "fortified",
    "liqueur",
    "bitters",
    "syrup",
    "mixer",
    "other",
    "garnish",
    "specialty",
  ];
  const CATEGORY_LABEL: Record<string, string> = {
    spirit: "Spirits",
    fortified: "Wines & fortified",
    liqueur: "Liqueurs",
    bitters: "Bitters",
    syrup: "Syrups",
    mixer: "Mixers",
    other: "Other",
    garnish: "Garnishes",
    specialty: "Specialty",
  };

  const totalBuyMl = bill.lineItems.reduce((s, li) => s + li.shortfallMl, 0);

  return (
    <section>
      <h2 className="font-serif text-2xl text-ink mb-1">Shopping bill</h2>
      <p className="text-xs text-ink-soft mb-4">
        Every ingredient your menu pulls for {bill.totalDrinks}{" "}
        {bill.totalDrinks === 1 ? "drink" : "drinks"} — alcohol, mixers, syrups
        and garnishes. <strong>Buy column</strong> totals{" "}
        <span className="text-burgundy">{totalBuyMl} ml</span> still to pick up.
      </p>

      {CATEGORY_ORDER.filter((c) => groups[c]?.length).map((cat) => (
        <div key={cat} className="specimen-card rounded-md overflow-hidden mb-4">
          <div className="bg-parchment-deep/30 px-4 py-2 flex items-center justify-between">
            <p className="smallcaps text-xs text-ink-soft">
              {CATEGORY_LABEL[cat] ?? cat}
            </p>
            <p className="text-[10px] text-ink-soft">
              {groups[cat].length} {groups[cat].length === 1 ? "item" : "items"}
            </p>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="text-[10px] smallcaps text-ink-soft">
              <tr>
                <th className="text-left px-4 py-2 font-normal">ingredient</th>
                <th className="text-right px-2 py-2 font-normal">need</th>
                <th className="text-right px-2 py-2 font-normal">have</th>
                <th className="text-right px-4 py-2 font-normal">buy</th>
              </tr>
            </thead>
            <tbody>
              {groups[cat].map((li) => (
                <tr
                  key={li.displayName}
                  className="border-t border-paper-edge/60"
                >
                  <td className="px-4 py-2">
                    <span>{li.displayName}</span>
                    {li.unlimited && (
                      <span className="ml-2 text-[10px] smallcaps text-sage-deep">
                        unlimited
                      </span>
                    )}
                    {li.garnishOnly && (
                      <span className="ml-2 text-[10px] smallcaps text-ink-soft">
                        garnish
                      </span>
                    )}
                    <p className="text-[10px] text-ink-soft mt-0.5">
                      for: {li.fromRecipes.join(", ")}
                    </p>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-soft">
                    {li.garnishOnly
                      ? `${li.totalCount} ${li.totalCount === 1 ? "pc" : "pcs"}`
                      : `${li.totalMl} ml`}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-soft">
                    {li.garnishOnly ? "—" : `${li.haveMl} ml`}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {li.unlimited ? (
                      <span className="text-sage-deep text-xs smallcaps">
                        on tap
                      </span>
                    ) : li.garnishOnly ? (
                      <span className="text-ink-soft text-xs">prep</span>
                    ) : li.shortfallMl > 0 ? (
                      <span className="text-burgundy font-medium">
                        {li.shortfallMl} ml
                      </span>
                    ) : (
                      <span className="text-sage-deep">covered</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ))}
    </section>
  );
}

function RecipeCard({
  match,
  servings,
  onAdd,
  picked,
}: {
  match: RecipeMatch;
  servings: number;
  onAdd: () => void;
  picked: boolean;
}) {
  const m = match;
  return (
    <div className="specimen-card rounded-md p-4 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h3 className="font-serif text-lg text-ink leading-tight">{m.recipe.name}</h3>
          {(m.recipe.bartender || m.recipe.bar) && (
            <p className="text-[10px] text-ink-soft mt-0.5 italic truncate">
              {[m.recipe.bartender, m.recipe.bar, m.recipe.location]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <span className="text-[10px] smallcaps text-ink-soft tabular-nums shrink-0">
          {servings}×
        </span>
      </div>
      <ul className="mt-2 space-y-0.5 text-xs">
        {m.recipe.ingredients.map((ing, i) => (
          <li key={i} className="flex justify-between gap-2 tabular-nums">
            <span className={ing.canonical ? "text-ink" : "text-ink-soft italic"}>
              {ing.name}
            </span>
            <span className="font-script text-base text-ink-soft">
              {ing.ml != null ? `${Math.round(ing.ml)} ml` : ing.raw}
            </span>
          </li>
        ))}
      </ul>
      {m.recipe.garnish && (
        <p className="text-[10px] smallcaps text-ink-soft mt-2">
          garnish · {m.recipe.garnish}
        </p>
      )}
      <button
        type="button"
        onClick={onAdd}
        disabled={picked}
        className={`mt-3 self-start text-xs smallcaps px-3 py-1 rounded-full border ${
          picked
            ? "border-sage/60 bg-sage/10 text-sage-deep cursor-default"
            : "border-paper-edge text-ink-soft hover:bg-sage/10 hover:text-ink"
        }`}
      >
        {picked ? "✓ on menu" : "+ add to menu"}
      </button>
    </div>
  );
}
