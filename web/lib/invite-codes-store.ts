import fs from 'fs'
import path from 'path'
import os from 'os'

export interface InviteCode {
  id: string
  code: string
  durationType: '1_year' | 'lifetime'
  maxUses: number | null // null = unlimited
  usesCount: number
  isActive: boolean
  createdAt: string
  createdBy?: string
}

const DEFAULT_CODES: InviteCode[] = [
  {
    id: 'default-lifetime-1',
    code: 'RYULIFETIME',
    durationType: 'lifetime',
    maxUses: null,
    usesCount: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'default-1year-1',
    code: 'RYU1YEAR',
    durationType: '1_year',
    maxUses: null,
    usesCount: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  }
]

let inMemoryCodes: InviteCode[] | null = null

function getPrimaryFilePath(): string {
  const cwd = process.cwd()
  const baseDir = cwd.endsWith('web') ? cwd : path.join(cwd, 'web')
  return path.join(baseDir, 'lib', 'invite-codes.json')
}

function getTmpFilePath(): string {
  return path.join(os.tmpdir(), 'invite-codes.json')
}

export function getInviteCodes(): InviteCode[] {
  if (inMemoryCodes) {
    return inMemoryCodes
  }

  // 1. Try reading from /tmp if available
  const tmpPath = getTmpFilePath()
  if (fs.existsSync(tmpPath)) {
    try {
      const data = fs.readFileSync(tmpPath, 'utf-8')
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
      const data = fs.readFileSync(primaryPath, 'utf-8')
      inMemoryCodes = JSON.parse(data)
      return inMemoryCodes!
    }
  } catch {
    // fallback
  }

  inMemoryCodes = [...DEFAULT_CODES]
  return inMemoryCodes
}

export function saveInviteCodes(codes: InviteCode[]) {
  inMemoryCodes = codes
  const jsonStr = JSON.stringify(codes, null, 2)

  // 1. Try writing to primary path
  try {
    const primaryPath = getPrimaryFilePath()
    const dir = path.dirname(primaryPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(primaryPath, jsonStr, 'utf-8')
    return
  } catch (err) {
    // Expected on serverless / Vercel (EROFS: read-only file system)
    console.warn('Primary file write restricted, using /tmp fallback:', err instanceof Error ? err.message : err)
  }

  // 2. Fallback to /tmp path (always writable in Lambda / Vercel)
  try {
    const tmpPath = getTmpFilePath()
    fs.writeFileSync(tmpPath, jsonStr, 'utf-8')
  } catch (err) {
    console.error('Error saving invite codes to /tmp:', err)
  }
}

