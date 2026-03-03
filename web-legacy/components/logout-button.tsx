'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  return (
    <Button
      variant="outline"
      size="default"
      className="hover:text-destructive focus:text-destructive"
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      <LogOut className="h-4 w-4" />
    </Button>
  )
}
