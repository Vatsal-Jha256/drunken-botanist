import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cocktailById } from "@/lib/cocktaildb";
import { botanicalBySlug, botanicals } from "@/lib/botanicals";
import { FieldNoteComposer } from "./field-note-composer";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/favorites");

  const supabase = await createClient();
  const [favRes, noteRes, savedRes, fieldNoteRes] = await Promise.all([
    supabase
      .from("favorites")
      .select("cocktail_id, saved_at")
      .order("saved_at", { ascending: false }),
    supabase
      .from("tasting_notes")
      .select("cocktail_id, note, rating, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_botanicals")
      .select("slug, saved_at")
      .order("saved_at", { ascending: false }),
    supabase
      .from("botanical_field_notes")
      .select("slug, note, observed_at, location, created_at")
      .order("observed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const favRows = favRes.data;
  const noteRows = noteRes.data;
  const fieldNoteRows = fieldNoteRes.data ?? [];
  const savedBotanicals = (savedRes.data ?? [])
    .map((r) => botanicalBySlug(r.slug))
    .filter((b): b is NonNullable<typeof b> => !!b);

  const favs = (favRows ?? [])
    .map((r) => cocktailById(r.cocktail_id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  const notesByCocktail = new Map<
    string,
    { note: string | null; rating: number | null; created_at: string }[]
  >();
  for (const n of noteRows ?? []) {
    if (!notesByCocktail.has(n.cocktail_id)) notesByCocktail.set(n.cocktail_id, []);
    notesByCocktail.get(n.cocktail_id)!.push(n);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <p className="smallcaps text-xs text-ink-soft mb-2">your collection</p>
        <h1 className="font-serif text-4xl text-ink">Notebook</h1>
        <p className="text-ink-soft text-sm mt-1">
          {favs.length} cocktails saved · {(noteRows ?? []).length} tasting notes ·{" "}
          {fieldNoteRows.length} field notes · {savedBotanicals.length} botanicals
        </p>
      </header>

      <section className="mb-8">
        <FieldNoteComposer
          botanicals={botanicals.map((b) => ({
            slug: b.slug,
            commonName: b.commonName,
            latinName: b.latinName,
          }))}
        />
      </section>

      {savedBotanicals.length > 0 && (
        <section className="mb-10">
          <h2 className="font-serif text-2xl text-ink mb-3">Herbarium</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {savedBotanicals.map((b) => (
              <li key={b.slug}>
                <Link
                  href={`/botanicals/${b.slug}`}
                  className="specimen-card rounded-sm p-4 block hover:border-sage transition-colors"
                >
                  <p className="smallcaps text-[10px] text-ink-soft">{b.family}</p>
                  <p className="font-serif text-lg text-ink mt-0.5">{b.commonName}</p>
                  <p className="italic text-xs text-ink-soft mt-0.5">{b.latinName}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {fieldNoteRows.length > 0 && (
        <section className="mb-10">
          <h2 className="font-serif text-2xl text-ink mb-3">Recent field notes</h2>
          <ul className="space-y-3">
            {fieldNoteRows.map((entry, index) => {
              const b = botanicalBySlug(entry.slug);
              if (!b) return null;
              return (
                <li key={`${entry.slug}-${entry.created_at}-${index}`} className="specimen-card rounded-md p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/botanicals/${entry.slug}`}
                      className="font-serif text-lg text-ink hover:text-sage-deep"
                    >
                      {b.commonName}
                    </Link>
                    <span className="text-xs text-ink-soft">
                      {entry.observed_at
                        ? new Date(`${entry.observed_at}T00:00:00`).toLocaleDateString()
                        : new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {entry.location && (
                    <p className="smallcaps text-[10px] text-ink-soft mt-1">
                      {entry.location}
                    </p>
                  )}
                  <p className="font-script text-lg text-ink mt-2 leading-snug">
                    {entry.note}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <h2 className="font-serif text-2xl text-ink mb-3">Saved cocktails</h2>

      {favs.length === 0 ? (
        <div className="specimen-card rounded-md p-8 text-center">
          <p className="text-ink-soft">
            Nothing saved yet.{" "}
            <Link href="/cocktails" className="link-underline">
              Browse cocktails
            </Link>{" "}
            and tap the heart.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {favs.map((c) => {
            const notes = notesByCocktail.get(c.id) ?? [];
            return (
              <li key={c.id} className="specimen-card rounded-md p-5">
                <div className="flex gap-4">
                  {c.image && (
                    <Image
                      src={c.image}
                      alt={c.name}
                      width={96}
                      height={96}
                      className="w-24 h-24 rounded-sm object-cover border border-paper-edge"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/cocktails/${c.id}`}
                      className="font-serif text-xl text-ink hover:text-sage-deep"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-ink-soft mt-1">{c.category}</p>
                    {notes.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {notes.slice(0, 2).map((n, idx) => (
                          <li key={idx} className="text-xs text-ink-soft">
                            <span className="text-amber">
                              {n.rating ? "★".repeat(n.rating) : ""}
                            </span>{" "}
                            <span className="font-script text-base text-ink">
                              {n.note}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
