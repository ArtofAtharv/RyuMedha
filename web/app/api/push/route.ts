import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { subscription, action } = body; // action: 'subscribe' | 'unsubscribe'

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${accessToken}` },
          fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
        },
      }
    );

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    if (action === 'subscribe') {
      if (!subscription) return NextResponse.json({ error: 'Missing subscription' }, { status: 400 });
      
      // Save subscription
      const { error: insertErr } = await supabase.from('push_subscriptions').upsert({
        profile_id: profile.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      }, { onConflict: 'profile_id,endpoint' });

      if (insertErr) throw insertErr;

      // Update profile
      await supabase.from('profiles').update({ push_notifications_enabled: true }).eq('id', profile.id);

      return NextResponse.json({ success: true });
    } else if (action === 'unsubscribe') {
      // Unsubscribe (we might just clear push_notifications_enabled or delete endpoint)
      if (subscription) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
      }
      await supabase.from('profiles').update({ push_notifications_enabled: false }).eq('id', profile.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Push API Error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
