// Server-only Supabase client with full access (service role key).
// Used only where no driver is signed in (Stripe webhook) or to change
// background-check fields that drivers aren't allowed to edit themselves.
// Needs SUPABASE_SERVICE_ROLE_KEY on Render (Supabase > Project Settings > API).
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Server setup missing: SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
