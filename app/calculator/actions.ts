"use server";

import {
  rankRecipes,
  buildBill,
  type Inventory,
  type RecipeMatch,
  type BillLineItem,
  recipes,
  DEFAULT_UNLIMITED,
} from "@/lib/calculator";

export type CalcInput = {
  byCanonical: Record<string, number>;
  unlimited: string[]; // canonical names treated as unlimited
  servings: number;
  strictAlcohol: boolean; // true = only my alcohols; false = discovery
};

export type CalcOutput = {
  fullyMakeable: RecipeMatch[];
  oneAway: RecipeMatch[];
  twoAway: RecipeMatch[];
  recommendedAdditions: { canonical: string; category: string; unlocks: number }[];
};

function buildInventory(input: CalcInput): Inventory {
  return {
    byCanonical: input.byCanonical,
    unlimited: new Set([...DEFAULT_UNLIMITED, ...input.unlimited]),
  };
}

export async function calculate(input: CalcInput): Promise<CalcOutput> {
  const inv = buildInventory(input);
  const servings = Math.max(1, Math.min(50, Math.round(input.servings)));
  const ranked = rankRecipes(inv, {
    servings,
    strictAlcohol: input.strictAlcohol,
  });
  return {
    fullyMakeable: ranked.fullyMakeable.slice(0, 30),
    oneAway: ranked.oneAway.slice(0, 20),
    twoAway: ranked.twoAway.slice(0, 12),
    recommendedAdditions: ranked.recommendedAdditions,
  };
}

export type BillInput = {
  byCanonical: Record<string, number>;
  unlimited: string[];
  picks: { recipeId: string; servings: number }[];
};

export type BillOutput = {
  lineItems: BillLineItem[];
  totalDrinks: number;
};

export async function buildBillFromPicks(input: BillInput): Promise<BillOutput> {
  const inv = buildInventory({
    byCanonical: input.byCanonical,
    unlimited: input.unlimited,
    servings: 1,
    strictAlcohol: false,
  });
  const picks: { recipe: import("@/lib/calculator").Recipe; servings: number }[] = [];
  for (const p of input.picks) {
    const r = recipes.find((rr) => rr.id === p.recipeId);
    if (r) picks.push({ recipe: r, servings: p.servings });
  }
  return buildBill(inv, picks);
}
