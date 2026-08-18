import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"
import os from "os"

export interface InviteCode {
  id: string
  code: string
  durationType: "1_month" | "6_months" | "1_year" | "lifetime"
  maxUses: number | null // null = unlimited
  usesCount: number
  isActive: boolean
  createdAt: string
  createdBy?: string
}

const DEFAULT_CODES: InviteCode[] = []

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

function getPrimaryFilePath(): string {
  const cwd = process.cwd()
  const baseDir = cwd.endsWith("web") ? cwd : path.join(cwd, "web")
  return path.join(baseDir, "lib", "invite-codes.json")
}

function getTmpFilePath(): string {
  return path.join(os.tmpdir(), "invite-codes.json")
}

/**
 * Fetch invite codes asynchronously directly from Supabase DB table `invite_codes`.
 * Falls back to local JSON file or default array if table does not exist yet.
 */
export async function getInviteCodesAsync(): Promise<InviteCode[]> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from("invite_codes").select("*").order("created_at", { ascending: false })

    if (!error && data) {
      // Map DB snake_case columns to TS interface
      return data.map(
        (row: {
          id: string
          code: string
          duration_type: "1_month" | "6_months" | "1_year" | "lifetime"
          max_uses: number | null
          uses_count: number
          is_active: boolean
          created_at: string
          created_by?: string
        }) => ({
          id: row.id,
          code: row.code,
          durationType: row.duration_type,
          maxUses: row.max_uses,
          usesCount: row.uses_count ?? 0,
          isActive: row.is_active ?? true,
          createdAt: row.created_at,
          createdBy: row.created_by,
        })
      )
    }
  } catch (err) {
    console.warn("getInviteCodesAsync: Could not query invite_codes table, using file fallback:", err)
  }

  return getInviteCodesFromFile()
}

/**
 * Synchronous fallback reader (used if async not awaited or for backwards compatibility)
 */

let inMemoryCodes: InviteCode[] | null = null

export function getInviteCodesFromFile(): InviteCode[] {
  if (inMemoryCodes) {
    return inMemoryCodes
  }

  // 1. Try reading from /tmp if available
  const tmpPath = getTmpFilePath()
  if (fs.existsSync(tmpPath)) {
    try {
      const data = fs.readFileSync(tmpPath, "utf-8")
      inMemoryCodes = JSON.parse(data)
      return inMemoryCodes!
    } catch {
      // fallback
    }
  }

  // 2. Try reading from primary project directory
  try {
    const primaryPath = getPrimaryFilePath()
    if (fs.existsSync(primaryPath)) {
      const data = fs.readFileSync(primaryPath, "utf-8")
      inMemoryCodes = JSON.parse(data)
      return inMemoryCodes!
    }
  } catch {
    // fallback
  }

  inMemoryCodes = [...DEFAULT_CODES]
  return inMemoryCodes
}

export function getInviteCodes(): InviteCode[] {
  return getInviteCodesFromFile()
}

/**
 * Save invite code to Supabase database table `invite_codes`
 */
export async function saveInviteCodeToDb(codeObj: InviteCode): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from("invite_codes").upsert(
      {
        id: codeObj.id,
        code: codeObj.code.toUpperCase(),
        duration_type: codeObj.durationType,
        max_uses: codeObj.maxUses,
        uses_count: codeObj.usesCount,
        is_active: codeObj.isActive,
        created_at: codeObj.createdAt,
        created_by: codeObj.createdBy || null,
      },
      { onConflict: "id" }
    )

    if (error) {
      console.error("Error saving invite code to Supabase DB:", error)
      return false
    }
    return true
  } catch (err) {
    console.error("Exception saving invite code to Supabase DB:", err)
    return false
  }
}

/**
 * Delete invite code permanently from Supabase database table `invite_codes`
 */
export async function deleteInviteCodeFromDb(targetIdOrCode: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()
    const clean = targetIdOrCode.trim()

    // Delete by id OR code (case-insensitive)
    const { error } = await supabase.from("invite_codes").delete().or(`id.eq.${clean},code.eq.${clean.toUpperCase()}`)

    if (error) {
      console.error("Error deleting invite code from Supabase DB:", error)
      return false
    }

    // Also remove from in-memory / local file fallback
    if (inMemoryCodes) {
      inMemoryCodes = inMemoryCodes.filter((c) => c.id !== clean && c.code.toUpperCase() !== clean.toUpperCase())
      saveInviteCodesFile(inMemoryCodes)
    }

    return true
  } catch (err) {
    console.error("Exception deleting invite code from Supabase DB:", err)
    return false
  }
}

export function saveInviteCodesFile(codes: InviteCode[]) {
  inMemoryCodes = codes
  const jsonStr = JSON.stringify(codes, null, 2)

  try {
    const primaryPath = getPrimaryFilePath()
    const dir = path.dirname(primaryPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(primaryPath, jsonStr, "utf-8")
    return
  } catch (err) {
    console.warn("Primary file write restricted, using /tmp fallback:", err instanceof Error ? err.message : err)
  }

  try {
    const tmpPath = getTmpFilePath()
    fs.writeFileSync(tmpPath, jsonStr, "utf-8")
  } catch (err) {
    console.error("Error saving invite codes to /tmp:", err)
  }
}

export function saveInviteCodes(codes: InviteCode[]) {
  saveInviteCodesFile(codes)
}
