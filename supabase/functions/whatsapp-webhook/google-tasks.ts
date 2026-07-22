import { supabaseAdmin } from './db.ts';

/**
 * Validates and refreshes the Google OAuth token if it is expired or close to expiring.
 * Updates the database dynamically with the new credentials.
 */
export async function getValidGoogleToken(profile: any): Promise<string | null> {
  if (!profile.google_access_token) return null;

  const now = Math.floor(Date.now() / 1000);
  const expiry = profile.google_token_expiry ? Number(profile.google_token_expiry) : 0;

  // If token is expired or close to expiring (within 5 minutes)
  if (expiry <= now + 300) {
    if (!profile.google_refresh_token) {
      console.warn("Google token expired but no refresh token available for profile:", profile.id);
      return null;
    }

    try {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID') || Deno.env.get('NEXT_PUBLIC_GOOGLE_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

      if (!clientId || !clientSecret) {
        console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET secrets in Supabase Edge Functions.");
        return profile.google_access_token; // Fallback to current token
      }

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: profile.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!res.ok) {
        console.error("Failed to refresh Google access token in Edge Function:", await res.text());
        return null;
      }

      const credentials = await res.json();
      if (credentials.access_token) {
        const newExpiry = Math.floor(Date.now() / 1000) + (credentials.expires_in || 3600);
        
        await supabaseAdmin
          .from('profiles')
          .update({
            google_access_token: credentials.access_token,
            google_token_expiry: newExpiry
          })
          .eq('id', profile.id);

        return credentials.access_token;
      }
    } catch (err) {
      console.error("Error refreshing Google access token in Edge Function:", err);
      return null;
    }
  }

  return profile.google_access_token;
}

/**
 * Fetches active (needsAction) Google Tasks from the user's default task list.
 */
export async function fetchGoogleTasks(accessToken: string, listId = "@default", profile?: any): Promise<any[]> {
  try {
    const cb = Date.now();
    const doFetch = (token: string) => fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=true&showHidden=true&maxResults=100&_cb=${cb}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });

    let res = await doFetch(accessToken);
    if (res.status === 401 && profile) {
      const refreshed = await getValidGoogleToken({ ...profile, google_token_expiry: 0 }); // force refresh regardless of stored value
      if (refreshed) res = await doFetch(refreshed);
    }

    if (!res.ok) {
      console.error("Google Tasks fetch error:", await res.text());
      return [];
    }

    const data = await res.json();
    return data.items || [];
  } catch (err) {
    console.error("Error fetching Google Tasks:", err);
    return [];
  }
}

/**
 * Creates a new task in the user's default Google Tasks list.
 */
export async function createGoogleTask(accessToken: string, title: string, notes?: string, due?: string, listId = "@default", profile?: any) {
  try {
    const body: any = {
      title,
      notes: notes || "",
    };
    if (due) {
      // Google Tasks expects Date only (YYYY-MM-DD) followed by T00:00:00.000Z
      body.due = due.split("T")[0] + "T00:00:00.000Z";
    }

    const doPost = (token: string) => fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    let res = await doPost(accessToken);
    if (res.status === 401 && profile) {
      const refreshed = await getValidGoogleToken({ ...profile, google_token_expiry: 0 });
      if (refreshed) res = await doPost(refreshed);
    }

    if (!res.ok) {
      console.error("Failed to create Google task:", await res.text());
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("Error creating Google task:", err);
    return null;
  }
}

/**
 * Updates an existing Google task's completion status or details.
 */
export async function updateGoogleTask(accessToken: string, taskId: string, data: { title?: string; notes?: string; due?: string; completed?: boolean }, listId = "@default", profile?: any) {
  try {
    let currentToken = accessToken;
    let getRes = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
    });

    if (getRes.status === 401 && profile) {
      const refreshed = await getValidGoogleToken({ ...profile, google_token_expiry: 0 });
      if (refreshed) {
        currentToken = refreshed;
        getRes = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });
      }
    }

    if (!getRes.ok) {
      console.error(`Failed to fetch current Google task ${taskId} for update:`, await getRes.text());
      return null;
    }
    const current = await getRes.json();

    const body = {
      ...current,
      ...(data.title !== undefined && { title: data.title }),
      notes: data.notes !== undefined ? data.notes : (current.notes || ""),
      ...(data.due !== undefined && { due: data.due ? data.due.split("T")[0] + "T00:00:00.000Z" : null }),
      ...(data.completed !== undefined && {
        status: data.completed ? "completed" : "needsAction",
        completed: data.completed ? new Date().toISOString() : null,
      }),
    };

    let res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${currentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401 && profile) {
      const refreshed = await getValidGoogleToken({ ...profile, google_token_expiry: 0 });
      if (refreshed) {
        res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${refreshed}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
      }
    }

    if (!res.ok) {
      console.error("Failed to update Google task:", await res.text());
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("Error updating Google task:", err);
    return null;
  }
}
