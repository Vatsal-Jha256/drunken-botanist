import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cocktailById } from "@/lib/cocktaildb";
import { botanicalSlugFor } from "@/lib/botanicals";
import { ingredientDetail, ingredientImage } from "@/lib/ingredient-details";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FavoriteButton } from "./favorite-button";
import { TastingNotes } from "./tasting-notes";
import { IngredientImage } from "./ingredient-image";

export const dynamic = "force-dynamic";

export default async function CocktailDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cocktail = cocktailById(id);
  if (!cocktail) notFound();

  const user = await getUser();
  let initialIsFavorite = false;
  let initialNotes: { id: string; note: string | null; rating: number | null; created_at: string }[] = [];

  if (user) {
    const supabase = await createClient();
    const [fav, notes] = await Promise.all([
      supabase.from("favorites").select("cocktail_id").eq("cocktail_id", id).maybeSingle(),
      supabase
        .from("tasting_notes")
        .select("id, note, rating, created_at")
        .eq("cocktail_id", id)
        .order("created_at", { ascending: false }),
    ]);
    initialIsFavorite = !!fav.data;
    initialNotes = notes.data ?? [];
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="smallcaps text-xs text-ink-soft mb-2">
        <Link href="/cocktails" className="hover:text-ink">
          ← back to cocktails
        </Link>
      </p>

      <header className="flex flex-col sm:flex-row gap-6 mb-8 relative">
        {cocktail.image && (
          <Image
            src={cocktail.image}
            alt={cocktail.name}
            width={300}
            height={300}
            className="rounded-sm border border-paper-edge w-full sm:w-60 h-auto"
            priority
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="smallcaps text-[10px] text-ink-soft">
            specimen № {cocktail.id.padStart(5, "0")}
          </p>
          <h1 className="font-serif text-4xl text-ink leading-tight mt-1">{cocktail.name}</h1>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs smallcaps text-ink-soft">
            {cocktail.category && <span>{cocktail.category}</span>}
            {cocktail.alcoholic && <span>· {cocktail.alcoholic}</span>}
            {cocktail.glass && <span>· {cocktail.glass}</span>}
            {cocktail.iba && <span>· IBA listed</span>}
          </div>
          <div className="mt-5">
            <FavoriteButton
              cocktailId={cocktail.id}
              initialIsFavorite={initialIsFavorite}
              signedIn={!!user}
            />
          </div>
        </div>
      </header>

      <section className="specimen-card rounded-md p-6 mb-8">
        <h2 className="font-serif text-xl text-ink mb-3">Ingredients</h2>
        <ul className="space-y-2">
          {cocktail.ingredients.map((i) => {
            const slug = botanicalSlugFor(i.name);
            const detail = ingredientDetail(i.name);
            return (
              <li
                key={i.name}
                className="flex items-center gap-3 border-b border-paper-edge/60 pb-2 last:border-0"
              >
                <IngredientImage src={ingredientImage(i.name)} alt="" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span>
                      {slug ? (
                        <Link
                          href={`/botanicals/${slug}`}
                          className="link-underline hover:text-sage-deep"
                        >
                          {i.name}
                        </Link>
                      ) : (
                        i.name
                      )}
                    </span>
                    <span className="font-script text-ink-soft text-lg">{i.measure}</span>
                  </div>
                  {detail && (detail.type || detail.abv) && (
                    <p className="text-[10px] smallcaps text-ink-soft mt-0.5 flex gap-2">
                      {detail.type && <span>{detail.type}</span>}
                      {detail.abv != null && <span>· {detail.abv}% ABV</span>}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {cocktail.instructions && (
        <section className="mb-10">
          <h2 className="font-serif text-xl text-ink mb-3">Method</h2>
          <p className="text-ink-soft leading-relaxed">{cocktail.instructions}</p>
        </section>
      )}

      <section>
        <h2 className="font-serif text-xl text-ink mb-1">Field observations</h2>
        <p className="text-xs text-ink-soft mb-3">
          Tasting notes recorded the way a botanist records a specimen — date, rating,
          observation.
        </p>
        <TastingNotes cocktailId={cocktail.id} initialNotes={initialNotes} signedIn={!!user} />
      </section>
    </div>
  );
}
