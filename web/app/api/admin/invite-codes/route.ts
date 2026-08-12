import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getInviteCodes, saveInviteCodes, type InviteCode } from '@/lib/invite-codes-store'

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
    const { code, durationType, maxUses } = body

    const cleanCode = code ? String(code).trim().toUpperCase() : ''
    if (!cleanCode) {
      return NextResponse.json({ error: 'Invite code string is required' }, { status: 400 })
    }

    const codes = getInviteCodes()
    if (codes.some(c => c.code.toUpperCase() === cleanCode)) {
      return NextResponse.json({ error: 'This invite code already exists' }, { status: 400 })
    }

    const newCode: InviteCode = {
      id: `code_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      code: cleanCode,
      durationType: durationType === '1_year' ? '1_year' : 'lifetime',
      maxUses: maxUses && Number(maxUses) > 0 ? Number(maxUses) : null,
      usesCount: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: admin.id
    }

    codes.unshift(newCode)
    saveInviteCodes(codes)

    return NextResponse.json({ success: true, code: newCode })
  } catch (err: unknown) {
    console.error('Error creating invite code:', err)
    const message = err instanceof Error ? err.message : 'An error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Access denied: Admin privileges required' }, { status: 403 })
    }

    let codeId: string | null = null
    const url = new URL(req.url)
    codeId = url.searchParams.get('codeId') || url.searchParams.get('id')

    if (!codeId) {
      try {
        const body = await req.json()
        codeId = body.codeId || body.id || body.code || null
      } catch {
        // body may be empty
      }
    }

    if (!codeId) {
      return NextResponse.json({ error: 'Missing codeId parameter' }, { status: 400 })
    }

    const targetId = String(codeId).trim()
    let codes = getInviteCodes()
    const initialLength = codes.length
    codes = codes.filter(c => c.id !== targetId && c.code.toUpperCase() !== targetId.toUpperCase())

    if (codes.length === initialLength) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 })
    }

    saveInviteCodes(codes)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Error deleting invite code:', err)
    const message = err instanceof Error ? err.message : 'An error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
