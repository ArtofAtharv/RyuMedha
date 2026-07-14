"use client"

import { useSupabaseSession } from "@/lib/supabase-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Invisible component — its only job is to redirect logged-in users to
 * /dashboard. Isolated as a "use client" leaf so the parent page.tsx can
 * remain a Server Component and be fully crawlable by bots.
 */
export default function SessionRedirect() {
  const { session } = useSupabaseSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.push("/dashboard");
  }, [session, router]);

  return null;
}
