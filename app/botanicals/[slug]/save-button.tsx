"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleSavedBotanical } from "./actions";

export function SaveBotanicalButton({
  slug,
  initialSaved,
  signedIn,
}: {
  slug: string;
  initialSaved: boolean;
  signedIn: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Link href="/login" className="text-xs smallcaps text-ink-soft hover:text-ink">
        Sign in to save to your notebook
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setSaved((v) => !v);
        startTransition(() => toggleSavedBotanical(slug));
      }}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs border transition-colors ${
        saved
          ? "bg-sage/15 border-sage text-sage-deep"
          : "border-paper-edge text-ink-soft hover:bg-sage/10 hover:text-ink"
      }`}
    >
      <span aria-hidden>{saved ? "✓" : "+"}</span>
      <span className="smallcaps">{saved ? "in notebook" : "save to notebook"}</span>
    </button>
  );
}
