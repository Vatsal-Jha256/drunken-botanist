#!/usr/bin/env node
/**
 * Build-time parser that turns the raw CSV datasets in private/datasets/
 * into a single structured JSON file the calculator can score against.
 *
 * - Hotaling: 1400+ bar-quality recipes with consistent oz measures
 * - cocktail_data: ~580 drinks with shot-based measures
 * - existing data/cocktails.json: ~426 CocktailDB drinks
 *
 * Outputs:
 *   data/recipes.json              — unified recipe list
 *   data/canonical-ingredients.json — canonical names + aliases the calculator picks from
 *
 * Only factual structured data is kept (ingredient list with quantities, glass,
 * garnish, brief preparation). Long creative bartender notes are dropped.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";

const ROOT = new URL("..", import.meta.url).pathname;

// ─── unit conversions to ml ────────────────────────────────────────────────
const ML = {
  oz: 29.5735,
  ounce: 29.5735,
  ounces: 29.5735,
  ml: 1,
  cl: 10,
  dl: 100,
  l: 1000,
  liter: 1000,
  tsp: 4.92892,
  teaspoon: 4.92892,
  tbsp: 14.7868,
  tbl: 14.7868,
  tblsp: 14.7868,
  tbls: 14.7868,
  tablespoon: 14.7868,
  cup: 236.588,
  shot: 44.36, // 1.5 oz
  shots: 44.36,
  jigger: 44.36,
  pony: 22.18, // 0.75 oz
  dash: 0.92,
  dashes: 0.92,
  drop: 0.05,
  drops: 0.05,
  splash: 5,
  bar: 5,
  barspoon: 5,
  bsp: 5,
  // cosmetic / very small — treated as ~half a splash
  mist: 2,
  top: 30, // top-off ~1 oz
  rinse: 5,
  float: 15,
  part: 30, // arbitrary, used when recipe is "1 part X 2 parts Y"
  parts: 30,
  // qualitative wine measures — when a recipe says "(Claret) Red wine" or
  // "Red wine fill", treat as a typical wine pour.
  fill: 90,
  pour: 90,
};

function fractionToFloat(s) {
  s = s.trim();
  if (s.includes("/")) {
    // mixed: "1 1/2" or simple: "3/4"
    const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return +mixed[1] + +mixed[2] / +mixed[3];
    const simple = s.match(/^(\d+)\/(\d+)$/);
    if (simple) return +simple[1] / +simple[2];
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const QUALITATIVE = new Set(["top", "rinse", "float", "mist", "splash", "dash", "drop"]);

/**
 * Parse a single ingredient string into { qty, unit, name, ml, raw }.
 * Examples:
 *   "1.5 oz Mezcal"               → { qty:1.5, unit:"oz", name:"Mezcal", ml:44.36 }
 *   ".5 oz Lime Juice"            → { qty:0.5, unit:"oz", name:"Lime Juice", ml:14.79 }
 *   "top Soda Water"              → { qty:1, unit:"top", name:"Soda Water", ml:30 }
 *   "4 dash Forgery Bitters"      → { qty:4, unit:"dash", name:"Forgery Bitters", ml:3.68 }
 *   "1 Shot Vodka"                → { qty:1, unit:"shot", name:"Vodka", ml:44.36 }
 *   "1 3/4 shot Gin"              → { qty:1.75, unit:"shot", name:"Gin", ml:77.6 }
 */
