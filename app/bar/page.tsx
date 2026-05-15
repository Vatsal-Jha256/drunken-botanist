import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  allIngredientNames,
  canonicalIngredient,
  matchByBar,
} from "@/lib/cocktaildb";
import { BarChecklist } from "./bar-checklist";

export const dynamic = "force-dynamic";

export default async function BarPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/bar");

  const supabase = await createClient();
  const { data: barRows } = await supabase
    .from("bar_inventory")
    .select("ingredient_name");

  const bar = new Set<string>(
    (barRows ?? []).map((r) => canonicalIngredient(r.ingredient_name)),
  );

  const allNames = allIngredientNames();
  const { makeable, oneAway } = matchByBar(bar);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <p className="smallcaps text-xs text-ink-soft mb-2">your shelf</p>
        <h1 className="font-serif text-4xl text-ink">My Bar</h1>
        <p className="text-ink-soft text-sm mt-1">
          Check what you have. We&apos;ll tell you what you can pour.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-8">
        <section>
          <h2 className="font-serif text-2xl text-ink mb-3">Inventory</h2>
          <p className="text-xs text-ink-soft mb-3">
            {bar.size} of {allNames.length} ingredients on hand
          </p>
          <BarChecklist allNames={allNames} initialBar={[...bar]} />
        </section>

        <section className="space-y-8">
          <div>
            <h2 className="font-serif text-2xl text-ink mb-3">
              You can make {makeable.length === 1 ? "this" : `${makeable.length} drinks`}
            </h2>
            {makeable.length === 0 ? (
              <p className="text-ink-soft text-sm">
                Nothing yet. Check off a few of the basics — gin, vodka, lime, tonic — and watch
                the list bloom.
              </p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {makeable.slice(0, 30).map((c) => (
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
                      <div className="min-w-0 flex-1">
                        <p className="font-serif text-base text-ink leading-tight truncate">
                          {c.name}
                        </p>
                        <p className="text-xs text-ink-soft mt-1 truncate">
                          {c.category}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {oneAway.length > 0 && (
            <div>
              <h2 className="font-serif text-2xl text-ink mb-3">One ingredient away</h2>
              <ul className="space-y-2">
                {oneAway.slice(0, 12).map(({ cocktail, missing }) => (
                  <li
                    key={cocktail.id}
                    className="flex items-center justify-between gap-3 specimen-card rounded-sm px-3 py-2 text-sm"
                  >
                    <Link
                      href={`/cocktails/${cocktail.id}`}
                      className="hover:text-sage-deep truncate"
                    >
                      {cocktail.name}
                    </Link>
                    <span className="text-xs text-ink-soft italic shrink-0">
                      needs {missing}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
