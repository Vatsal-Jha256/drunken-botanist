import botanicalsData from "@/data/botanicals.json";

export type Botanical = {
  slug: string;
  commonName: string;
  latinName: string;
  family: string;
  wikipedia: string;
  blurb: string;
  spirits: string[];
  tags: string[];
};

export const botanicals = botanicalsData as Botanical[];

const bySlug = new Map<string, Botanical>();
const slugByIngredient = new Map<string, string>();
const groupedByFamily: Record<string, Botanical[]> = {};

for (const b of botanicals) {
  bySlug.set(b.slug, b);
  (groupedByFamily[b.family] ??= []).push(b);
  for (const spirit of b.spirits) {
    slugByIngredient.set(spirit.toLowerCase().trim(), b.slug);
  }
}

for (const family of Object.keys(groupedByFamily)) {
  groupedByFamily[family].sort((a, b) => a.commonName.localeCompare(b.commonName));
}

export function botanicalSlugFor(ingredient: string): string | null {
  return slugByIngredient.get(ingredient.toLowerCase().trim()) ?? null;
}

export function botanicalBySlug(slug: string): Botanical | undefined {
  return bySlug.get(slug);
}

export function botanicalsGroupedByFamily(): Record<string, Botanical[]> {
  return groupedByFamily;
}
