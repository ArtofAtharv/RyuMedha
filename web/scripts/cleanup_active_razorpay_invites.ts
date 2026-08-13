import { createClient } from '@supabase/supabase-js'
import Razorpay from 'razorpay'
import fs from 'fs'
import path from 'path'

async function runCleanup() {
  console.log('=== Starting Razorpay Active Subscriptions Audit & Cleanup ===')

  // Load env variables if not set
  let keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID
  let keySecret = process.env.RAZORPAY_KEY_SECRET
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!keyId || !keySecret || !supabaseUrl || !supabaseKey) {
    const envPath = path.join(__dirname, '..', '.env')
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue
        const [k, ...v] = trimmed.split('=')
        const val = v.join('=').trim()
        if (k === 'NEXT_PUBLIC_RAZORPAY_KEY_ID' || k === 'RAZORPAY_KEY_ID') keyId = keyId || val
        if (k === 'RAZORPAY_KEY_SECRET') keySecret = keySecret || val
        if (k === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = supabaseUrl || val
        if (k === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') supabaseKey = supabaseKey || val
      }
    }
  }

  if (!keyId || !keySecret || !supabaseUrl || !supabaseKey) {
    console.error('Error: Credentials missing from env.')
    return
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Fetch all user subscriptions from Supabase that have invite_ or admin_free_ status
  const { data: inviteSubs, error } = await supabase
    .from('subscriptions')
    .select('profile_id, razorpay_subscription_id, current_period_end')

  if (error) {
    console.error('Error fetching subscriptions from Supabase:', error)
    return
  }

  console.log(`Total user subscriptions in Supabase: ${inviteSubs?.length || 0}`)

  const inviteProfileMap = new Map<string, string>()
  for (const s of inviteSubs || []) {
    if (s.razorpay_subscription_id?.startsWith('invite_') || s.razorpay_subscription_id?.startsWith('admin_free_')) {
      inviteProfileMap.set(s.profile_id, s.razorpay_subscription_id)
    }
  }

  console.log(`Profiles currently with Invite Code / Admin Free Access: ${inviteProfileMap.size}`)

  // 2. Fetch all subscriptions from Razorpay
  console.log('Fetching active subscriptions from Razorpay...')
  const rzpSubs = await razorpay.subscriptions.all({ count: 100 })

  let canceledCount = 0
  for (const sub of rzpSubs.items) {
    const profileId = (sub.notes as any)?.profile_id
    const isActiveOrAuth = sub.status === 'active' || sub.status === 'authenticated'

    if (profileId && inviteProfileMap.has(profileId) && isActiveOrAuth) {
      console.log(`Found active Razorpay subscription ${sub.id} for profile ${profileId} who is on free access (${inviteProfileMap.get(profileId)})! Canceling now...`)
      try {
        await razorpay.subscriptions.cancel(sub.id, false) // cancel_at_cycle_end = false
        canceledCount++
        console.log(`Successfully canceled Razorpay subscription ${sub.id}`)
      } catch (err: any) {
        console.error(`Failed to cancel Razorpay subscription ${sub.id}:`, err?.message || err)
      }
    }
  }

  console.log(`=== Audit Completed! Total active Razorpay subscriptions canceled: ${canceledCount} ===`)
}

runCleanup().catch(err => {
  console.error('Cleanup script error:', err)
})
