"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/favorites");
  return { supabase, user };
}

export async function addNotebookFieldNote(
  slug: string,
  note: string,
  observedAt: string,
  location: string,
) {
  const trimmedSlug = slug.trim();
  const trimmedNote = note.trim();
  if (!trimmedSlug || !trimmedNote) return null;

  const { supabase, user } = await requireUser();
  const safeObservedAt = /^\d{4}-\d{2}-\d{2}$/.test(observedAt) ? observedAt : null;

  const { data, error } = await supabase
    .from("botanical_field_notes")
    .insert({
      user_id: user.id,
      slug: trimmedSlug,
      note: trimmedNote,
      observed_at: safeObservedAt,
      location: location.trim() || null,
    })
    .select("slug, note, observed_at, location, created_at")
    .single();

  if (error) throw new Error(error.message);

  await supabase
    .from("saved_botanicals")
    .upsert({ user_id: user.id, slug: trimmedSlug });

  revalidatePath("/favorites");
  revalidatePath(`/botanicals/${trimmedSlug}`);
  return data;
}
