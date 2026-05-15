import details from "@/data/ingredient-details.json";

export type IngredientDetail = {
  name: string;
  description: string | null;
  abv: number | null;
  type: string | null;
  alcoholic?: boolean;
};

const map = details as Record<string, IngredientDetail>;

export function ingredientDetail(name: string): IngredientDetail | null {
  return map[name.toLowerCase().trim()] ?? null;
}

export function ingredientImage(name: string, size: "small" | "medium" = "small"): string {
  const slug = name.replace(/\s+/g, "_");
  const suffix = size === "small" ? "-Small" : "";
  return `https://www.thecocktaildb.com/images/ingredients/${slug}${suffix}.png`;
}
