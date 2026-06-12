import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Loose schema so client-side pages can query tables without generated types.
export type AppSupabaseClient = SupabaseClient

export function createAppClient(
  url: string,
  key: string,
  options?: Parameters<typeof createClient>[2]
): AppSupabaseClient {
  return createClient(url, key, options)
}
