import { Loader2 } from "lucide-react"

export default function GlobalLoading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
    </div>
  )
}
