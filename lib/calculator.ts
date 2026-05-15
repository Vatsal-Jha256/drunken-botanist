import recipesData from "@/data/recipes.json";
import canonicalsData from "@/data/canonical-ingredients.json";

export type RecipeIngredient = {
  raw: string;
  name: string;
  canonical: string | null;
  qty: number | null;
  unit: string | null;
  ml: number | null;
};

export type Recipe = {
  id: string;
  source: "hotaling" | "cocktail_data" | "cocktaildb";
  name: string;
  bartender: string | null;
  bar: string | null;
  location: string | null;
  glass: string | null;
  garnish: string | null;
  preparation: string;
  ingredients: RecipeIngredient[];
};

export type Canonical = { name: string; category: string };

export const recipes = recipesData as Recipe[];
export const canonicalIngredients = canonicalsData as Canonical[];

// ─── inventory model ────────────────────────────────────────────────────────
//
// Strict interpretation: every ingredient in a recipe must be covered by
// either the user's listed inventory (by canonical) OR by an unlimited bucket
// the user explicitly toggled on. No silent passes for unmatched ingredients.

export type Inventory = {
  // canonical name → ml available
  byCanonical: Record<string, number>;
  // canonical names treated as effectively unlimited (always have enough)
  unlimited: Set<string>;
};

// Defaults — only true mixers globally available. The user toggles anything else.
export const DEFAULT_UNLIMITED = new Set(["Soda Water", "Tonic Water"]);

// Optional toggles users can flip on when they actually have the item.
export const OPTIONAL_UNLIMITED = [
  "Cola",
  "Lemon-Lime Soda",
  "Ginger Ale",
  "Ginger Beer",
  "Angostura Bitters",
  "Orange Bitters",
  "Peychaud's Bitters",
  "Bitters",
  "Salt",
  "Sugar",
  "Simple Syrup",
  "Honey Syrup",
] as const;

// Alcoholic categories. Recommendations must use at least one alcohol the
// user actually has unless the user opts into discovery mode.
const ALCOHOL_CATEGORIES = new Set(["spirit", "fortified", "liqueur"]);

const CANONICAL_CATEGORY = new Map<string, string>();
for (const c of canonicalIngredients) CANONICAL_CATEGORY.set(c.name, c.category);

export function isAlcoholic(canonical: string | null): boolean {
  if (!canonical) return false;
  return ALCOHOL_CATEGORIES.has(CANONICAL_CATEGORY.get(canonical) ?? "");
}

// Family hierarchy: if a recipe demands the "parent" canonical, any of these
// child canonicals in the user's inventory also satisfy it. e.g. user has
// Bourbon → can make recipes that call for generic Whiskey.
// (Recipe-asks-Bourbon-user-has-Whiskey is NOT supported: too generic.)
const CHILD_TO_PARENT: Record<string, string[]> = {
  Bourbon: ["Whiskey"],
  "Rye Whiskey": ["Whiskey"],
  Scotch: ["Whiskey"],
  "Irish Whiskey": ["Whiskey"],
  "Light Rum": ["Rum"],
  "Dark Rum": ["Rum"],
  "Spiced Rum": ["Rum"],
  "Gold Rum": ["Rum"],
  Cognac: ["Brandy"],
  "Apple Brandy": ["Brandy"],
  "Angostura Bitters": ["Bitters"],
  "Orange Bitters": ["Bitters"],
  "Peychaud's Bitters": ["Bitters"],
};
// Invert: which child canonicals can substitute for a given parent demand?
const PARENT_TO_CHILDREN = new Map<string, Set<string>>();
for (const [child, parents] of Object.entries(CHILD_TO_PARENT)) {
  for (const p of parents) {
    if (!PARENT_TO_CHILDREN.has(p)) PARENT_TO_CHILDREN.set(p, new Set());
    PARENT_TO_CHILDREN.get(p)!.add(child);
  }
}

/** Effective ml of `demanded` that the inventory can cover, including substitutions. */
function inventoryFor(inv: Inventory, demanded: string): { ml: number; via: string } {
  // direct
  if ((inv.byCanonical[demanded] ?? 0) > 0) {
    return { ml: inv.byCanonical[demanded], via: demanded };
  }
  // substitutes
  for (const child of PARENT_TO_CHILDREN.get(demanded) ?? []) {
    if ((inv.byCanonical[child] ?? 0) > 0) {
      return { ml: inv.byCanonical[child], via: child };
    }
  }
  return { ml: 0, via: demanded };
}

