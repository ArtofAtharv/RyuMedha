"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function WhatsAppRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/admin')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )
}
