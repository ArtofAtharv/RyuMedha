import { ThemeToggle } from "@/components/theme-toggle";

export default function Footer() {
  return (
    <footer className="flex items-center justify-between py-8 px-6 text-center border-t border-border">
        <div className="flex items-center gap-2">
        </div>
      <p className="text-xs text-muted-foreground">© 2026 Ryu Medha — Flow of Intelligence.</p>
      <ThemeToggle />
    </footer>
  );
}