// ─── recipe evaluation ──────────────────────────────────────────────────────

export type IngredientCoverage = {
  raw: string;
  name: string;
  canonical: string | null;
  category: string | null;
  mlPerDrink: number;       // estimated ml (defaults to a small splash if unknown)
  mlNeeded: number;          // mlPerDrink × servings
  mlHave: number;            // 0 if not in inventory
  covered: boolean;
  unlimited: boolean;        // covered because in the unlimited set
  isAlcohol: boolean;
};

export type RecipeMatch = {
  recipe: Recipe;
  servings: number;
  coverage: IngredientCoverage[];
  uncovered: IngredientCoverage[];
  usesUserAlcohol: boolean;  // recipe uses at least one alcohol from inventory
  fullyMakeable: boolean;
  missingCount: number;
  /** ml shortfalls for ingredients the user has *some* of but not enough */
  shortfalls: IngredientCoverage[];
};

// Common-as-water staples that everyone has and that aren't volumetric in
// any cocktail-decisive way. Always considered covered.
const ALWAYS_FREE_NAME = new Set([
  "water", "ice", "ice cubes", "crushed ice", "hot water", "boiling water",
]);

// Names that, even with ml:null (unparsed measure), are clearly garnishes —
// produce, peel, herbs, pre-prepared items the user is expected to have on
// hand for a cocktail. These are NOT alcoholic.
const GARNISH_KEYWORDS = [
  "peel", "twist", "wedge", "slice", "wheel", "garnish", "sprig", "leaf",
  "leaves", "rind", "zest", "salt", "pepper", "cherry", "olive", "mint",
  "basil", "rosemary", "thyme", "cinnamon stick", "nutmeg", "lemon",
  "lime", "orange", "grapefruit", "cucumber", "strawberry", "blueberry",
  "raspberry", "blackberry", "egg", "egg white", "egg yolk", "ice",
];

function isGarnishLike(name: string): boolean {
  const n = name.toLowerCase();
  return GARNISH_KEYWORDS.some((k) => n.includes(k));
}

/**
 * "Garnish-or-staple" coverage — ingredient passes without inventory.
 *
 * Critical: an alcoholic ingredient with ml:null (an unparsed measure) is
 * NEVER free — we substitute a small default and require coverage. This is
 * what stops "(Claret) Red wine" and "1 tblsp Port" from sliding through
 * just because the measure didn't parse.
 */
function isAlwaysFree(ing: RecipeIngredient): boolean {
  const n = ing.name.toLowerCase().trim();
  if (ALWAYS_FREE_NAME.has(n)) return true;
  const alcoholic = isAlcoholic(ing.canonical);
  if (alcoholic) return false; // alcohol always requires coverage
  if (ing.ml == null) return isGarnishLike(ing.name);
  return false;
}

// When an alcoholic ingredient has ml:null (parser couldn't read the measure),
// assume a conservative splash so the calculator at least DEMANDS something.
const DEFAULT_ALCOHOL_FALLBACK_ML = 30; // 1 oz pour

export function evaluateRecipe(
  recipe: Recipe,
  inventory: Inventory,
  servings: number,
): RecipeMatch {
  const coverage: IngredientCoverage[] = [];
  let usesUserAlcohol = false;

  for (const ing of recipe.ingredients) {
    const category = ing.canonical ? CANONICAL_CATEGORY.get(ing.canonical) ?? null : null;
    const isAlcohol = isAlcoholic(ing.canonical);

    // Garnishes, water, ice, and other measure-less items pass for free.
    if (isAlwaysFree(ing)) {
      coverage.push({
        raw: ing.raw,
        name: ing.name,
        canonical: ing.canonical,
        category,
        mlPerDrink: 0,
        mlNeeded: 0,
        mlHave: Infinity,
        covered: true,
        unlimited: true,
        isAlcohol,
      });
      continue;
    }

    const mlPerDrink = ing.ml ?? DEFAULT_ALCOHOL_FALLBACK_ML;
    const mlNeeded = mlPerDrink * servings;
    const unlimited = !!(ing.canonical && inventory.unlimited.has(ing.canonical));
    // resolve inventory with substitutions (Bourbon → Whiskey demand, etc.)
    const { ml: mlHave, via } = ing.canonical
      ? inventoryFor(inventory, ing.canonical)
      : { ml: 0, via: ing.canonical ?? "" };
    const covered = unlimited || mlHave >= mlNeeded;

    if (covered && !unlimited && isAlcohol && mlHave > 0) {
      usesUserAlcohol = true;
    }

    coverage.push({
      raw: ing.raw,
      name: via && via !== ing.canonical ? `${ing.name} (using ${via})` : ing.name,
      canonical: ing.canonical,
      category,
      mlPerDrink,
      mlNeeded,
      mlHave,
      covered,
      unlimited,
      isAlcohol,
    });
  }

  const uncovered = coverage.filter((c) => !c.covered);
  const shortfalls = uncovered.filter((c) => c.mlHave > 0 && c.mlHave < c.mlNeeded);

  return {
    recipe,
    servings,
    coverage,
    uncovered,
    usesUserAlcohol,
    fullyMakeable: uncovered.length === 0,
    missingCount: uncovered.length,
    shortfalls,
  };
}

