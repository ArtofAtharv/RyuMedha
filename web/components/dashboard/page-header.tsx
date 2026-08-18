import { ReactNode } from "react"

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

export function PageHeader({ title, description, action }: Readonly<PageHeaderProps>) {
  return (
    <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 className="text-foreground font-serif text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm font-medium">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
