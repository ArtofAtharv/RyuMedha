import Link from "next/link";
import { HiArrowRight, HiLightningBolt, HiShieldCheck, HiChartBar } from "react-icons/hi";
import { TypingAnimation } from "@/components/ui/typing-animation"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 relative overflow-hidden">

        {/* Background glow blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/4 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-0 bottom-0 h-[300px] w-[300px] rounded-full bg-primary/5 blur-2xl" />
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight max-w-4xl leading-[1.05] animate-in slide-in-from-bottom-8 duration-700">
          <span className="text-foreground">Stay <TypingAnimation
            words={["Organised", "Focused"]}
            typeSpeed={50}
            deleteSpeed={150}
            pauseDelay={1000}
            loop
            cursorStyle="underscore"
          /></span>
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
            title="Whatsapp Integration"
            description="No more juggling apps. Interact with Ryu Medha directly through WhatsApp — the tools you need, where you already are."
          />
          <FeatureCard
            icon={<HiChartBar />}
            title="Performance Tracking"
            description="Visualize your performance. Calculate CGPA, track assignments, and never miss a deadline."
          />
          <FeatureCard
            icon={<HiShieldCheck />}
            title="Unlock Your Potential"
            description="Track your progress, set goals, and unlock your best self with personalized insights and weekly reports."
          />
        </div>
      </main>

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
