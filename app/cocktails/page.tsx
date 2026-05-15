import Link from "next/link";
import Image from "next/image";
import {
  searchCocktails,
  categories,
  alcoholicFlags,
  cocktails,
} from "@/lib/cocktaildb";

export const revalidate = 86400;

type SP = Promise<{ q?: string; category?: string; alcoholic?: string }>;

export default async function CocktailsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const results = searchCocktails(sp);
  const allCats = categories();
  const allAlc = alcoholicFlags();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <p className="smallcaps text-xs text-ink-soft mb-2">the collection</p>
        <h1 className="font-serif text-4xl text-ink">Cocktails</h1>
        <p className="text-ink-soft text-sm mt-1">
          {results.length} of {cocktails.length} drinks
        </p>
      </header>

      <form
        action="/cocktails"
        method="get"
        className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-8 items-end"
      >
        <label className="sm:col-span-2 block">
          <span className="smallcaps text-xs text-ink-soft">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Margarita, Negroni, gin…"
            className="mt-1 w-full bg-parchment-deep/40 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
          />
        </label>
        <label className="block">
          <span className="smallcaps text-xs text-ink-soft">Category</span>
          <select
            name="category"
            defaultValue={sp.category ?? ""}
            className="mt-1 w-full bg-parchment-deep/40 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
          >
            <option value="">All</option>
            {allCats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="smallcaps text-xs text-ink-soft">Style</span>
          <select
            name="alcoholic"
            defaultValue={sp.alcoholic ?? ""}
            className="mt-1 w-full bg-parchment-deep/40 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
          >
            <option value="">All</option>
            {allAlc.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-4 flex gap-2">
          <button
            type="submit"
            className="bg-sage text-parchment px-4 py-2 rounded-sm text-sm smallcaps hover:bg-sage-deep"
          >
            Filter
          </button>
          <Link
            href="/cocktails"
            className="px-4 py-2 rounded-sm text-sm smallcaps text-ink-soft hover:text-ink"
          >
            Clear
          </Link>
        </div>
      </form>

      {results.length === 0 ? (
        <p className="text-ink-soft text-center py-12">
          No drinks match. Try fewer filters.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cocktails/${c.id}`}
                className="specimen-card rounded-sm p-3 flex gap-3 h-full hover:border-sage transition-colors"
              >
                {c.image && (
                  <Image
                    src={c.image}
                    alt={c.name}
                    width={80}
                    height={80}
                    className="w-20 h-20 rounded-sm object-cover border border-paper-edge"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg text-ink leading-tight truncate">
                    {c.name}
                  </p>
                  <p className="text-xs text-ink-soft mt-1 truncate">{c.category}</p>
                  <p className="text-xs text-ink-soft mt-1 truncate">
                    {c.ingredients.slice(0, 3).map((i) => i.name).join(" · ")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
