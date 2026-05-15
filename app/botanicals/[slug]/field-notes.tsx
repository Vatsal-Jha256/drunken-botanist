"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { addBotanicalFieldNote, deleteBotanicalFieldNote } from "./actions";

type FieldNote = {
  id: string;
  note: string;
  observed_at: string | null;
  location: string | null;
  created_at: string;
};

export function BotanicalFieldNotes({
  slug,
  commonName,
  initialNotes,
  signedIn,
}: {
  slug: string;
  commonName: string;
  initialNotes: FieldNote[];
  signedIn: boolean;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [observedAt, setObservedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const placeholder = useMemo(
    () => `Found ${commonName.toLowerCase()} near the path; crushed leaf smelled resinous...`,
    [commonName],
  );

  if (!signedIn) {
    return (
      <p className="text-ink-soft text-sm">
        <Link href="/login" className="link-underline">
          Sign in
        </Link>{" "}
        to keep field notes for plants you find.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <form
        action={(formData) => {
          const nextNote = ((formData.get("note") as string) ?? "").trim();
          const nextLocation = ((formData.get("location") as string) ?? "").trim();
          const nextObservedAt = ((formData.get("observed_at") as string) ?? "").trim();
          if (!nextNote) return;

          startTransition(async () => {
            setError(null);
            try {
              const saved = await addBotanicalFieldNote(
                slug,
                nextNote,
                nextObservedAt,
                nextLocation,
              );
              if (!saved) return;
              setNotes((prev) => [saved, ...prev]);
              setNote("");
              setLocation("");
              setObservedAt(new Date().toISOString().slice(0, 10));
            } catch {
              setError("Could not save this field note. Run the botanical field notes migration, then try again.");
            }
          });
        }}
        className="specimen-card rounded-md p-4 space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="smallcaps text-[10px] text-ink-soft">date</span>
            <input
              type="date"
              name="observed_at"
              value={observedAt}
              onChange={(e) => setObservedAt(e.target.value)}
              className="mt-1 w-full bg-parchment-deep/30 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
            />
          </label>
          <label className="block">
            <span className="smallcaps text-[10px] text-ink-soft">place</span>
            <input
              name="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="garden, trail, market..."
              className="mt-1 w-full bg-parchment-deep/30 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
            />
          </label>
        </div>
        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="w-full bg-parchment-deep/30 border border-paper-edge rounded-sm px-3 py-2 text-sm font-script text-base focus:outline-none focus:border-sage resize-none"
        />
        <div className="flex justify-end">
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

      {notes.length === 0 ? (
        <p className="text-ink-soft text-sm text-center py-4">
          No field notes yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {notes.map((entry) => (
            <li key={entry.id} className="specimen-card rounded-md p-4">
              <div className="flex items-center justify-between gap-3 text-xs text-ink-soft">
                <span>
                  {entry.observed_at
                    ? new Date(`${entry.observed_at}T00:00:00`).toLocaleDateString()
                    : new Date(entry.created_at).toLocaleDateString()}
                  {entry.location ? ` · ${entry.location}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setNotes((prev) => prev.filter((n) => n.id !== entry.id));
                    startTransition(() => deleteBotanicalFieldNote(entry.id, slug));
                  }}
                  className="text-ink-soft hover:text-burgundy"
                >
                  delete
                </button>
              </div>
              <p className="font-script text-lg text-ink mt-2 leading-snug">
                {entry.note}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
