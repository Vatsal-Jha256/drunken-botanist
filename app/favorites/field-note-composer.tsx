"use client";

import { useState, useTransition } from "react";
import { addNotebookFieldNote } from "./actions";

type BotanicalOption = {
  slug: string;
  commonName: string;
  latinName: string;
};

export function FieldNoteComposer({ botanicals }: { botanicals: BotanicalOption[] }) {
  const [slug, setSlug] = useState(botanicals[0]?.slug ?? "");
  const [observedAt, setObservedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <details className="specimen-card rounded-md p-4 group">
      <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-3">
        <span>
          <span className="smallcaps text-[10px] text-burgundy block">field notebook</span>
          <span className="font-serif text-xl text-ink">Add a botanical observation</span>
        </span>
        <span className="text-xs smallcaps text-sage-deep group-open:hidden">open →</span>
        <span className="text-xs smallcaps text-sage-deep hidden group-open:inline">close</span>
      </summary>
      <form
      action={(formData) => {
        const nextSlug = ((formData.get("slug") as string) ?? "").trim();
        const nextNote = ((formData.get("note") as string) ?? "").trim();
        const nextObservedAt = ((formData.get("observed_at") as string) ?? "").trim();
        const nextLocation = ((formData.get("location") as string) ?? "").trim();
        if (!nextSlug || !nextNote) return;

        startTransition(async () => {
          setError(null);
          try {
            const saved = await addNotebookFieldNote(
              nextSlug,
              nextNote,
              nextObservedAt,
              nextLocation,
            );
            if (!saved) return;
            setSlug(nextSlug);
            setObservedAt(new Date().toISOString().slice(0, 10));
            setLocation("");
            setNote("");
          } catch {
            setError("Could not save the field note. Make sure migration 0002 has run.");
          }
        });
      }}
      className="mt-4 space-y-3"
      >
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_1fr] gap-3">
        <label className="block">
          <span className="smallcaps text-[10px] text-ink-soft">botanical</span>
          <select
            name="slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="mt-1 w-full bg-parchment-deep/30 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
          >
            {botanicals.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.commonName}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="smallcaps text-[10px] text-ink-soft">date</span>
          <input
            type="date"
            name="observed_at"
            value={observedAt}
            onChange={(event) => setObservedAt(event.target.value)}
            className="mt-1 w-full bg-parchment-deep/30 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
          />
        </label>
        <label className="block">
          <span className="smallcaps text-[10px] text-ink-soft">place</span>
          <input
            name="location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="garden, trail, market"
            className="mt-1 w-full bg-parchment-deep/30 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
          />
        </label>
      </div>

      <textarea
        name="note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        placeholder="Leaf shape, scent, habitat, growth stage, what you collected or noticed..."
        className="w-full bg-parchment-deep/30 border border-paper-edge rounded-sm px-3 py-2 text-sm font-script text-base focus:outline-none focus:border-sage resize-none"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-soft">
          Saving a field note also adds that plant to your herbarium.
        </p>
        <button
          type="submit"
          disabled={pending || !note.trim()}
          className="bg-sage text-parchment px-4 py-1.5 rounded-sm text-sm smallcaps hover:bg-sage-deep disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save field note"}
        </button>
      </div>
      {error && <p className="text-xs text-burgundy">{error}</p>}
      </form>
    </details>
  );
}
