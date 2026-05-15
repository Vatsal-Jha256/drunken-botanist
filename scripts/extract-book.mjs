#!/usr/bin/env node
/**
 * Local-only: extract structured excerpts from your copy of The Drunken Botanist
 * and write per-botanical Markdown files into private/book-excerpts/.
 *
 * This script runs ON YOUR MACHINE ONLY. The private/ folder is gitignored, so
 * the book content never lands in the public repo or the Vercel build.
 *
 * Usage: npm run extract-book
 */
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PDF_PATH = join(ROOT, "private", "book", "drunken-botanist.pdf");
const OUT_DIR = join(ROOT, "private", "book-excerpts");
const STRUCTURE_REPORT = join(ROOT, "private", "book-structure.json");

const BOTANICALS = JSON.parse(
  await readFile(join(ROOT, "data", "botanicals.json"), "utf8"),
);

if (!existsSync(PDF_PATH)) {
  console.error(`No PDF at ${PDF_PATH}.`);
  console.error("Drop your copy at private/book/drunken-botanist.pdf and rerun.");
  process.exit(1);
}

// pdf-parse pulls a small test harness into its top-level on import, so we
// reach into the lib entry directly.
const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");

console.log(`Reading ${PDF_PATH}…`);
const buf = await readFile(PDF_PATH);
const pages = [];
const { numpages } = await pdfParse(buf, {
  pagerender: async (pageData) => {
    const content = await pageData.getTextContent();
    const pageText = content.items
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push(pageText);
    return pageText;
  },
});

await mkdir(OUT_DIR, { recursive: true });

const MAX_SECTION_CHARS = 2400;
const MAX_PASSAGES = 3;
const PASSAGE_RADIUS = 420;

const SECTION_OVERRIDES = {
  anise: "LICORICE-FLAVORED HERBS",
  "sugar-cane": "SUGARCANE",
  grape: "GRAPES",
  nutmeg: "NUTMEG AND MACE",
  quinine: "CINCHONA",
  cherry: "MARASCA CHERRY",
  sloe: "SLOE BERRY",
  mint: "SPEARMINT",
  lemon: "CITRUS",
  orange: "CITRUS",
  lime: "LIME",
};

const FALLBACK_ALIASES = {
  quinine: ["quinine", "cinchona"],
  hibiscus: ["hibiscus", "roselle"],
  tea: ["Camellia sinensis"],
  blackberry: ["blackberry", "blackberries", "Rubus"],
  cucumber: ["cucumber", "Cucumis sativus"],
  lemon: ["lemon", "limoncello", "Citrus limon"],
  orange: ["orange", "orange flower", "orange blossom", "Citrus sinensis"],
  lime: ["lime", "Key lime", "Persian lime", "Citrus aurantiifolia"],
};

const SKIP_COMMON_NAME_FALLBACK = new Set(["tea"]);

function normalizeHeading(value) {
  return value
    .toUpperCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function aliasesFor(botanical) {
  const names = [botanical.latinName];
  if (!SKIP_COMMON_NAME_FALLBACK.has(botanical.slug)) names.push(botanical.commonName);
  const parenthetical = botanical.commonName.match(/^(.*?)\s*\((.*?)\)$/);
  if (parenthetical && !SKIP_COMMON_NAME_FALLBACK.has(botanical.slug)) {
    names.push(parenthetical[1], parenthetical[2]);
  }
  if (FALLBACK_ALIASES[botanical.slug]) names.push(...FALLBACK_ALIASES[botanical.slug]);
  return [...new Set(names.filter(Boolean).map((n) => n.trim()))];
}

function detectHeading(pageText) {
  const patterns = [
    /^([A-Z][A-Z\s&() -]{2,44})\s+([A-Z][a-z]+(?:\s+x)?\s+[a-z]+)/,
    /^(CITRUS)\s+Citrus\b/,
    /^(LIME)\s+Bearss lime\b/,
    /^(MANDARIN)\s+Tangerine\b/,
    /^(CHERRY TREE)\s+There\b/,
    /^(GROWING NOTES)\s+(?:berries & vines|fruits & vegetables)\b/,
    /^(LICORICE-FLAVORED HERBS):/,
  ];
  for (const pattern of patterns) {
    const match = pageText.match(pattern);
    if (match) return normalizeHeading(match[1]);
  }
  return null;
}

const headingStarts = [];
pages.forEach((pageText, index) => {
  const heading = detectHeading(pageText);
  if (heading) headingStarts.push({ heading, page: index + 1, index });
});

const sections = headingStarts.map((entry, index) => {
  const next = headingStarts[index + 1];
  return {
    ...entry,
    endPage: next ? next.page - 1 : numpages,
    endIndex: next ? next.index - 1 : pages.length - 1,
  };
});

console.log(`Detected ${sections.length} section/subsection headings.`);

function findSection(botanical) {
  const override = SECTION_OVERRIDES[botanical.slug];
  const candidates = [
    override,
    botanical.commonName,
    botanical.commonName.replace(/\s*\([^)]*\)/g, ""),
    botanical.commonName.replace(/\s*\([^)]*\)/g, "s"),
  ]
    .filter(Boolean)
    .map(normalizeHeading);

  return sections.find((section) => candidates.includes(section.heading)) ?? null;
}

function pageLabel(start, end) {
  return start === end ? `p. ${start}` : `pp. ${start}-${end}`;
}

