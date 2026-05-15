"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function setBarItem(ingredientName: string, owned: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (owned) {
    await supabase
      .from("bar_inventory")
      .upsert(
        { user_id: user.id, ingredient_name: ingredientName },
        { onConflict: "user_id,ingredient_name" },
      );
  } else {
    await supabase
      .from("bar_inventory")
      .delete()
      .eq("user_id", user.id)
      .eq("ingredient_name", ingredientName);
  }
  revalidatePath("/bar");
}