function parseIngredient(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Pattern: optional qty (number/fraction/mixed), optional unit, then name.
  // Also handles qualitative leading word ("top X", "mist X").
  const re =
    /^(?:(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)\s*)?([a-zA-Z]+\.?)?\s*(.+?)$/;
  const m = trimmed.match(re);
  if (!m) return { qty: null, unit: null, name: trimmed, ml: null, raw: trimmed };

  let qtyRaw = m[1];
  let unitRaw = (m[2] ?? "").toLowerCase().replace(/\.$/, "");
  let name = m[3]?.trim();

  // Edge case: leading qualitative word with no number ("top Soda Water")
  if (!qtyRaw && QUALITATIVE.has(unitRaw)) {
    qtyRaw = "1";
  }

  // Edge case: unit didn't match a known unit — treat as part of the name
  if (unitRaw && !(unitRaw in ML)) {
    name = `${unitRaw} ${name}`.trim();
    unitRaw = null;
  }

  const qty = qtyRaw ? fractionToFloat(qtyRaw) : null;
  const unit = unitRaw || null;
  const ml = qty != null && unit && ML[unit] ? +(qty * ML[unit]).toFixed(2) : null;

  return { qty, unit, name: name.replace(/\*+$/, "").trim(), ml, raw: trimmed };
}

