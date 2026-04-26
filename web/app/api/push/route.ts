import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { subscription, action } = body; // action: 'subscribe' | 'unsubscribe'

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${session.user.supabaseToken}` } },
      }
    );

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('whatsapp_number', session.user.phone)
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
  } catch (err: any) {
    console.error('Push API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
