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

export async function toggleFavorite(cocktailId: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("favorites")
    .select("cocktail_id")
    .eq("cocktail_id", cocktailId)
    .maybeSingle();
  if (data) {
    await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("cocktail_id", cocktailId);
  } else {
    await supabase
      .from("favorites")
      .insert({ user_id: user.id, cocktail_id: cocktailId });
  }
  revalidatePath(`/cocktails/${cocktailId}`);
  revalidatePath("/favorites");
}

export async function addTastingNote(
  cocktailId: string,
  note: string,
  rating: number | null,
) {
  const { supabase, user } = await requireUser();
  const safeRating = rating && rating >= 1 && rating <= 5 ? rating : null;
  await supabase.from("tasting_notes").insert({
    user_id: user.id,
    cocktail_id: cocktailId,
    note: note.trim() || null,
    rating: safeRating,
  });
  revalidatePath(`/cocktails/${cocktailId}`);
  revalidatePath("/favorites");
}

export async function deleteTastingNote(noteId: string, cocktailId: string) {
  const { supabase } = await requireUser();
  await supabase.from("tasting_notes").delete().eq("id", noteId);
  revalidatePath(`/cocktails/${cocktailId}`);
  revalidatePath("/favorites");
}
