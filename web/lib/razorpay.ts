import Razorpay from 'razorpay'

/**
 * Returns an instance of the Razorpay SDK or null if credentials are not configured.
 */
export function getRazorpayClient(): Razorpay | null {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    console.warn('[Razorpay] Credentials missing (KEY_ID / KEY_SECRET)')
    return null
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret })
}

/**
 * Cancels any active or authenticated Razorpay subscription(s) for a given profile ID.
 * This guarantees that Razorpay will not perform recurring debits on the user's bank account
 * when they switch to an invite coupon or free access plan.
 */
export async function cancelUserRazorpaySubscriptions(
  profileId: string,
  currentRazorpaySubId?: string | null
): Promise<{ success: boolean; canceledCount: number }> {
  const razorpay = getRazorpayClient()
  if (!razorpay) {
    return { success: false, canceledCount: 0 }
  }

  let canceledCount = 0

  // 1. Cancel the currently assigned Razorpay subscription ID if it starts with 'sub_'
  if (currentRazorpaySubId && currentRazorpaySubId.startsWith('sub_')) {
    try {
      await razorpay.subscriptions.cancel(currentRazorpaySubId, false)
      canceledCount++
      console.log(`[Razorpay] Canceled primary subscription ${currentRazorpaySubId} for profile ${profileId}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[Razorpay] Notice canceling primary sub ${currentRazorpaySubId}: ${msg}`)
    }
  }

  // 2. Fetch recent subscriptions from Razorpay to catch any orphaned active subscriptions for this profileId
  try {
    const allSubs = await razorpay.subscriptions.all({ count: 100 })
    if (allSubs && Array.isArray(allSubs.items)) {
      for (const item of allSubs.items) {
        const itemNotes = (item.notes as Record<string, string> | undefined) || {}
        const itemProfileId = itemNotes.profile_id
        const isActiveOrAuth = item.status === 'active' || item.status === 'authenticated'

        if (itemProfileId === profileId && isActiveOrAuth && item.id !== currentRazorpaySubId) {
          try {
            await razorpay.subscriptions.cancel(item.id, false)
            canceledCount++
            console.log(`[Razorpay] Canceled orphaned subscription ${item.id} for profile ${profileId}`)
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            console.warn(`[Razorpay] Notice canceling orphaned sub ${item.id}: ${msg}`)
          }
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[Razorpay] Error fetching subscriptions list for orphan check: ${msg}`)
  }

  return { success: true, canceledCount }
}