function splitIngredients(s) {
  // Hotaling separates with commas, but commas can appear inside parenthetical
  // brand names. Conservative: split on commas not inside parens.
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

// ─── canonical ingredient registry (token-based) ───────────────────────────
// The calculator works against canonical buckets. "Junipero Gin" → "Gin".
//
// Each rule requires ALL of `requires`, and (if present) at least one of
// `oneOf`, and rejects anything containing `excludes`. Rules are evaluated
// top-to-bottom — put specific rules before general ones.
const CANONICAL = [
  // Spirits
  { name: "Sloe Gin", category: "spirit", requires: ["sloe", "gin"] },
  { name: "Vodka", category: "spirit", requires: ["vodka"] },
  { name: "Gin", category: "spirit", requires: ["gin"], excludes: ["sloe", "ginger"] },
  { name: "Junipero Gin → Gin", _alias: "Gin", category: "spirit", requires: ["junipero"] },
  { name: "Cachaça", category: "spirit", requires: ["cachaca"] },
  { name: "Cachaça", category: "spirit", requires: ["cachaça"] },
  { name: "Mezcal", category: "spirit", requires: ["mezcal"] },
  { name: "Tequila", category: "spirit", requires: ["tequila"] },
  { name: "Pisco", category: "spirit", requires: ["pisco"] },
  { name: "Light Rum", category: "spirit", requires: ["rum"], oneOf: ["light", "white", "silver", "blanco"] },
  { name: "Dark Rum", category: "spirit", requires: ["rum"], oneOf: ["dark", "blackstrap", "navy"] },
  { name: "Spiced Rum", category: "spirit", requires: ["rum"], oneOf: ["spiced"] },
  { name: "Gold Rum", category: "spirit", requires: ["rum"], oneOf: ["gold", "aged", "añejo", "anejo", "amber"] },
  { name: "Rum", category: "spirit", requires: ["rum"], excludes: ["151"] },
  { name: "Bourbon", category: "spirit", requires: ["bourbon"] },
  { name: "Bourbon", category: "spirit", oneOf: ["jim", "wild", "knob", "buffalo", "maker's", "makers", "elijah", "old", "evan", "weller", "rowans"], requires: [], excludes: ["scotch", "irish", "rye", "japanese"] },
  { name: "Rye Whiskey", category: "spirit", requires: ["rye"], oneOf: ["whiskey", "whisky"] },
  { name: "Rye Whiskey", category: "spirit", requires: ["rye"], excludes: ["bread"] },
  { name: "Scotch", category: "spirit", requires: ["scotch"] },
  { name: "Scotch", category: "spirit", oneOf: ["glenrothes", "glenfiddich", "macallan", "lagavulin", "laphroaig", "talisker", "balvenie", "highland", "speyside", "islay"] },
  { name: "Irish Whiskey", category: "spirit", oneOf: ["irish"], requires: ["whiskey"] },
  { name: "Irish Whiskey", category: "spirit", oneOf: ["jameson", "tullamore", "bushmills", "redbreast"] },
  { name: "Japanese Whisky → Whiskey", _alias: "Whiskey", category: "spirit", oneOf: ["nikka", "suntory", "yamazaki", "hibiki"] },
  { name: "Whiskey", category: "spirit", oneOf: ["whiskey", "whisky"], excludes: ["sour mix"] },
  { name: "Apple Brandy", category: "spirit", requires: ["apple", "brandy"] },
  { name: "Apple Brandy", category: "spirit", oneOf: ["calvados", "applejack"] },
  { name: "Cherry Liqueur", category: "liqueur", requires: ["cherry"], oneOf: ["heering", "liqueur", "brandy"] },
  { name: "Cherry Liqueur", category: "liqueur", requires: ["maraschino", "liqueur"] },
  { name: "Cherry Liqueur", category: "liqueur", requires: ["luxardo"], excludes: ["amaro", "amaretto", "triplum", "bitter", "vermouth"] },
  { name: "Apricot Liqueur", category: "liqueur", requires: ["apricot"] },
  { name: "Peach Liqueur", category: "liqueur", requires: ["peach"], oneOf: ["schnapps", "liqueur"] },
  { name: "Coffee Liqueur", category: "liqueur", oneOf: ["kahlua", "kahlúa"] },
  { name: "Coffee Liqueur", category: "liqueur", requires: ["tia"], oneOf: ["maria"] },
  { name: "Coffee Liqueur", category: "liqueur", requires: ["coffee", "liqueur"] },
  { name: "Coffee Liqueur", category: "liqueur", requires: ["coffee", "brandy"] },
  { name: "Brandy", category: "spirit", requires: ["brandy"], excludes: ["apple", "cherry", "apricot", "peach", "coffee", "blackberry"] },
  { name: "Cognac", category: "spirit", requires: ["cognac"] },
  { name: "Cognac", category: "spirit", oneOf: ["hennessy", "courvoisier", "remy", "rémy", "martell", "vsop"] },
  // Vermouth / aromatized
  { name: "Sweet Vermouth", category: "fortified", requires: ["vermouth"], oneOf: ["sweet", "rosso", "rouge", "italian"] },
  { name: "Dry Vermouth", category: "fortified", requires: ["vermouth"], oneOf: ["dry", "french", "extra"] },
  { name: "Sweet Vermouth", category: "fortified", requires: ["vermouth"], oneOf: ["torino", "carpano", "antica", "dolin"] },
  { name: "Vermouth", category: "fortified", requires: ["vermouth"] },
  { name: "Lillet Blanc", category: "fortified", requires: ["lillet"] },
  { name: "Sherry", category: "fortified", requires: ["sherry"] },
  { name: "Sherry", category: "fortified", oneOf: ["fino", "amontillado", "oloroso", "manzanilla", "palo cortado"] },
  { name: "Port", category: "fortified", requires: ["port"], excludes: ["passport", "newport", "porter"] },
  { name: "Champagne", category: "fortified", oneOf: ["champagne", "prosecco", "cava", "sparkling"] },
  { name: "Red Wine", category: "fortified", requires: ["red"], oneOf: ["wine"] },
  { name: "White Wine", category: "fortified", requires: ["white"], oneOf: ["wine"] },
  // Liqueurs / amari
  { name: "Aperol", category: "liqueur", requires: ["aperol"] },
  { name: "Campari", category: "liqueur", requires: ["campari"] },
  { name: "Triple Sec", category: "liqueur", oneOf: ["triple sec", "curacao", "curaçao", "triplum"] },
  { name: "Cointreau", category: "liqueur", requires: ["cointreau"] },
  { name: "Grand Marnier", category: "liqueur", requires: ["grand"], oneOf: ["marnier"] },
  { name: "Chartreuse", category: "liqueur", requires: ["chartreuse"] },
  { name: "St. Germain", category: "liqueur", oneOf: ["germain", "germaine", "elderflower"] },
  { name: "Amaretto", category: "liqueur", requires: ["amaretto"] },
  { name: "Crème de Cassis", category: "liqueur", oneOf: ["cassis"] },
  { name: "Crème de Mure", category: "liqueur", oneOf: ["mure", "mûre"] },
  { name: "Crème de Menthe", category: "liqueur", requires: ["menthe"] },
  { name: "Crème de Cacao", category: "liqueur", requires: ["cacao"] },
  { name: "Absinthe", category: "liqueur", requires: ["absinthe"] },
  { name: "Absinthe", category: "liqueur", oneOf: ["pernod", "ricard", "pastis", "herbsaint"] },
  { name: "Drambuie", category: "liqueur", requires: ["drambuie"] },
  { name: "Benedictine", category: "liqueur", oneOf: ["benedictine", "bénédictine"] },
  { name: "Falernum", category: "liqueur", requires: ["falernum"] },
  { name: "Amaro", category: "liqueur", requires: ["amaro"] },
  { name: "Amaro", category: "liqueur", oneOf: ["montenegro", "averna", "fernet", "nonino", "ramazzotti", "lucano"] },
  // Bitters
  { name: "Angostura Bitters", category: "bitters", requires: ["angostura"] },
  { name: "Orange Bitters", category: "bitters", requires: ["orange", "bitters"] },
  { name: "Peychaud's Bitters", category: "bitters", requires: ["peychaud"] },
  { name: "Bitters", category: "bitters", requires: ["bitters"] },
  // Juices / mixers
  { name: "Lemon Juice", category: "mixer", requires: ["lemon"], oneOf: ["juice"] },
  { name: "Lime Juice", category: "mixer", requires: ["lime"], oneOf: ["juice"] },
  { name: "Orange Juice", category: "mixer", requires: ["orange"], oneOf: ["juice"] },
  { name: "Grapefruit Juice", category: "mixer", requires: ["grapefruit"] },
  { name: "Pineapple Juice", category: "mixer", requires: ["pineapple"], oneOf: ["juice"] },
  { name: "Cranberry Juice", category: "mixer", requires: ["cranberry"] },
  { name: "Tomato Juice", category: "mixer", requires: ["tomato"], oneOf: ["juice"] },
  { name: "Apple Juice", category: "mixer", requires: ["apple"], oneOf: ["juice"] },
  { name: "Coconut Cream", category: "other", requires: ["coconut"], oneOf: ["cream", "milk"] },
  // Syrups
  { name: "Honey Syrup", category: "syrup", requires: ["honey"] },
  { name: "Agave Syrup", category: "syrup", requires: ["agave"] },
  { name: "Maple Syrup", category: "syrup", requires: ["maple"] },
  { name: "Grenadine", category: "syrup", requires: ["grenadine"] },
  { name: "Orgeat", category: "syrup", requires: ["orgeat"] },
  { name: "Ginger Syrup", category: "syrup", requires: ["ginger"], oneOf: ["syrup"] },
  { name: "Simple Syrup", category: "syrup", requires: ["simple"], oneOf: ["syrup"] },
  { name: "Simple Syrup", category: "syrup", requires: ["sugar"], oneOf: ["syrup"] },
  { name: "Simple Syrup", category: "syrup", oneOf: ["demerara"] },
  // Carbonated
  { name: "Ginger Beer", category: "mixer", requires: ["ginger", "beer"] },
  { name: "Ginger Ale", category: "mixer", requires: ["ginger", "ale"] },
  { name: "Soda Water", category: "mixer", oneOf: ["club soda", "soda water", "seltzer", "carbonated water"] },
  { name: "Tonic Water", category: "mixer", requires: ["tonic"] },
  { name: "Cola", category: "mixer", oneOf: ["coca-cola", "coke", "cola", "pepsi"] },
  { name: "Lemon-Lime Soda", category: "mixer", oneOf: ["sprite", "7up", "7-up"] },
  // Other
  { name: "Egg White", category: "other", requires: ["egg", "white"] },
  { name: "Heavy Cream", category: "other", oneOf: ["heavy cream", "whipping cream", "double cream"] },
  { name: "Milk", category: "other", requires: ["milk"], excludes: ["coconut"] },
  { name: "Milk", category: "other", oneOf: ["half-and-half", "half and half"] },
  { name: "Espresso", category: "other", oneOf: ["espresso"] },
  { name: "Salt", category: "other", requires: ["salt"] },
  { name: "Sugar", category: "other", requires: ["sugar"], excludes: ["syrup"] },
];

// Strip diacritics + lowercase
function normalize(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function tokenize(s) {
  return new Set(normalize(s).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean));
}

// Build clean rules with normalized token sets for fast matching.
const RULES = CANONICAL.map((c) => ({
  canonical: c._alias ?? c.name,
  category: c.category,
  requires: (c.requires ?? []).map(normalize),
  oneOf: (c.oneOf ?? []).map(normalize),
  excludes: (c.excludes ?? []).map(normalize),
}));

function tokenSetIncludesPhrase(text, phrase) {
  // For single-token phrases, check token set; for multi-token, check raw string substring.
  if (!phrase.includes(" ")) {
    return text.tokens.has(phrase);
  }
  return text.raw.includes(phrase);
}

function canonicalize(name) {
  if (!name) return null;
  const raw = normalize(name);
  const tokens = tokenize(name);
  const text = { raw, tokens };
  for (const r of RULES) {
    if (r.requires.length && !r.requires.every((p) => tokenSetIncludesPhrase(text, p))) continue;
    if (r.oneOf.length && !r.oneOf.some((p) => tokenSetIncludesPhrase(text, p))) continue;
    if (r.excludes.length && r.excludes.some((p) => tokenSetIncludesPhrase(text, p))) continue;
    return r.canonical;
  }
  return null;
}

// Distinct canonical list for the output JSON.
const CANONICAL_LIST_SEEN = new Set();
const CANONICAL_LIST = [];
for (const r of RULES) {
  if (CANONICAL_LIST_SEEN.has(r.canonical)) continue;
  CANONICAL_LIST_SEEN.add(r.canonical);
  CANONICAL_LIST.push({ name: r.canonical, category: r.category });
}

// ─── parsers per dataset ───────────────────────────────────────────────────

function parseHotaling(rows) {
  const out = [];
  for (const r of rows) {
    const ingredientsRaw = (r["Ingredients"] ?? "").trim();
    if (!ingredientsRaw) continue;
    const parts = splitIngredients(ingredientsRaw);
    const ingredients = parts.map(parseIngredient).filter(Boolean);
    if (ingredients.length === 0) continue;
    const prep = (r["Preparation"] ?? "").trim().split(/\r?\n/)[0]?.slice(0, 240) ?? "";
    out.push({
      source: "hotaling",
      name: (r["Cocktail Name"] ?? "").trim(),
      bartender: (r["Bartender"] ?? "").trim() || null,
      bar: (r["Bar/Company"] ?? "").trim() || null,
      location: (r["Location"] ?? "").trim() || null,
      glass: (r["Glassware"] ?? "").trim() || null,
      garnish: (r["Garnish"] ?? "").trim() || null,
      preparation: prep,
      ingredients: ingredients.map((i) => ({
        raw: i.raw,
        name: i.name,
        canonical: canonicalize(i.name),
        qty: i.qty,
        unit: i.unit,
        ml: i.ml,
      })),
    });
  }
  return out;
}

function parseCocktailData(rows) {
  const out = [];
  for (const r of rows) {
    const ingredientsRaw = (r["ingredients_and_quantities"] ?? "").trim();
    if (!ingredientsRaw) continue;
    const parts = splitIngredients(ingredientsRaw)
      .map((p) => p.replace(/\s*-\s*/, " "))
      .filter(Boolean);
    const ingredients = parts.map(parseIngredient).filter(Boolean);
    if (ingredients.length === 0) continue;
    out.push({
      source: "cocktail_data",
      name: (r["drink"] ?? "").trim(),
      bartender: null,
      bar: null,
      location: null,
      glass: (r["glass"] ?? "").trim() || null,
      garnish: null,
      preparation: ((r["instructions"] ?? "").trim()).slice(0, 240),
      ingredients: ingredients.map((i) => ({
        raw: i.raw,
        name: i.name,
        canonical: canonicalize(i.name),
        qty: i.qty,
        unit: i.unit,
        ml: i.ml,
      })),
    });
  }
  return out;
}

function parseCocktailDb(cocktails) {
  // Reuse the existing data/cocktails.json — pull measures + names, canonicalize
  const out = [];
  for (const c of cocktails) {
    const ingredients = c.ingredients.map((i) => {
      const parsed = parseIngredient(`${i.measure} ${i.name}`.trim()) ?? { qty: null, unit: null, name: i.name, ml: null, raw: i.measure };
      // Force the name to the structured name (parseIngredient may strip too much)
      parsed.name = i.name;
      return {
        raw: `${i.measure} ${i.name}`.trim(),
        name: i.name,
        canonical: canonicalize(i.name),
        qty: parsed.qty,
        unit: parsed.unit,
        ml: parsed.ml,
      };
    });
    out.push({
      source: "cocktaildb",
      id: c.id,
      name: c.name,
      bartender: null,
      bar: null,
      location: null,
      glass: c.glass,
      garnish: null,
      preparation: (c.instructions ?? "").slice(0, 240),
      ingredients,
    });
  }
  return out;
}

// ─── main ──────────────────────────────────────────────────────────────────
async function main() {
  const all = [];

  const hotPath = join(ROOT, "private/datasets/hotaling_cocktails - Cocktails.csv");
  if (existsSync(hotPath)) {
    const rows = parse(await readFile(hotPath, "utf8"), {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    });
    const parsed = parseHotaling(rows);
    console.log(`hotaling: ${parsed.length} recipes`);
    all.push(...parsed);
  }

  const cdPath = join(ROOT, "private/datasets/cocktail_data.csv");
  if (existsSync(cdPath)) {
    const rows = parse(await readFile(cdPath, "utf8"), {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    });
    const parsed = parseCocktailData(rows);
    console.log(`cocktail_data: ${parsed.length} recipes`);
    all.push(...parsed);
  }

  const dbPath = join(ROOT, "data/cocktails.json");
  if (existsSync(dbPath)) {
    const db = JSON.parse(await readFile(dbPath, "utf8"));
    const parsed = parseCocktailDb(db);
    console.log(`cocktaildb: ${parsed.length} recipes`);
    all.push(...parsed);
  }

  // Dedupe by (name, ingredient-set) — keep the version with the most ml data
  const seen = new Map();
  for (const r of all) {
    const key = (r.name ?? "").toLowerCase().trim() + "|" + r.ingredients.length;
    const score = r.ingredients.filter((i) => i.ml != null).length;
    const existing = seen.get(key);
    if (!existing || score > existing.score) seen.set(key, { r, score });
  }
  const deduped = [...seen.values()].map((v) => v.r);

  // Assign stable ids
  const recipes = deduped.map((r, idx) => ({ id: `r${idx}`, ...r }));

  // Coverage stats: how many recipes have at least one canonical ingredient?
  const withCanonical = recipes.filter((r) => r.ingredients.some((i) => i.canonical));
  console.log(`total: ${recipes.length} recipes, ${withCanonical.length} with ≥1 canonical match`);

  await writeFile(join(ROOT, "data/recipes.json"), JSON.stringify(recipes, null, 2));

  await writeFile(
    join(ROOT, "data/canonical-ingredients.json"),
    JSON.stringify(CANONICAL_LIST, null, 2),
  );

  console.log(`wrote data/recipes.json (${recipes.length}) and data/canonical-ingredients.json (${CANONICAL_LIST.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
