#!/usr/bin/env node
/**
 * Walks TheCocktailDB free `search.php?i=NAME` endpoint for every unique
 * ingredient that appears in our cocktail dataset and stores the official
 * description + ABV. This is the data the premium API exposes wholesale; the
 * free API serves one ingredient at a time, which is enough for a one-time
 * build.
 *
 * Output: data/ingredient-details.json — keyed by lowercase ingredient name.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const API = "https://www.thecocktaildb.com/api/json/v1/1";

const cocktails = JSON.parse(await readFile(join(ROOT, "data/cocktails.json"), "utf8"));

// Build a deduped list of ingredient names (preserving the first casing).
const names = new Map();
for (const c of cocktails) {
  for (const i of c.ingredients) {
    const k = i.name.toLowerCase().trim();
    if (!names.has(k)) names.set(k, i.name.trim());
  }
}

console.log(`enriching ${names.size} ingredients…`);

const out = {};
let done = 0;

for (const [key, display] of names) {
  try {
    const res = await fetch(`${API}/search.php?i=${encodeURIComponent(display)}`);
    if (!res.ok) {
      out[key] = { name: display, description: null, abv: null, type: null };
      continue;
    }
    const data = await res.json();
    const ing = data.ingredients?.[0];
    if (!ing) {
      out[key] = { name: display, description: null, abv: null, type: null };
    } else {
      // Trim long descriptions to a short factual summary — the CocktailDB
      // descriptions are themselves Wikipedia-derived public summaries.
      const description = ing.strDescription
        ? ing.strDescription.split(/\n\n/)[0].trim().slice(0, 500)
        : null;
      out[key] = {
        name: ing.strIngredient ?? display,
        description,
        abv: ing.strABV ? Number(ing.strABV) : null,
        type: ing.strType ?? null,
        alcoholic: ing.strAlcohol === "Yes",
      };
    }
  } catch {
    out[key] = { name: display, description: null, abv: null, type: null };
  }
  done++;
  if (done % 25 === 0) process.stdout.write(` ${done}`);
  // gentle rate limit
  await new Promise((r) => setTimeout(r, 50));
}

await writeFile(
  join(ROOT, "data/ingredient-details.json"),
  JSON.stringify(out, null, 2),
);
console.log(`\nwrote data/ingredient-details.json (${Object.keys(out).length})`);
