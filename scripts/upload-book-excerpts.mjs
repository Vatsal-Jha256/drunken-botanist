#!/usr/bin/env node
/**
 * Uploads the local Markdown chapter excerpts (produced by `npm run extract-book`)
 * into a private Supabase Storage bucket named `book`. After this runs, the
 * deployed app on Vercel can serve the excerpts to admin accounts via the
 * secret/service-role key (gated by the isOwner check on the server).
 *
 * Local-only — needs SUPABASE_SERVICE_ROLE_KEY in your .env.local. The
 * secret/service-role key is never committed and never sent to the browser.
 *
 * Run after extract-book any time you want to refresh what's on Vercel.
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Load .env.local manually (no dotenv dep)
async function loadEnv() {
  const path = new URL("../.env.local", import.meta.url).pathname;
  if (!existsSync(path)) return;
  const text = await readFile(path, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
await loadEnv();

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  console.error(
    "Add a Supabase secret key, or the legacy service_role key, from Project Settings → API Keys.",
  );
  process.exit(1);
}

const SUPABASE_URL = URL_.replace(/\/+$/, "");
const storageUrl = `${SUPABASE_URL}/storage/v1`;
const authHeaders = {
  apikey: KEY,
  authorization: `Bearer ${KEY}`,
};

async function request(path, init = {}) {
  const res = await fetch(`${storageUrl}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      ...init.headers,
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = body?.message ?? body?.error ?? text ?? res.statusText;
    throw new Error(message);
  }
  return body;
}

// Ensure private bucket exists
const existingBuckets = await request("/bucket");
if (!existingBuckets?.some((b) => b.name === "book")) {
  console.log("creating private bucket 'book'…");
  try {
    await request("/bucket", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "book", name: "book", public: false }),
    });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "private", "book-excerpts");
const PDF = join(ROOT, "private", "book", "drunken-botanist.pdf");
if (!existsSync(SRC)) {
  console.error(`No excerpts at ${SRC}. Run \`npm run extract-book\` first.`);
  process.exit(1);
}

const files = (await readdir(SRC)).filter((f) => f.endsWith(".md"));
console.log(`uploading ${files.length} chapter files to book/excerpts/…`);

let ok = 0;
for (const f of files) {
  const buf = await readFile(join(SRC, f));
  try {
    await request(`/object/book/excerpts/${encodeURIComponent(f)}`, {
      method: "POST",
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "x-upsert": "true",
      },
      body: buf,
    });
    ok++;
    console.log(`  ✓ ${f}`);
  } catch (error) {
    console.error(`  ✗ ${f}:`, error.message);
  }
}
console.log(`done: ${ok}/${files.length} uploaded.`);

if (existsSync(PDF)) {
  console.log("uploading protected PDF reader source…");
  try {
    const pdf = await readFile(PDF);
    await request("/object/book/source/drunken-botanist.pdf", {
      method: "POST",
      headers: {
        "content-type": "application/pdf",
        "x-upsert": "true",
      },
      body: pdf,
    });
    console.log("  ✓ source/drunken-botanist.pdf");
  } catch (error) {
    console.error("  ✗ source/drunken-botanist.pdf:", error.message);
  }
}
