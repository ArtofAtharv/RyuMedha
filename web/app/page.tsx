import Link from "next/link";
import { HiArrowRight, HiLightningBolt, HiShieldCheck, HiChartBar } from "react-icons/hi";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground text-xs font-black shadow-md shadow-primary/30">
              R
            </div>
            <span className="font-black tracking-tight text-sm">Ryu Medha</span>
          </div>
          <Link
            href="/login"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in →
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 relative overflow-hidden">

        {/* Background glow blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/4 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-0 bottom-0 h-[300px] w-[300px] rounded-full bg-primary/5 blur-2xl" />
        </div>

        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs font-semibold text-muted-foreground shadow-sm animate-in fade-in duration-500">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Academic year 2025–26
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight max-w-4xl leading-[1.05] animate-in slide-in-from-bottom-8 duration-700">
          <span className="text-foreground">Stay organised</span>
          <br />
          <span className="text-primary">with Ryu Medha.</span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed animate-in slide-in-from-bottom-8 duration-700 delay-100">
          Track attendance, calculate grades, manage hobbies,
          and stay on top of your academics — all from WhatsApp.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 animate-in slide-in-from-bottom-8 duration-700 delay-200">
          <Link
            href="/login"
            className="px-8 py-3.5 bg-primary text-primary-foreground font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:opacity-90 hover:-translate-y-0.5 transition-all active:scale-95"
          >
            Get Started <HiArrowRight />
          </Link>
          <a
            href="#features"
            className="px-8 py-3.5 bg-card border border-border font-semibold rounded-xl hover:bg-accent hover:text-accent-foreground transition-all"
          >
            Learn more
          </a>
        </div>

        {/* ── Feature Grid ─────────────────────────────────────────────────── */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-28 max-w-5xl mx-auto w-full text-left">
          <FeatureCard
            icon={<HiLightningBolt />}
            title="Instant Sync"
            description="Changes save to your device instantly and sync to the cloud in the background. Works offline."
          />
          <FeatureCard
            icon={<HiChartBar />}
            title="Grade Tracking"
            description="Visualize your performance. Calculate CGPA, track assignments, and never miss a deadline."
          />
          <FeatureCard
            icon={<HiShieldCheck />}
            title="Privacy First"
            description="Your data lives on your device. We only sync what's necessary. You are in control."
          />
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="py-8 text-center border-t border-border">
        <p className="text-xs text-muted-foreground">© 2026 Ryu Medha — Flow of Intelligence.</p>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group p-7 bg-card border border-border rounded-2xl hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5 transition-all duration-300 bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 group-hover:shadow-md group-hover:shadow-primary/30">
        {icon}
      </div>
      <h3 className="font-bold text-base mb-2 text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
