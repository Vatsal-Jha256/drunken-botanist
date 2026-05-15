import Link from "next/link";
import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getUser, isOwner } from "@/lib/auth";
import { botanicalBySlug } from "@/lib/botanicals";
import { createAdminClient } from "@/lib/supabase/admin";
import { SaveIndexedNote } from "./save-indexed-note";

export const dynamic = "force-dynamic";

async function readLocal(slug: string): Promise<string | null> {
  const path = join(process.cwd(), "private", "book-excerpts", `${slug}.md`);
  if (!existsSync(path)) return null;
  return readFile(path, "utf8");
}

async function readFromStorage(slug: string): Promise<string | null> {
  const admin = await createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.storage
    .from("book")
    .download(`excerpts/${slug}.md`);
  if (error || !data) return null;
  return data.text();
}

export default async function LibraryChapter({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getUser();
  if (!isOwner(user)) notFound();

  const { slug } = await params;

  // Prefer local in dev, storage in prod; fall back to storage if local missing.
  const isDev = process.env.NODE_ENV !== "production";
  const raw = (isDev ? await readLocal(slug) : null) ?? (await readFromStorage(slug));
  if (!raw) notFound();

  const botanical = botanicalBySlug(slug);
  const pageMatch = raw.match(/p{1,2}\.?\s+(\d+)/i);
  const sourcePage = pageMatch ? Number(pageMatch[1]) : null;
  const snippet = raw
    .replace(/^# .+$/m, "")
    .replace(/^_Source:.+$/m, "")
    .replace(/^## .+$/gm, "")
    .replace(/\[Excerpt trimmed.\]/g, "")
    .trim();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <p className="smallcaps text-xs text-burgundy mb-2">
        <Link href="/library" className="hover:text-ink">
          ← back to library
        </Link>
      </p>

      {botanical && (
        <div className="mb-6">
          <p className="smallcaps text-xs text-ink-soft">{botanical.family}</p>
          <h1 className="font-serif text-4xl text-ink leading-tight mt-1">
            {botanical.commonName}
          </h1>
          <p className="italic text-ink-soft mt-1">{botanical.latinName}</p>
          <Link
            href={`/botanicals/${slug}`}
            className="inline-block mt-2 text-xs smallcaps text-sage-deep hover:text-burgundy"
          >
            Field-guide entry →
          </Link>
          <Link
            href="/library/pdf"
            target="_blank"
            className="inline-block mt-2 ml-4 text-xs smallcaps text-sage-deep hover:text-burgundy"
          >
            Open PDF →
          </Link>
        </div>
      )}

      <article className="specimen-card rounded-md p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-[10px] smallcaps text-burgundy/80">
            machine-indexed private note · use the PDF reader as source of truth
          </p>
          <SaveIndexedNote
            title={botanical ? botanical.commonName : slug}
            page={sourcePage}
            snippet={snippet}
          />
        </div>
        <div className="text-ink leading-relaxed whitespace-pre-wrap font-serif text-[15px]">
          {raw}
        </div>
      </article>
    </div>
  );
}
