"use client"

import { useCallback, useRef, useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number
}

export const AnimatedThemeToggler = ({ className, duration = 500, ...props }: AnimatedThemeTogglerProps) => {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const buttonRef = useRef<HTMLButtonElement>(null)
  const isDark = mounted ? resolvedTheme === "dark" : false

  const toggleTheme = useCallback(async () => {
    if (!buttonRef.current || !document.startViewTransition) {
      setTheme(isDark ? "light" : "dark")
      return
    }

    const newTheme = isDark ? "light" : "dark"
    const isNewDark = newTheme === "dark"

    const { top, left, width, height } = buttonRef.current.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const maxRadius = Math.hypot(Math.max(left, window.innerWidth - left), Math.max(top, window.innerHeight - top))

    // Create a style element to completely disable CSS transitions during the View Transition.
    // This prevents "lag" caused by CSS transitions competing with the View Transition snapshotting.
    const css = document.createElement("style")
    css.appendChild(
      document.createTextNode(
        `* {
       -webkit-transition: none !important;
       -moz-transition: none !important;
       -o-transition: none !important;
       -ms-transition: none !important;
       transition: none !important;
    }`
      )
    )

    const transition = document.startViewTransition(() => {
      document.head.appendChild(css)
      // Modify DOM class instantly without triggering a React re-render
      document.documentElement.classList.toggle("dark", isNewDark)
      // Since next-themes uses color-scheme on HTML, update that too if needed
      document.documentElement.style.colorScheme = newTheme
    })

    await transition.ready

    document.documentElement.animate(
      {
        clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`],
      },
      {
        duration,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        pseudoElement: "::view-transition-new(root)",
      }
    )

    await transition.finished

    // Clean up and sync React/next-themes state asynchronously to avoid interrupting animation
    document.head.removeChild(css)
    setTheme(newTheme)
    // Remove the inline style we set so next-themes takes over cleanly
    document.documentElement.style.removeProperty("color-scheme")
  }, [isDark, setTheme, duration])

  // Prevent hydration mismatch on icon
  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className={cn(className)} {...props}>
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  return (
    <Button variant="outline" size="icon" ref={buttonRef} onClick={toggleTheme} className={cn(className)} {...props}>
      {isDark ? (
        <Sun className="h-[1.2rem] w-[1.2rem] transition-all" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem] transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
