"use client";

import Link from "next/link";
import { HiArrowRight, HiLightningBolt, HiShieldCheck, HiChartBar, HiStar } from "react-icons/hi";
import { TypingAnimation } from "@/components/ui/typing-animation";
import { motion } from "motion/react";

export default function PremiumLandingPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } },
  };

  return (
    <div className="min-h-screen bg-[#050510] relative text-foreground flex flex-col font-sans overflow-hidden">
      
      {/* ── Premium Background Orbs ────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-screen">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute left-[10%] top-[0%] h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-[120px]" 
        />
        <motion.div 
          animate={{ scale: [1, 1.5, 1], rotate: [0, -90, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute right-[5%] bottom-[5%] h-[500px] w-[500px] rounded-full bg-violet-600/20 blur-[100px]" 
        />
        <div className="absolute top-[40%] left-[50%] h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>

      {/* ── Hero section ───────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-28 relative z-10 w-full max-w-7xl mx-auto">
        
        <motion.div 
          initial="hidden" 
          animate="show" 
          variants={containerVariants}
          className="flex flex-col items-center justify-center w-full"
        >
          {/* Level Badge Hook */}
          <motion.div variants={itemVariants} className="mb-6 flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 backdrop-blur-md">
            <HiStar className="text-yellow-400" />
            <span className="text-sm font-semibold text-indigo-200 tracking-wide uppercase">Level Up Your Academics</span>
          </motion.div>

          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter max-w-5xl leading-[1.1] text-white overflow-hidden pb-4">
            <span className="text-white drop-shadow-lg">Stay <TypingAnimation
              words={["Organised", "Focused", "Unstoppable"]}
              typeSpeed={50}
              deleteSpeed={100}
              pauseDelay={1500}
              loop
              cursorStyle="_"
            /></span>
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 pb-2">
              with Ryu Medha.
            </span>
          </motion.h1>

          <motion.p variants={itemVariants} className="mt-8 text-lg md:text-xl text-indigo-100/70 max-w-2xl leading-relaxed font-medium">
            Track attendance, complete quests, earn XP for your grades, 
            and dominate your syllabus — all from a gamified dashboard.
          </motion.p>

          <motion.div variants={itemVariants} className="mt-12 flex flex-col sm:flex-row gap-5">
            <Link
              href="/sample_ui/login"
              className="px-8 py-4 bg-white text-indigo-950 font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_40px_-5px_var(--color-indigo-500)] hover:shadow-[0_0_60px_-10px_var(--color-indigo-400)] hover:scale-105 transition-all duration-300"
            >
              Start Playing <HiArrowRight className="text-xl" />
            </Link>
            <a
              href="#quests"
              className="px-8 py-4 bg-white/5 border border-white/10 backdrop-blur-md text-white font-bold rounded-2xl flex items-center justify-center hover:bg-white/10 hover:border-white/20 hover:scale-105 transition-all duration-300"
            >
              View Quests
            </a>
          </motion.div>
        </motion.div>

        {/* ── Feature Grid ─────────────────────────────────────────────────── */}
        <motion.div 
          id="quests" 
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-36 max-w-6xl mx-auto w-full text-left"
        >
          <FeatureCard
            icon={<HiLightningBolt />}
            title="Instant XP via WhatsApp"
            description="Log your daily classes like daily quests directly from WhatsApp. No complex apps, just pure progress."
            color="from-yellow-400 to-orange-500"
          />
          <FeatureCard
            icon={<HiChartBar />}
            title="Level Up Your CGPA"
            description="Watch your stats grow. We calculate expectations and provide the XP needed to hit your next GPA milestone."
            color="from-cyan-400 to-blue-500"
          />
          <FeatureCard
            icon={<HiShieldCheck />}
            title="Unlock Achievements"
            description="Earn badges for perfect attendance streaks, clearing assignments early, and unlocking your true potential."
            color="from-purple-400 to-pink-500"
          />
        </motion.div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, y: 30 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80 } }
      }}
      whileHover={{ y: -10, scale: 1.02 }}
      className="group relative p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden hover:border-white/20 transition-all duration-500 h-full flex flex-col"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${color} opacity-10 blur-3xl group-hover:opacity-30 transition-opacity duration-500 rounded-full translate-x-1/2 -translate-y-1/2`} />
      
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-6 bg-gradient-to-br ${color} text-white shadow-lg shadow-black/20 z-10`}>
        {icon}
      </div>
      <h3 className="font-bold text-2xl mb-3 text-white z-10">{title}</h3>
      <p className="text-base text-indigo-100/60 leading-relaxed z-10 flex-1">{description}</p>
    </motion.div>
  );
}
