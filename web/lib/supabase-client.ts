import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AppSupabaseClient = SupabaseClient

let globalClient: AppSupabaseClient | null = null;

export function createAppClient(
  url: string,
  key: string,
  options?: Record<string, unknown>
): AppSupabaseClient {
  if (typeof window === 'undefined') {
    return createBrowserClient(url, key, options) as AppSupabaseClient
  }

  if (globalClient) {
    return globalClient;
  }
 
  globalClient = createBrowserClient(url, key, options) as AppSupabaseClient;
  return globalClient;
}

export function getAppClient(options?: Record<string, unknown>): AppSupabaseClient {
  return createAppClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    options
  );
}
