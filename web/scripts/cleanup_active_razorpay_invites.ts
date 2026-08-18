import { createClient, SupabaseClient } from "@supabase/supabase-js"
import Razorpay from "razorpay"
import fs from "node:fs"
import path from "node:path"

function parseEnvLine(line: string, envMap: Record<string, string>) {
  const trimmed = line.trim()
  if (trimmed.startsWith("#") || !trimmed.includes("=")) return
  const [k, ...v] = trimmed.split("=")
  envMap[k] = v.join("=").trim()
}

function loadEnvFromFile(envPath: string): Record<string, string> {
  const envMap: Record<string, string> = {}
  if (!fs.existsSync(envPath)) return envMap

  const lines = fs.readFileSync(envPath, "utf8").split("\n")
  for (const line of lines) {
    parseEnvLine(line, envMap)
  }
  return envMap
}

function loadEnvVariables() {
  let keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID
  let keySecret = process.env.RAZORPAY_KEY_SECRET
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!keyId || !keySecret || !supabaseUrl || !supabaseKey) {
    const envPath = path.join(__dirname, "..", ".env")
    const envMap = loadEnvFromFile(envPath)

    keyId = keyId || envMap["NEXT_PUBLIC_RAZORPAY_KEY_ID"] || envMap["RAZORPAY_KEY_ID"]
    keySecret = keySecret || envMap["RAZORPAY_KEY_SECRET"]
    supabaseUrl = supabaseUrl || envMap["NEXT_PUBLIC_SUPABASE_URL"]
    supabaseKey = supabaseKey || envMap["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
  }

  return { keyId, keySecret, supabaseUrl, supabaseKey }
}

async function fetchSupabaseSubscriptions(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data: inviteSubs, error } = await supabase
    .from("subscriptions")
    .select("profile_id, razorpay_subscription_id, current_period_end")

  if (error) {
    console.error("Error fetching subscriptions from Supabase:", error)
    return new Map()
  }

  console.log(`Total user subscriptions in Supabase: ${inviteSubs?.length || 0}`)

  const inviteProfileMap = new Map<string, string>()
  for (const s of inviteSubs || []) {
    if (s.razorpay_subscription_id?.startsWith("invite_") || s.razorpay_subscription_id?.startsWith("admin_free_")) {
      inviteProfileMap.set(s.profile_id, s.razorpay_subscription_id)
    }
  }

  console.log(`Profiles currently with Invite Code / Admin Free Access: ${inviteProfileMap.size}`)
  return inviteProfileMap
}

async function cancelRazorpaySubscriptions(razorpay: Razorpay, inviteProfileMap: Map<string, string>): Promise<number> {
  console.log("Fetching active subscriptions from Razorpay...")
  const rzpSubs = await razorpay.subscriptions.all({ count: 100 })

  let canceledCount = 0
  for (const sub of rzpSubs.items) {
    const profileId = (sub.notes as { profile_id?: string })?.profile_id
    const isActiveOrAuth = sub.status === "active" || sub.status === "authenticated"

    if (profileId && inviteProfileMap.has(profileId) && isActiveOrAuth) {
      console.log(
        `Found active Razorpay subscription ${sub.id} for profile ${profileId} who is on free access (${inviteProfileMap.get(profileId)})! Canceling now...`
      )
      try {
        await razorpay.subscriptions.cancel(sub.id, false) // cancel_at_cycle_end = false
        canceledCount++
        console.log(`Successfully canceled Razorpay subscription ${sub.id}`)
      } catch (err: unknown) {
        console.error(`Failed to cancel Razorpay subscription ${sub.id}:`, (err as Error)?.message || err)
      }
    }
  }

  return canceledCount
}

async function runCleanup() {
  console.log("=== Starting Razorpay Active Subscriptions Audit & Cleanup ===")

  const { keyId, keySecret, supabaseUrl, supabaseKey } = loadEnvVariables()

  if (!keyId || !keySecret || !supabaseUrl || !supabaseKey) {
    console.error("Error: Credentials missing from env.")
    return
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
  const supabase = createClient(supabaseUrl, supabaseKey)

  const inviteProfileMap = await fetchSupabaseSubscriptions(supabase)

  if (inviteProfileMap.size === 0) {
    console.log("=== Audit Completed! No invite subscriptions found. ===")
    return
  }

  const canceledCount = await cancelRazorpaySubscriptions(razorpay, inviteProfileMap)

  console.log(`=== Audit Completed! Total active Razorpay subscriptions canceled: ${canceledCount} ===`)
}

runCleanup().catch((err) => {
  console.error("Cleanup script error:", err)
})
