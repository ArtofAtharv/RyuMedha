import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Loose schema so client-side pages can query tables without generated types.
export type AppSupabaseClient = SupabaseClient

// Cache the client so we don't create multiple GoTrue instances in the browser
let globalClient: AppSupabaseClient | null = null;
let globalClientToken: string | null = null;

export function createAppClient(
  url: string,
  key: string,
  options?: Parameters<typeof createClient>[2]
): AppSupabaseClient {
  // If we are on the server, always create a new client to avoid cross-request contamination
  if (typeof window === 'undefined') {
    return createClient(url, key, options)
  }

  // Extract the auth token from options if it exists
  const headers = options?.global?.headers as Record<string, string> | undefined;
  const token = headers?.Authorization || null;

  // If a client already exists and the token matches, reuse it
  if (globalClient && globalClientToken === token) {
    return globalClient;
  }

  // Otherwise create a new client and cache it
  globalClient = createClient(url, key, options);
  globalClientToken = token;
  return globalClient;
}

export function getAppClient(options?: Parameters<typeof createClient>[2]): AppSupabaseClient {
  return createAppClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    options
  );
}
