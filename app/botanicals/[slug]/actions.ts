"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function toggleSavedBotanical(slug: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("saved_botanicals")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (data) {
    await supabase
      .from("saved_botanicals")
      .delete()
      .eq("user_id", user.id)
      .eq("slug", slug);
  } else {
    await supabase
      .from("saved_botanicals")
      .insert({ user_id: user.id, slug });
  }
  revalidatePath(`/botanicals/${slug}`);
  revalidatePath("/favorites");
}

export async function addBotanicalFieldNote(
  slug: string,
  note: string,
  observedAt: string,
  location: string,
) {
  const trimmedNote = note.trim();
  if (!trimmedNote) return null;

  const { supabase, user } = await requireUser();
  const safeObservedAt = /^\d{4}-\d{2}-\d{2}$/.test(observedAt) ? observedAt : null;
  const { data, error } = await supabase
    .from("botanical_field_notes")
    .insert({
      user_id: user.id,
      slug,
      note: trimmedNote,
      observed_at: safeObservedAt,
      location: location.trim() || null,
    })
    .select("id, note, observed_at, location, created_at")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/botanicals/${slug}`);
  revalidatePath("/favorites");
  return data;
}

export async function deleteBotanicalFieldNote(noteId: string, slug: string) {
  const { supabase } = await requireUser();
  await supabase.from("botanical_field_notes").delete().eq("id", noteId);
  revalidatePath(`/botanicals/${slug}`);
  revalidatePath("/favorites");
}
