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

const FILE_PATH = path.join(process.cwd(), 'lib', 'invite-codes.json')

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
    if (!fs.existsSync(FILE_PATH)) {
      const dir = path.dirname(FILE_PATH)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(FILE_PATH, JSON.stringify(DEFAULT_CODES, null, 2), 'utf-8')
      return DEFAULT_CODES
    }
    const data = fs.readFileSync(FILE_PATH, 'utf-8')
    return JSON.parse(data)
  } catch (err) {
    console.error('Error reading invite codes:', err)
    return DEFAULT_CODES
  }
}

export function saveInviteCodes(codes: InviteCode[]) {
  try {
    const dir = path.dirname(FILE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(FILE_PATH, JSON.stringify(codes, null, 2), 'utf-8')
  } catch (err) {
    console.error('Error saving invite codes:', err)
  }
}
