import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Loose schema so client-side pages can query tables without generated types.
export type AppSupabaseClient = SupabaseClient

// Cache the client so we don't create multiple GoTrue instances in the browser
let globalClient: AppSupabaseClient | null = null;
let globalClientToken: string | null = null;

// Custom cookie storage helper for browser client
const cookieStorage = {
  getItem: (key: string) => {
    if (typeof document === 'undefined') return null
    const value = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${key}=`))
      ?.split('=')[1]
    return value ? decodeURIComponent(value) : null
  },
  setItem: (key: string, value: string) => {
    if (typeof document === 'undefined') return
    // Secure cookie storage so Next.js server can access it
    document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax; secure=${process.env.NODE_ENV === 'production'}`
  },
  removeItem: (key: string) => {
    if (typeof document === 'undefined') return
    document.cookie = `${key}=; path=/; max-age=0`
  }
}

export function createAppClient(
  url: string,
  key: string,
  options?: Parameters<typeof createClient>[2]
): AppSupabaseClient {
  // Merge custom auth options to enforce cookie storage
  const mergedOptions = {
    ...options,
    auth: {
      flowType: 'pkce' as const,
      persistSession: true,
      detectSessionInUrl: false,
      storage: cookieStorage,
      ...options?.auth
    }
  }

  // If we are on the server, always create a new client to avoid cross-request contamination
  if (typeof window === 'undefined') {
    return createClient(url, key, mergedOptions) as AppSupabaseClient
  }

  // Extract the auth token from options if it exists
  const headers = options?.global?.headers as Record<string, string> | undefined;
  const token = headers?.Authorization || null;

  // If a client already exists and the token matches, reuse it
  if (globalClient && globalClientToken === token) {
    return globalClient;
  }

  // Otherwise create a new client and cache it
  globalClient = createClient(url, key, mergedOptions) as AppSupabaseClient;
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
