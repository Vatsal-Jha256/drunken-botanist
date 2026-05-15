import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { botanicalBySlug } from "@/lib/botanicals";
import { cocktailsByIngredientNames } from "@/lib/cocktaildb";
import { getUser, isOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { WikipediaSummary } from "./wikipedia-summary";
import { SaveBotanicalButton } from "./save-button";
import { BotanicalFieldNotes } from "./field-notes";

export const dynamic = "force-dynamic";

export default async function BotanicalDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const b = botanicalBySlug(slug);
  if (!b) notFound();

  const relatedCocktails = cocktailsByIngredientNames(b.spirits);
  const user = await getUser();
  const owner = isOwner(user);
  const hasPrivateChapter =
    owner && existsSync(join(process.cwd(), "private", "book-excerpts", `${slug}.md`));

  let initialSaved = false;
  let initialFieldNotes: {
    id: string;
    note: string;
    observed_at: string | null;
    location: string | null;
    created_at: string;
  }[] = [];
  if (user) {
    const supabase = await createClient();
    const [savedRes, fieldNotesRes] = await Promise.all([
      supabase
        .from("saved_botanicals")
        .select("slug")
        .eq("slug", slug)
        .maybeSingle(),
      supabase
        .from("botanical_field_notes")
        .select("id, note, observed_at, location, created_at")
        .eq("slug", slug)
        .order("observed_at", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    initialSaved = !!savedRes.data;
    initialFieldNotes = fieldNotesRes.data ?? [];
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="smallcaps text-xs text-ink-soft mb-2">
        <Link href="/botanicals" className="hover:text-ink">
          ← back to field guide
        </Link>
      </p>

      <article className="specimen-card rounded-md p-6 sm:p-8 mb-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <p className="smallcaps text-xs text-ink-soft">{b.family}</p>
            <h1 className="font-serif text-4xl text-ink leading-tight mt-1">
              {b.commonName}
            </h1>
            <p className="italic text-ink-soft mt-1">{b.latinName}</p>
          </div>
          <span className="font-script text-3xl text-burgundy/60 leading-none">
            №
            <span className="text-2xl ml-0.5">
              {String(b.slug.length * 7).padStart(3, "0")}
            </span>
          </span>
        </div>
        <div className="divider-rule my-5" />
        <p className="text-ink leading-relaxed text-lg">{b.blurb}</p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {b.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {b.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] smallcaps px-2 py-0.5 rounded-full border border-paper-edge text-ink-soft"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <span />
          )}
          <SaveBotanicalButton slug={slug} initialSaved={initialSaved} signedIn={!!user} />
        </div>
      </article>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-ink mb-3">From Wikipedia</h2>
        <WikipediaSummary title={b.wikipedia} commonName={b.commonName} />
      </section>

      {hasPrivateChapter && (
        <section className="mb-10">
          <Link
            href={`/library/${slug}`}
            className="specimen-card block rounded-md p-4 hover:border-burgundy transition-colors"
          >
            <p className="smallcaps text-xs text-burgundy">Owner&apos;s reading room</p>
            <p className="font-serif text-lg text-ink mt-1">
              From The Drunken Botanist →
            </p>
            <p className="text-xs text-ink-soft mt-1">
              Chapter excerpt for {b.commonName}, only visible to you.
            </p>
          </Link>
        </section>
      )}

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-ink mb-1">Field notes</h2>
        <p className="text-ink-soft text-sm mb-3">
          Observations from gardens, markets, trails, and bottles with a plant in mind.
        </p>
        <BotanicalFieldNotes
          slug={slug}
          commonName={b.commonName}
          initialNotes={initialFieldNotes}
          signedIn={!!user}
        />
      </section>

      <section>
        <h2 className="font-serif text-2xl text-ink mb-3">
          Cocktails featuring {b.commonName.toLowerCase()}
        </h2>
        {relatedCocktails.length === 0 ? (
          <p className="text-ink-soft text-sm">
            No matches in the current collection — try searching the cocktails directly.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relatedCocktails.slice(0, 20).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cocktails/${c.id}`}
                  className="specimen-card rounded-sm p-3 flex gap-3 h-full hover:border-sage transition-colors"
                >
                  {c.image && (
                    <Image
                      src={c.image}
                      alt={c.name}
                      width={60}
                      height={60}
                      className="w-15 h-15 rounded-sm object-cover border border-paper-edge"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-serif text-base text-ink leading-tight truncate">
                      {c.name}
                    </p>
                    <p className="text-xs text-ink-soft mt-1 truncate">{c.category}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
