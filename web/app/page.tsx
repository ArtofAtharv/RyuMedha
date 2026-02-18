import Link from "next/link";
import { HiArrowRight, HiLightningBolt, HiShieldCheck, HiChartBar } from "react-icons/hi";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        
        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 max-w-4xl bg-gradient-to-br from-zinc-900 via-zinc-700 to-zinc-400 dark:from-white dark:via-zinc-200 dark:to-zinc-500 bg-clip-text text-transparent pb-2 animate-in slide-in-from-bottom-10 duration-700">
          Master your academic life. With Ryu Medha.
        </h1>
        
        <p className="text-lg md:text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mb-12 leading-relaxed animate-in slide-in-from-bottom-10 duration-700 delay-100">
          The all-in-one tracker for students. Manage subjects, track attendance, calculate grades, and stay organized. Local-first, cloud-synced, and privacy-focused.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 animate-in slide-in-from-bottom-10 duration-700 delay-200">
          <Link 
            href="/api/auth/signin" 
            className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl flex items-center gap-2 shadow-xl shadow-purple-500/20 hover:shadow-purple-500/40 transition-all hover:-translate-y-1 active:scale-95"
          >
            Get Started <HiArrowRight />
          </Link>
          <a 
            href="#features" 
            className="px-8 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-bold rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
          >
            Learn more
          </a>
        </div>

        {/* Feature Grid */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 max-w-6xl mx-auto w-full text-left">
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
      
      <footer className="py-8 text-center text-zinc-400 text-xs">
        <p>© 2026 Academics Tracker. Built for students.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl hover:border-purple-500/20 transition-all hover:shadow-xl hover:shadow-purple-500/5 group">
      <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-2xl text-zinc-900 dark:text-white mb-6 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
        {icon}
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}
