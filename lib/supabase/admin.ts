import { createClient } from "@supabase/supabase-js";
import { realtimeTransportOptions } from "@/lib/supabase/realtime";

/**
 * Server-only Supabase client using the service-role key.
 *
 * NEVER import this in a client component or pass its results to one without
 * going through a server route. The service-role key bypasses RLS and must
 * never reach the browser.
 *
 * The Library route uses this to download from the private `book` bucket,
 * AFTER it has verified that the requesting user is an admin (isOwner).
 */
export async function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(await realtimeTransportOptions()),
  });
}
