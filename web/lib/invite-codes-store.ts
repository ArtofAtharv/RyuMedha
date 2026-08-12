import fs from 'fs'
import path from 'path'

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

function getFilePath(): string {
  const cwd = process.cwd()
  const baseDir = cwd.endsWith('web') ? cwd : path.join(cwd, 'web')
  const libDir = path.join(baseDir, 'lib')
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true })
  }
  return path.join(libDir, 'invite-codes.json')
}

const DEFAULT_CODES: InviteCode[] = [
  {
    id: 'default-lifetime-1',
    code: 'RYULIFETIME',
    durationType: 'lifetime',
    maxUses: null,
    usesCount: 0,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'default-1year-1',
    code: 'RYU1YEAR',
    durationType: '1_year',
    maxUses: null,
    usesCount: 0,
    isActive: true,
    createdAt: new Date().toISOString()
  }
]

export function getInviteCodes(): InviteCode[] {
  try {
    const filePath = getFilePath()
    if (!fs.existsSync(filePath)) {
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(filePath, JSON.stringify(DEFAULT_CODES, null, 2), 'utf-8')
      return DEFAULT_CODES
    }
    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (err) {
    console.error('Error reading invite codes:', err)
    return DEFAULT_CODES
  }
}

export function saveInviteCodes(codes: InviteCode[]) {
  try {
    const filePath = getFilePath()
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(codes, null, 2), 'utf-8')
  } catch (err) {
    console.error('Error saving invite codes:', err)
    throw err
  }
}

