import Link from "next/link";
import Image from "next/image";
import { cocktails, pickRandom, type Cocktail } from "@/lib/cocktaildb";
import { botanicals, botanicalSlugFor } from "@/lib/botanicals";

export const revalidate = 3600;

function CocktailHero({ cocktail }: { cocktail: Cocktail }) {
  return (
    <article className="specimen-card rounded-md p-6 sm:p-8 flex flex-col sm:flex-row gap-6">
      {cocktail.image && (
        <div className="sm:w-64 shrink-0">
          <Image
            src={cocktail.image}
            alt={cocktail.name}
            width={400}
            height={400}
            className="rounded-sm border border-paper-edge w-full h-auto"
            priority
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="smallcaps text-xs text-ink-soft mb-1">tonight&apos;s pour</p>
        <h2 className="font-serif text-3xl sm:text-4xl text-ink leading-tight">
          {cocktail.name}
        </h2>
        <p className="text-sm text-ink-soft mt-1">
          {cocktail.category}
          {cocktail.glass ? ` · served in a ${cocktail.glass.toLowerCase()}` : null}
        </p>
        <ul className="mt-4 space-y-1 text-sm">
          {cocktail.ingredients.map((i) => {
            const slug = botanicalSlugFor(i.name);
            return (
              <li key={i.name} className="flex justify-between gap-3">
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
                <span className="font-script text-ink-soft text-base">{i.measure}</span>
              </li>
            );
          })}
        </ul>
        {cocktail.instructions && (
          <p className="mt-4 text-sm text-ink-soft leading-relaxed">
            {cocktail.instructions}
          </p>
        )}
        <div className="mt-6">
          <Link
            href={`/cocktails/${cocktail.id}`}
            className="text-sm smallcaps text-sage-deep hover:text-burgundy"
          >
            Full entry →
          </Link>
        </div>
      </div>
    </article>
  );
}

export default async function Home() {
  const tonight = pickRandom(cocktails);
  const featured = pickRandom(botanicals);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <section className="mb-12">
        <div className="text-center mb-10">
          <p className="smallcaps text-xs text-ink-soft mb-3">
            field notes from the home bar · for botanists who happen to drink
          </p>
          <h1 className="font-serif text-5xl sm:text-6xl text-ink leading-[1.05]">
            Every drink is a plant
            <span className="block font-script text-burgundy text-3xl sm:text-4xl mt-2">
              — eventually
            </span>
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-ink-soft">
            A field guide and working notebook for the botanist-at-the-bar. Trace any spirit,
            garnish or bitter back to its plant, log your own observations the way a naturalist
            would, and use the calculator to plan what you can actually pour for the people
            arriving tonight. {cocktails.length} cocktails indexed, {botanicals.length} plants catalogued.
          </p>
        </div>
        <CocktailHero cocktail={tonight} />
      </section>

      <div className="divider-rule my-12" />

      <section>
        <div className="flex items-end justify-between mb-6">
          <h2 className="font-serif text-2xl text-ink">
            From the field guide
            <span className="block text-sm text-ink-soft font-sans mt-1">
              {featured.commonName} — <em>{featured.latinName}</em>
            </span>
          </h2>
          <Link
            href="/botanicals"
            className="text-sm smallcaps text-sage-deep hover:text-burgundy"
          >
            All botanicals →
          </Link>
        </div>
        <article className="specimen-card rounded-md p-6 sm:p-8">
          <p className="text-ink-soft leading-relaxed">{featured.blurb}</p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="smallcaps text-ink-soft">{featured.family}</span>
            <Link
              href={`/botanicals/${featured.slug}`}
              className="smallcaps text-sage-deep hover:text-burgundy"
            >
              Read the entry →
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
