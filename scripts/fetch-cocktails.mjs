#!/usr/bin/env node
/**
 * Walks TheCocktailDB free API a-z and writes a single JSON file
 * with the union of all returned drinks. Run with `npm run refresh-cocktails`.
 *
 * Free endpoints used:
 *   https://www.thecocktaildb.com/api/json/v1/1/search.php?f=<letter>
 *   https://www.thecocktaildb.com/api/json/v1/1/list.php?i=list  (ingredient list)
 *
 * Output:
 *   data/cocktails.json
 *   data/ingredients.json   (sorted unique list of all ingredient strings)
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const API = "https://www.thecocktaildb.com/api/json/v1/1";
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

function normalizeDrink(raw) {
  const ingredients = [];
  for (let i = 1; i <= 15; i++) {
    const ing = (raw[`strIngredient${i}`] ?? "").trim();
    const measure = (raw[`strMeasure${i}`] ?? "").trim();
    if (ing) ingredients.push({ name: ing, measure });
  }
  return {
    id: raw.idDrink,
    name: raw.strDrink,
    category: raw.strCategory ?? null,
    alcoholic: raw.strAlcoholic ?? null,
    glass: raw.strGlass ?? null,
    instructions: raw.strInstructions ?? null,
    image: raw.strDrinkThumb ?? null,
    iba: raw.strIBA ?? null,
    tags: (raw.strTags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    ingredients,
  };
}

async function fetchLetter(letter) {
  const res = await fetch(`${API}/search.php?f=${letter}`);
  if (!res.ok) throw new Error(`${letter}: ${res.status}`);
  const data = await res.json();
  return data.drinks ?? [];
}

async function main() {
  await mkdir(join(ROOT, "data"), { recursive: true });
  const byId = new Map();
  for (const l of LETTERS) {
    const drinks = await fetchLetter(l);
    for (const d of drinks) {
      if (!byId.has(d.idDrink)) byId.set(d.idDrink, normalizeDrink(d));
    }
    process.stdout.write(`  ${l}:${drinks.length}`);
  }
  process.stdout.write("\n");

  const cocktails = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));

  const ingredients = new Set();
  for (const c of cocktails) for (const i of c.ingredients) ingredients.add(i.name);
  const ingredientList = [...ingredients].sort((a, b) => a.localeCompare(b));

  await writeFile(
    join(ROOT, "data/cocktails.json"),
    JSON.stringify(cocktails, null, 2),
  );
  await writeFile(
    join(ROOT, "data/ingredients.json"),
    JSON.stringify(ingredientList, null, 2),
  );

  console.log(`\nWrote ${cocktails.length} cocktails, ${ingredientList.length} ingredients.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