// ─── ranking ────────────────────────────────────────────────────────────────

export type RankOptions = {
  servings: number;
  /**
   * If true (default): recipes are filtered so that EVERY alcoholic
   * ingredient is one the user listed (or in their unlimited set). Mixers
   * and other non-alcoholic items can still be missing in 1-away results.
   * If false: discovery mode — any recipe is fair game as long as ≥1 of
   * the user's alcohols is used.
   */
  strictAlcohol?: boolean;
};

export type Ranked = {
  fullyMakeable: RecipeMatch[];
  oneAway: RecipeMatch[];
  twoAway: RecipeMatch[];
  /** Ingredients that, if added, would unlock the most additional recipes */
  recommendedAdditions: { canonical: string; category: string; unlocks: number }[];
};

export function rankRecipes(inventory: Inventory, opts: RankOptions): Ranked {
  const { servings, strictAlcohol = true } = opts;
  const userHasSomeAlcohol = Object.entries(inventory.byCanonical).some(
    ([c, ml]) => ml > 0 && isAlcoholic(c),
  );

  const all = recipes
    .filter((r) => r.ingredients.length >= 2)
    .map((r) => evaluateRecipe(r, inventory, servings));

  // In strict mode, recipes that need an alcohol the user doesn't have are
  // hidden entirely (not even shown in 1-away). In discovery mode, any recipe
  // that uses ≥1 of the user's alcohols is fair game.
  const passesAlcoholRule = (m: RecipeMatch) => {
    if (!userHasSomeAlcohol) return true; // no alcohol provided — anything goes
    if (!m.usesUserAlcohol) return false;
    if (!strictAlcohol) return true;
    // strict: every alcoholic uncovered ingredient is disqualifying
    return !m.uncovered.some((c) => c.isAlcohol);
  };

  const fullyMakeable = all
    .filter((m) => m.fullyMakeable && passesAlcoholRule(m))
    .sort((a, b) => {
      const d = b.recipe.ingredients.length - a.recipe.ingredients.length;
      return d !== 0 ? d : a.recipe.name.localeCompare(b.recipe.name);
    });

  const oneAway = all
    .filter((m) => m.missingCount === 1 && passesAlcoholRule(m))
    .sort((a, b) => b.recipe.ingredients.length - a.recipe.ingredients.length);

  const twoAway = all
    .filter((m) => m.missingCount === 2 && passesAlcoholRule(m))
    .sort((a, b) => b.recipe.ingredients.length - a.recipe.ingredients.length);

  // What single missing ingredients would unlock the most additional recipes?
  const unlockCount = new Map<string, number>();
  for (const m of oneAway) {
    const missing = m.uncovered[0];
    if (!missing.canonical) continue;
    unlockCount.set(missing.canonical, (unlockCount.get(missing.canonical) ?? 0) + 1);
  }
  const recommendedAdditions = [...unlockCount.entries()]
    .map(([canonical, unlocks]) => ({
      canonical,
      category: CANONICAL_CATEGORY.get(canonical) ?? "other",
      unlocks,
    }))
    .sort((a, b) => b.unlocks - a.unlocks)
    .slice(0, 8);

  return { fullyMakeable, oneAway, twoAway, recommendedAdditions };
}

// ─── shopping list / bill ───────────────────────────────────────────────────

export type BillLineItem = {
  canonical: string | null;
  displayName: string;
  category: string;     // "spirit" | "fortified" | "liqueur" | "bitters" | "mixer" | "syrup" | "other" | "garnish" | "specialty"
  totalMl: number;      // 0 for pure garnishes (count-based)
  totalCount: number;   // for garnishes — total pieces across the menu
  haveMl: number;
  shortfallMl: number;  // ml you still need to buy (0 if unlimited or garnish)
  fromRecipes: string[];
  unlimited: boolean;
  garnishOnly: boolean; // count-based item, not volumetric
};

