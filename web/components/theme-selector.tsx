'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type ColorTheme = 'neutral' | 'violet' | 'green' | 'rose' | 'orange'

const THEMES: { value: ColorTheme; label: string; color: string }[] = [
  { value: 'neutral', label: 'Neutral', color: 'bg-zinc-900 dark:bg-zinc-100' },
  { value: 'violet', label: 'Purple', color: 'bg-violet-600' },
  { value: 'green', label: 'Green', color: 'bg-green-600' },
  { value: 'rose', label: 'Rose', color: 'bg-rose-600' },
  { value: 'orange', label: 'Orange', color: 'bg-orange-500' },
]

const STORAGE_KEY = 'ryumedha-color-theme'

export function ThemeSelector() {
  const [active, setActive] = useState<ColorTheme>('neutral')

  // Load saved theme on mount (migrate old 'blue' → 'violet')
  useEffect(() => {
    let saved = (localStorage.getItem(STORAGE_KEY) as ColorTheme) ?? 'neutral'
    if ((saved as string) === 'blue') saved = 'violet'
    applyTheme(saved)
    setActive(saved)
  }, [])

  function applyTheme(theme: ColorTheme) {
    const root = document.documentElement
    if (theme === 'neutral') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
    localStorage.setItem(STORAGE_KEY, theme)
    setActive(theme)
  }

  const current = THEMES.find((t) => t.value === active)!

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" aria-label="Color theme">
          <span className={`h-3.5 w-3.5 rounded-full ${current.color}`} />
          <span className="hidden sm:inline">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Color theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => applyTheme(t.value)}
            className="gap-2"
          >
            <span className={`h-4 w-4 rounded-full ${t.color}`} />
            {t.label}
            {active === t.value && <Check className="ml-auto h-3 w-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
