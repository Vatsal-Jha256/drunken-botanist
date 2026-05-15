import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { realtimeTransportOptions } from "@/lib/supabase/realtime";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    {
      ...(await realtimeTransportOptions()),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components can't set cookies — middleware refreshes the session.
          }
        },
      },
    },
  );
}