/**
 * Aggregate every ingredient across the chosen menu — alcohol, mixers,
 * garnishes, syrups. Volumetric items sum to ml; garnishes count pieces.
 * Unlimited items appear too so you can see the total draw, but their
 * shortfall is always 0.
 */
export function buildBill(
  inventory: Inventory,
  picks: { recipe: Recipe; servings: number }[],
): { lineItems: BillLineItem[]; totalDrinks: number } {
  type Agg = {
    canonical: string | null;
    displayName: string;
    category: string;
    totalMl: number;
    totalCount: number;
    fromRecipes: Set<string>;
    unlimited: boolean;
    garnishOnly: boolean;
  };

  const agg = new Map<string, Agg>();
  let totalDrinks = 0;

  for (const { recipe, servings } of picks) {
    totalDrinks += servings;
    for (const ing of recipe.ingredients) {
      const key = ing.canonical ?? `~${ing.name.toLowerCase()}`;
      const isAlcohol = isAlcoholic(ing.canonical);
      // Decide if this is volumetric or a count-based garnish.
      const volumetric = ing.ml != null || isAlcohol; // alcohols always volumetric (use fallback)
      const mlPerDrink = ing.ml ?? (isAlcohol ? DEFAULT_ALCOHOL_FALLBACK_ML : 0);
      const mlNeeded = volumetric ? mlPerDrink * servings : 0;
      const countNeeded = volumetric ? 0 : servings; // 1 lemon peel × servings drinks

      const baseCategory = ing.canonical
        ? CANONICAL_CATEGORY.get(ing.canonical) ?? "other"
        : "specialty";
      const category = volumetric ? baseCategory : "garnish";
      const displayName = ing.canonical ?? ing.name;
      const unlimited = !!(ing.canonical && inventory.unlimited.has(ing.canonical));

      const existing = agg.get(key);
      if (existing) {
        existing.totalMl += mlNeeded;
        existing.totalCount += countNeeded;
        existing.fromRecipes.add(recipe.name);
      } else {
        agg.set(key, {
          canonical: ing.canonical,
          displayName,
          category,
          totalMl: mlNeeded,
          totalCount: countNeeded,
          fromRecipes: new Set([recipe.name]),
          unlimited,
          garnishOnly: !volumetric,
        });
      }
    }
  }

  const lineItems: BillLineItem[] = [...agg.values()]
    .map((a) => {
      const haveMl = a.canonical ? inventory.byCanonical[a.canonical] ?? 0 : 0;
      const shortfallMl =
        a.unlimited || a.garnishOnly ? 0 : Math.max(0, a.totalMl - haveMl);
      return {
        canonical: a.canonical,
        displayName: a.displayName,
        category: a.category,
        totalMl: Math.round(a.totalMl),
        totalCount: a.totalCount,
        haveMl: Math.round(haveMl),
        shortfallMl: Math.round(shortfallMl),
        fromRecipes: [...a.fromRecipes],
        unlimited: a.unlimited,
        garnishOnly: a.garnishOnly,
      };
    })
    .sort((a, b) => {
      const order = (li: BillLineItem) => {
        if (li.category === "spirit") return 0;
        if (li.category === "fortified") return 1;
        if (li.category === "liqueur") return 2;
        if (li.category === "bitters") return 3;
        if (li.category === "syrup") return 4;
        if (li.category === "mixer") return 5;
        if (li.category === "garnish") return 7;
        return 6;
      };
      const d = order(a) - order(b);
      if (d !== 0) return d;
      return b.totalMl - a.totalMl;
    });

  return { lineItems, totalDrinks };
}

// ─── helpers ────────────────────────────────────────────────────────────────

export function mlToBottles(ml: number, bottleMl = 750): string {
  if (ml <= 0) return "—";
  const bottles = ml / bottleMl;
  if (bottles >= 1) {
    const whole = Math.floor(bottles);
    const rest = ml - whole * bottleMl;
    if (rest < 30) return `${whole} ${whole === 1 ? "bottle" : "bottles"}`;
    return `${whole}× ${bottleMl}ml + ${Math.round(rest)}ml`;
  }
  return `${Math.round(ml)} ml (< 1 bottle)`;
}
