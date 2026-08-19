import { ReactNode } from "react"

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

export function PageHeader({ title, description, action }: Readonly<PageHeaderProps>) {
  return (
    <div className="mb-8 space-y-2">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-foreground font-serif text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {description && <p className="text-muted-foreground max-w-2xl text-sm font-medium">{description}</p>}
    </div>
  )
}
