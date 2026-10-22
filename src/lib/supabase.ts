/**
 * Supabase client configuration for server-side administration and queue processing.
 */

import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";

/**
 * Service role client bypasses RLS for background ingestion, webhook processing,
 * and the SKIP LOCKED queue worker.
 */
export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
