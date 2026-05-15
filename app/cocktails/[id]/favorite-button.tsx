"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { toggleFavorite } from "./actions";

export function FavoriteButton({
  cocktailId,
  initialIsFavorite,
  signedIn,
}: {
  cocktailId: string;
  initialIsFavorite: boolean;
  signedIn: boolean;
}) {
  const [isFav, setIsFav] = useState(initialIsFavorite);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Link
        href="/login"
        className="text-sm smallcaps text-ink-soft hover:text-ink"
      >
        Sign in to save
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setIsFav((v) => !v);
        startTransition(() => toggleFavorite(cocktailId));
      }}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-colors border ${
        isFav
          ? "bg-burgundy text-parchment border-burgundy"
          : "bg-transparent text-burgundy border-burgundy/60 hover:bg-burgundy/10"
      }`}
    >
      <span aria-hidden>{isFav ? "♥" : "♡"}</span>
      <span className="smallcaps">{isFav ? "Saved" : "Save to favorites"}</span>
    </button>
  );
}
