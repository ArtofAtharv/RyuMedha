"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function WhatsAppRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/dashboard/admin")
  }, [router])

  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Loader2 className="text-primary h-8 w-8 animate-spin" />
    </div>
  )
}
