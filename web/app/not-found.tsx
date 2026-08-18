import Link from "next/link"

export default function NotFound() {
  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col items-center justify-center">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-extrabold tracking-tight">404</h1>
        <span className="bg-muted-foreground h-6 w-px"></span>
        <h2 className="text-muted-foreground text-sm">Page Not Found</h2>
      </div>
      <p className="bg-primary/90 text-primary-foreground hover:bg-primary/80 focus:ring-primary m-4 rounded-md px-4 py-2 text-center text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:outline-none">
        <Link href="/" className="flex w-full items-center justify-center">
          ← Return home
        </Link>
      </p>
    </div>
  )
}
