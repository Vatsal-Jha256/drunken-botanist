import cocktailsData from "@/data/cocktails.json";

export type CocktailIngredient = { name: string; measure: string };

export type Cocktail = {
  id: string;
  name: string;
  category: string | null;
  alcoholic: string | null;
  glass: string | null;
  instructions: string | null;
  image: string | null;
  iba: string | null;
  tags: string[];
  ingredients: CocktailIngredient[];
};

export const cocktails = cocktailsData as Cocktail[];

const byId = new Map<string, Cocktail>();
for (const c of cocktails) byId.set(c.id, c);

const normalizedSearch = cocktails.map((cocktail) => ({
  cocktail,
  name: cocktail.name.toLowerCase(),
  category: cocktail.category?.toLowerCase() ?? "",
  alcoholic: cocktail.alcoholic?.toLowerCase() ?? "",
}));

const categoryList = [...new Set(cocktails.flatMap((c) => (c.category ? [c.category] : [])))]
  .sort();

const alcoholicFlagList = [
  ...new Set(cocktails.flatMap((c) => (c.alcoholic ? [c.alcoholic] : []))),
].sort();

const allIngredientList = (() => {
  // Dedupe by canonical (lower-cased) form, prefer the casing seen first.
  const byCanonical = new Map<string, string>();
  for (const c of cocktails) {
    for (const i of c.ingredients) {
      const k = canonicalIngredient(i.name);
      if (!byCanonical.has(k)) byCanonical.set(k, titleCase(i.name));
    }
  }
  return [...byCanonical.values()].sort((a, b) => a.localeCompare(b));
})();

const ingredientCocktails = new Map<string, Cocktail[]>();
for (const cocktail of cocktails) {
  for (const ingredient of cocktail.ingredients) {
    const key = canonicalIngredient(ingredient.name);
    const existing = ingredientCocktails.get(key);
    if (existing) existing.push(cocktail);
    else ingredientCocktails.set(key, [cocktail]);
  }
}

export function cocktailById(id: string): Cocktail | undefined {
  return byId.get(id);
}

export type CocktailQuery = {
  q?: string;
  category?: string;
  alcoholic?: string;
};

export function searchCocktails(query: CocktailQuery): Cocktail[] {
  const q = query.q?.toLowerCase().trim();
  const cat = query.category?.toLowerCase().trim();
  const alc = query.alcoholic?.toLowerCase().trim();
  return normalizedSearch
    .filter(({ name, category, alcoholic }) => {
      if (q && !name.includes(q)) return false;
      if (cat && category !== cat) return false;
      if (alc && alcoholic !== alc) return false;
      return true;
    })
    .map(({ cocktail }) => cocktail);
}

export function categories(): string[] {
  return categoryList;
}

export function alcoholicFlags(): string[] {
  return alcoholicFlagList;
}

export function allIngredientNames(): string[] {
  return allIngredientList;
}

function titleCase(s: string): string {
  return s
    .trim()
    .split(/(\s+)/)
    .map((w) => (w.match(/^\s+$/) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}

/**
 * Canonical ingredient name (lower-case, trimmed). Used as the storage key for
 * user bar inventory rows and for matching.
 */
export function canonicalIngredient(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Return cocktails the user can make given a set of canonical-ingredient names
 * they own, plus those they're one step away from completing.
 */
export function matchByBar(bar: Set<string>): {
  makeable: Cocktail[];
  oneAway: { cocktail: Cocktail; missing: string }[];
} {
  const makeable: Cocktail[] = [];
  const oneAway: { cocktail: Cocktail; missing: string }[] = [];
  for (const c of cocktails) {
    const missing = c.ingredients
      .map((i) => i.name)
      .filter((n) => !bar.has(canonicalIngredient(n)));
    if (missing.length === 0) makeable.push(c);
    else if (missing.length === 1) oneAway.push({ cocktail: c, missing: missing[0] });
  }
  makeable.sort((a, b) => a.name.localeCompare(b.name));
  oneAway.sort((a, b) => a.cocktail.name.localeCompare(b.cocktail.name));
  return { makeable, oneAway };
}

export function cocktailsByIngredientNames(names: string[]): Cocktail[] {
  const seen = new Set<string>();
  const matches: Cocktail[] = [];
  for (const name of names) {
    for (const cocktail of ingredientCocktails.get(canonicalIngredient(name)) ?? []) {
      if (seen.has(cocktail.id)) continue;
      seen.add(cocktail.id);
      matches.push(cocktail);
    }
  }
  return matches;
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
