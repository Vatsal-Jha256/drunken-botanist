"use client";

import { useState, useTransition } from "react";
import { addBookNote } from "../actions";

export function SaveIndexedNote({
  title,
  page,
  snippet,
}: {
  title: string;
  page: number | null;
  snippet: string;
}) {
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending || saved}
      onClick={() => {
        startTransition(async () => {
          await addBookNote({
            kind: "snippet",
            page,
            title,
            snippet,
            note: "Saved from indexed plant passage.",
          });
          setSaved(true);
        });
      }}
      className="text-xs smallcaps text-sage-deep hover:text-burgundy disabled:opacity-60"
    >
      {saved ? "saved to reader notes" : pending ? "saving..." : "save indexed passage"}
    </button>
  );
}
