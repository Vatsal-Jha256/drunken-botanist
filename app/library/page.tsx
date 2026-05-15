import Link from "next/link";
import { notFound } from "next/navigation";
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getUser, isOwner } from "@/lib/auth";
import { botanicalBySlug } from "@/lib/botanicals";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BookNotesPanel } from "./book-notes-panel";

export const dynamic = "force-dynamic";

async function listLocalChapters(): Promise<string[]> {
  const dir = join(process.cwd(), "private", "book-excerpts");
  if (!existsSync(dir)) return [];
  const files = await readdir(dir);
  return files.filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
}

async function listStorageChapters(): Promise<string[]> {
  const admin = await createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.storage.from("book").list("excerpts", {
    limit: 200,
    sortBy: { column: "name", order: "asc" },
  });
  if (error || !data) return [];
  return data
    .filter((f) => f.name.endsWith(".md"))
    .map((f) => f.name.replace(/\.md$/, ""));
}

export default async function LibraryIndex() {
  const user = await getUser();
  if (!isOwner(user)) notFound();

  // Local dev reads from disk; production reads from Supabase Storage.
  const isDev = process.env.NODE_ENV !== "production";
  const slugs = isDev ? await listLocalChapters() : await listStorageChapters();
  // If running locally but no excerpts yet, fall back to storage so admins
  // can still see what's been uploaded.
  const allSlugs = slugs.length === 0 ? await listStorageChapters() : slugs;

  const chapters = allSlugs
    .map((slug) => {
      const b = botanicalBySlug(slug);
      return { slug, commonName: b?.commonName ?? slug };
    })
    .sort((a, b) => a.commonName.localeCompare(b.commonName));

  const hasStorage = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = await createClient();
  const { data: noteRows } = await supabase
    .from("book_notes")
    .select("id, kind, page, title, snippet, note, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const bookNotes = (noteRows ?? [])
    .filter((row) => row.kind === "bookmark" || row.kind === "snippet")
    .map((row) => ({
      id: row.id,
      kind: row.kind as "bookmark" | "snippet",
      page: row.page,
      title: row.title,
      snippet: row.snippet,
      note: row.note,
      created_at: row.created_at,
    }));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <p className="smallcaps text-xs text-burgundy mb-2">owner&apos;s reading room</p>
        <h1 className="font-serif text-4xl text-ink">Library</h1>
        <p className="text-ink-soft text-sm mt-2">
          Your protected copy of <em>The Drunken Botanist</em>, visible only to
          admin accounts; served
          {hasStorage ? " from private Supabase Storage." : " from your local machine."}
        </p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 mb-10 items-start">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-serif text-2xl text-ink">PDF reader</h2>
              <p className="text-sm text-ink-soft mt-1">
                Read in place, then save page bookmarks or short snippets beside it.
              </p>
            </div>
            <Link href="/library/pdf" target="_blank" className="text-xs smallcaps text-sage-deep hover:text-burgundy">
              open full page →
            </Link>
          </div>
          <div className="border border-paper-edge bg-ink rounded-md overflow-hidden shadow-[0_18px_45px_-24px_rgba(42,36,25,0.55)]">
            <iframe
              title="The Drunken Botanist PDF"
              src="/library/pdf#toolbar=1&navpanes=0"
              className="block w-full h-[76vh] min-h-[620px] bg-white"
            />
          </div>
        </div>
        <BookNotesPanel initialNotes={bookNotes} />
      </section>

      {chapters.length === 0 ? (
        <div className="specimen-card rounded-md p-6 text-sm text-ink-soft space-y-2">
          <p>No chapter files found.</p>
          <p>
            Locally: run{" "}
            <code className="font-mono text-xs bg-parchment-deep/40 px-1.5 py-0.5 rounded-sm">
              npm run extract-book
            </code>{" "}
            to parse the PDF, then{" "}
            <code className="font-mono text-xs bg-parchment-deep/40 px-1.5 py-0.5 rounded-sm">
              npm run upload-book
            </code>{" "}
            to push the excerpts to the private Supabase bucket so Vercel can serve them.
          </p>
        </div>
      ) : (
        <section>
          <div className="mb-3">
            <h2 className="font-serif text-2xl text-ink">Indexed plant passages</h2>
            <p className="text-sm text-ink-soft mt-1">
              Rough private notes that point back to the PDF. Use the reader above as the source of truth.
            </p>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {chapters.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/library/${c.slug}`}
                  className="specimen-card rounded-sm p-4 block hover:border-burgundy"
                >
                  <p className="font-serif text-lg text-ink">{c.commonName}</p>
                  <p className="text-xs text-ink-soft mt-1">open indexed note →</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
