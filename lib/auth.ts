import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function getUser(): Promise<User | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export function isOwner(user: User | null): boolean {
  const raw = process.env.OWNER_EMAILS ?? process.env.OWNER_EMAIL ?? "";
  if (!user?.email) return false;
  const allowed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(user.email.toLowerCase());
}
