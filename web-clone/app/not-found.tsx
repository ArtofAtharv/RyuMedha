import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-2">
      <h1 className="text-xl font-extrabold tracking-tight">404</h1>
      <span className="h-6 w-px bg-muted-foreground"></span>
      <h2 className="text-sm text-muted-foreground">Page Not Found</h2>
      </div>
      <p className="rounded-md px-4 py-2 font-medium bg-primary/90 text-center text-sm m-4 text-primary-foreground hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
            <Link href="/" className="w-full flex items-center justify-center">
              ← Return home
            </Link>
          </p>
    </div>
  )
}