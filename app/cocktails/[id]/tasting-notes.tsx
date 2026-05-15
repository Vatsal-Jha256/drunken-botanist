"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addTastingNote, deleteTastingNote } from "./actions";

type Note = {
  id: string;
  note: string | null;
  rating: number | null;
  created_at: string;
};

export function TastingNotes({
  cocktailId,
  initialNotes,
  signedIn,
}: {
  cocktailId: string;
  initialNotes: Note[];
  signedIn: boolean;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [text, setText] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <p className="text-ink-soft text-sm">
        <Link href="/login" className="link-underline">
          Sign in
        </Link>{" "}
        to keep tasting notes.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <form
        action={(formData) => {
          const noteValue = (formData.get("note") as string) ?? "";
          const ratingValue = rating;
          startTransition(async () => {
            await addTastingNote(cocktailId, noteValue, ratingValue);
            const optimistic = {
              id: crypto.randomUUID(),
              note: noteValue.trim() || null,
              rating: ratingValue,
              created_at: new Date().toISOString(),
            };
            setNotes((prev) => [optimistic, ...prev]);
            setText("");
            setRating(null);
          });
        }}
        className="specimen-card rounded-md p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <span className="smallcaps text-xs text-ink-soft">new entry</span>
          <fieldset className="flex gap-1" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating((r) => (r === n ? null : n))}
                className={`text-lg leading-none ${
                  rating && n <= rating ? "text-amber" : "text-paper-edge hover:text-amber/70"
                }`}
                aria-label={`${n} of 5`}
              >
                ★
              </button>
            ))}
          </fieldset>
        </div>
        <textarea
          name="note"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Slightly too sweet — try ¾ oz lime next time…"
          className="w-full bg-parchment-deep/30 border border-paper-edge rounded-sm px-3 py-2 text-sm font-script text-base focus:outline-none focus:border-sage resize-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="bg-sage text-parchment px-4 py-1.5 rounded-sm text-sm smallcaps hover:bg-sage-deep disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save note"}
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-ink-soft text-sm text-center py-6">
          No notes yet. Pour one and report back.
        </p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="specimen-card rounded-md p-4">
              <div className="flex items-center justify-between text-xs text-ink-soft">
                <span>
                  {n.rating
                    ? "★".repeat(n.rating) + "☆".repeat(5 - n.rating)
                    : "no rating"}
                </span>
                <span className="flex items-center gap-3">
                  <span>{new Date(n.created_at).toLocaleDateString()}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNotes((p) => p.filter((x) => x.id !== n.id));
                      startTransition(() => deleteTastingNote(n.id, cocktailId));
                    }}
                    className="text-ink-soft hover:text-burgundy"
                  >
                    delete
                  </button>
                </span>
              </div>
              {n.note && (
                <p className="font-script text-lg text-ink mt-2 leading-snug">
                  {n.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