function trimExcerpt(value, maxChars = MAX_SECTION_CHARS) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) return compact;
  const slice = compact.slice(0, maxChars);
  const sentenceEnd = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (sentenceEnd > maxChars * 0.65) return `${slice.slice(0, sentenceEnd + 1).trim()}\n\n[Excerpt trimmed.]`;
  return `${slice.trim()}\n\n[Excerpt trimmed.]`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMatches(pageText, alias) {
  const escaped = escapeRegExp(alias.trim()).replace(/\s+/g, "\\s+");
  const pattern = /^[a-z0-9\s-]+$/i.test(alias)
    ? new RegExp(`\\b${escaped}\\b`, "gi")
    : new RegExp(escaped, "gi");
  return pageText.match(pattern)?.length ?? 0;
}

function scorePage(botanical, pageIndex, aliases) {
  const pageText = pages[pageIndex];
  let score = 0;
  for (const alias of aliases) score += countMatches(pageText, alias);

  score += countMatches(pageText, botanical.commonName) * 4;
  score += countMatches(pageText, botanical.latinName) * 5;

  if (/GROWING NOTES/i.test(pageText) && score > 0) score += 20;

  const heading = detectHeading(pageText);
  if (heading && aliases.map(normalizeHeading).includes(heading)) score += 30;

  return score;
}

function passagesFor(botanical, sourcePages = contentPageIndexes()) {
  const aliases = aliasesFor(botanical);
  const passages = [];
  const rankedPages = sourcePages
    .map((pageIndex) => ({ pageIndex, score: scorePage(botanical, pageIndex, aliases) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.pageIndex - b.pageIndex);
  const topScore = rankedPages[0]?.score ?? 0;
  const relevantPages = rankedPages
    .filter((item) => item.score >= Math.max(2, topScore * 0.4))
    .map((item) => item.pageIndex);

  for (const pageIndex of relevantPages) {
    const pageText = pages[pageIndex];
    const lower = pageText.toLowerCase();
    const firstHit = aliases
      .map((alias) => lower.indexOf(alias.toLowerCase()))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0];

    if (firstHit === undefined) continue;

    const start = Math.max(0, firstHit - PASSAGE_RADIUS);
    const end = Math.min(pageText.length, firstHit + PASSAGE_RADIUS);
    const passage = trimExcerpt(pageText.slice(start, end), PASSAGE_RADIUS * 2);
    if (passage.length > 120) {
      passages.push({ page: pageIndex + 1, text: passage });
    }
    if (passages.length >= MAX_PASSAGES) break;
  }

  return passages;
}

function contentPageIndexes() {
  return pages
    .map((_, index) => index)
    .filter((index) => index + 1 >= 21 && index + 1 <= 430);
}

function extractFor(botanical) {
  const section = findSection(botanical);

  if (section) {
    const sectionPages = [];
    for (let i = section.index; i <= section.endIndex; i++) sectionPages.push(i);

    let body;
    if (SECTION_OVERRIDES[botanical.slug] === "CITRUS" || section.endPage - section.page > 4) {
      const passages = passagesFor(botanical, sectionPages);
      body =
        passages.length > 0
          ? passages
              .map((p, i) => `## Excerpt ${i + 1} (${pageLabel(p.page, p.page)})\n\n${p.text}`)
              .join("\n\n---\n\n")
          : `## Excerpt (${pageLabel(section.page, section.endPage)})\n\n${trimExcerpt(
              sectionPages.map((index) => pages[index]).join(" "),
            )}`;
    } else {
      body = `## Excerpt (${pageLabel(section.page, section.endPage)})\n\n${trimExcerpt(
        sectionPages.map((index) => pages[index]).join(" "),
      )}`;
    }

    return {
      source: `section ${section.heading} (${pageLabel(section.page, section.endPage)})`,
      markdown: `# ${botanical.commonName} — ${botanical.latinName}\n\n_Source: ${section.heading}, ${pageLabel(
        section.page,
        section.endPage,
      )}._\n\n${body}\n`,
    };
  }

  const passages = passagesFor(botanical);
  if (passages.length === 0) return null;

  return {
    source: `keyword fallback (${passages.map((p) => `p. ${p.page}`).join(", ")})`,
    markdown: `# ${botanical.commonName} — ${botanical.latinName}\n\n_Source: keyword-matched passages; no dedicated section heading was detected._\n\n${passages
      .map((p, i) => `## Excerpt ${i + 1} (${pageLabel(p.page, p.page)})\n\n${p.text}`)
      .join("\n\n---\n\n")}\n`,
  };
}

let written = 0;
const report = [];
for (const b of BOTANICALS) {
  const result = extractFor(b);
  const outPath = join(OUT_DIR, `${b.slug}.md`);
  if (!result) {
    if (existsSync(outPath)) await unlink(outPath);
    console.log(`  · ${b.slug}: no hits`);
    report.push({
      slug: b.slug,
      commonName: b.commonName,
      latinName: b.latinName,
      status: "not-found",
      source: null,
    });
    continue;
  }
  await writeFile(outPath, result.markdown);
  console.log(`  ✓ ${b.slug}: ${result.source}`);
  report.push({
    slug: b.slug,
    commonName: b.commonName,
    latinName: b.latinName,
    status: "written",
    source: result.source,
  });
  written++;
}

console.log(`\nWrote ${written} chapter files to ${OUT_DIR}.`);
await writeFile(
  STRUCTURE_REPORT,
  `${JSON.stringify(
    {
      pdf: PDF_PATH,
      pages: numpages,
      detectedSections: sections.map(({ heading, page, endPage }) => ({
        heading,
        page,
        endPage,
      })),
      curatedBotanicalExtraction: report,
    },
    null,
    2,
  )}\n`,
);
console.log(`Wrote structure report to ${STRUCTURE_REPORT}.`);
