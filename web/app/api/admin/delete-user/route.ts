import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

async function checkAdmin() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('sb-access-token')?.value
  if (!accessToken) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  )

  const { data: { user }, error: userErr } = await supabase.auth.getUser(accessToken)
  if (userErr || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_admin')
    .eq('id', user.id)
    .maybeSingle()

  return profile?.is_admin ? profile : null
}

export async function POST(req: Request) {
  try {
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Access denied: Admin privileges required' }, { status: 403 })
    }

    const body = await req.json()
    const { profileId } = body

    if (!profileId) {
      return NextResponse.json({ error: 'Missing profileId' }, { status: 400 })
    }

    if (profileId === admin.id) {
      return NextResponse.json({ error: 'You cannot delete your own admin account' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const accessToken = cookieStore.get('sb-access-token')?.value

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
        ? {}
        : {
            global: {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          }
    )

    // Verify target profile exists
    const { data: targetProfile, error: getErr } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name')
      .eq('id', profileId)
      .maybeSingle()

    if (getErr || !targetProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Delete subscriptions first if present
    await supabaseAdmin.from('subscriptions').delete().eq('profile_id', profileId)

    // Delete profile (cascades to all associated user data)
    const { error: deleteErr } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', profileId)

    if (deleteErr) {
      console.error('Error deleting profile:', deleteErr)
      return NextResponse.json({ error: `Failed to delete user profile: ${deleteErr.message}` }, { status: 500 })
    }

    // Try deleting auth user if service role key exists
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(profileId)
      } catch (authErr) {
        console.warn('Could not delete auth user:', authErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: `User account '${targetProfile.display_name}' deleted successfully.`
    })
  } catch (err: unknown) {
    console.error('Error in admin delete-user API:', err)
    const message = err instanceof Error ? err.message : 'An error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
