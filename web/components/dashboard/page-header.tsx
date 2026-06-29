import { ReactNode } from "react"

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

export function PageHeader({ title, description, action }: Readonly<PageHeaderProps>) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex items-center gap-2 shrink-0">
          {action}
        </div>
      )}
    </div>
  )
}
