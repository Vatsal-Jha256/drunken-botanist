import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { getUser, isOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function readLocalPdf(): Promise<ArrayBuffer | null> {
  const path = join(process.cwd(), "private", "book", "drunken-botanist.pdf");
  if (!existsSync(path)) return null;
  const buffer = await readFile(path);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

async function readStoragePdf(): Promise<ArrayBuffer | null> {
  const admin = await createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.storage
    .from("book")
    .download("source/drunken-botanist.pdf");
  if (error || !data) return null;
  return data.arrayBuffer();
}

export async function GET() {
  const user = await getUser();
  if (!isOwner(user)) notFound();

  const body = (await readLocalPdf()) ?? (await readStoragePdf());
  if (!body) notFound();

  return new Response(body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="drunken-botanist.pdf"',
      "cache-control": "private, no-store",
    },
  });
}
