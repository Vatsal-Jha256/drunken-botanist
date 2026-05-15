"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addBookNote, deleteBookNote } from "./actions";

type BookNote = {
  id: string;
  kind: "bookmark" | "snippet";
  page: number | null;
  title: string | null;
  snippet: string | null;
  note: string | null;
  created_at: string;
};

export function BookNotesPanel({ initialNotes }: { initialNotes: BookNote[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [kind, setKind] = useState<"bookmark" | "snippet">("bookmark");
  const [page, setPage] = useState("");
  const [title, setTitle] = useState("");
  const [snippet, setSnippet] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function useSelectedText() {
    const selected = window.getSelection()?.toString().trim();
    if (selected) {
      setKind("snippet");
      setSnippet(selected);
    }
  }

  return (
    <aside className="space-y-4">
      <section className="specimen-card rounded-md p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="smallcaps text-[10px] text-burgundy">reader notes</p>
            <h2 className="font-serif text-2xl text-ink">Bookmarks</h2>
          </div>
          <div className="inline-flex rounded-sm border border-paper-edge overflow-hidden text-xs">
            {(["bookmark", "snippet"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={`px-2.5 py-1 smallcaps ${
                  kind === option
                    ? "bg-sage text-parchment"
                    : "bg-parchment-deep/30 text-ink-soft hover:text-ink"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <form
          action={() => {
            startTransition(async () => {
              setError(null);
              try {
                const saved = await addBookNote({
                  kind,
                  page: page ? Number(page) : null,
                  title,
                  snippet,
                  note,
                });
                if (!saved) return;
                setNotes((prev) => [saved, ...prev]);
                setPage("");
                setTitle("");
                setSnippet("");
                setNote("");
              } catch {
                setError("Could not save. Run migration 0003_book_notes.sql first.");
              }
            });
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-[90px_1fr] gap-3">
            <label className="block">
              <span className="smallcaps text-[10px] text-ink-soft">page</span>
              <input
                type="number"
                min="1"
                name="page"
                value={page}
                onChange={(event) => setPage(event.target.value)}
                className="mt-1 w-full bg-parchment-deep/30 border border-paper-edge rounded-sm px-2 py-2 text-sm focus:outline-none focus:border-sage"
              />
            </label>
            <label className="block">
              <span className="smallcaps text-[10px] text-ink-soft">label</span>
              <input
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Cinchona wars, page 301"
                className="mt-1 w-full bg-parchment-deep/30 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
              />
            </label>
          </div>

          {kind === "snippet" && (
            <label className="block">
              <span className="smallcaps text-[10px] text-ink-soft">snippet</span>
              <textarea
                name="snippet"
                value={snippet}
                onChange={(event) => setSnippet(event.target.value)}
                rows={4}
                placeholder="Paste the passage you want to keep..."
                className="mt-1 w-full bg-parchment-deep/30 border border-paper-edge rounded-sm px-3 py-2 text-sm font-serif focus:outline-none focus:border-sage resize-y"
              />
            </label>
          )}

          <label className="block">
            <span className="smallcaps text-[10px] text-ink-soft">your note</span>
            <textarea
              name="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Why this matters, cocktail idea, plant to look up..."
              className="mt-1 w-full bg-parchment-deep/30 border border-paper-edge rounded-sm px-3 py-2 text-sm font-script text-base focus:outline-none focus:border-sage resize-y"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={useSelectedText}
              className="text-xs smallcaps text-sage-deep hover:text-burgundy"
            >
              use selected text
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-sage text-parchment px-4 py-1.5 rounded-sm text-sm smallcaps hover:bg-sage-deep disabled:opacity-60"
            >
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
          {error && <p className="text-xs text-burgundy">{error}</p>}
        </form>
      </section>

      <section className="space-y-3">
        {notes.length === 0 ? (
          <div className="specimen-card rounded-md p-4 text-sm text-ink-soft">
            Add a page bookmark or paste a short passage from the PDF.
          </div>
        ) : (
          notes.map((entry) => (
            <article key={entry.id} className="specimen-card rounded-md p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="smallcaps text-[10px] text-burgundy">
                    {entry.kind}
                    {entry.page ? ` · p. ${entry.page}` : ""}
                  </p>
                  {entry.title && (
                    <h3 className="font-serif text-lg text-ink mt-0.5">{entry.title}</h3>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNotes((prev) => prev.filter((n) => n.id !== entry.id));
                    startTransition(() => deleteBookNote(entry.id));
                  }}
                  className="text-xs text-ink-soft hover:text-burgundy"
                >
                  delete
                </button>
              </div>
              {entry.snippet && (
                <blockquote className="mt-3 border-l-2 border-paper-edge pl-3 font-serif text-sm text-ink leading-relaxed">
                  {entry.snippet}
                </blockquote>
              )}
              {entry.note && (
                <p className="font-script text-lg text-ink mt-3 leading-snug">
                  {entry.note}
                </p>
              )}
              {entry.page && (
                <Link
                  href={`/library/pdf#page=${entry.page}`}
                  target="_blank"
                  className="inline-block mt-3 text-xs smallcaps text-sage-deep hover:text-burgundy"
                >
                  open page →
                </Link>
              )}
            </article>
          ))
        )}
      </section>
    </aside>
  );
}
