"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getUser, isOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function requireOwner() {
  const user = await getUser();
  if (!user) redirect("/login?next=/library");
  if (!isOwner(user)) notFound();
  const supabase = await createClient();
  return { supabase, user };
}

export async function addBookNote(input: {
  kind: "bookmark" | "snippet";
  page: number | null;
  title: string;
  snippet: string;
  note: string;
}) {
  const { supabase, user } = await requireOwner();
  const page = input.page && input.page > 0 ? input.page : null;
  const title = input.title.trim() || null;
  const snippet = input.snippet.trim() || null;
  const note = input.note.trim() || null;

  if (input.kind === "bookmark" && !page && !title && !note) return null;
  if (input.kind === "snippet" && !snippet && !note) return null;

  const { data, error } = await supabase
    .from("book_notes")
    .insert({
      user_id: user.id,
      kind: input.kind,
      page,
      title,
      snippet,
      note,
    })
    .select("id, kind, page, title, snippet, note, created_at")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/library");
  return data;
}

export async function deleteBookNote(id: string) {
  const { supabase } = await requireOwner();
  await supabase.from("book_notes").delete().eq("id", id);
  revalidatePath("/library");
}
