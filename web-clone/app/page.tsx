"use client"

import Link from "next/link";
import { HiArrowRight, HiLightningBolt, HiShieldCheck, HiChartBar } from "react-icons/hi";
import { TypingAnimation } from "@/components/ui/typing-animation"
import { motion, Variants } from "motion/react"

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    }
  }
}

const itemVariants: Variants = {
  hidden: { y: 30, opacity: 0, filter: "blur(4px)" },
  visible: {
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-hidden">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 relative overflow-hidden">

        {/* Background glow blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.15, 0.1],
              rotate: [0, 90, 0]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute left-1/2 top-1/4 h-[600px] w-[600px] -translate-x-1/2 rounded-full gradient-accent blur-3xl" 
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.5, 1],
              opacity: [0.05, 0.1, 0.05],
              rotate: [0, -90, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute right-0 bottom-0 h-[300px] w-[300px] rounded-full gradient-accent blur-2xl" 
          />
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center z-10 w-full"
        >
          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-black tracking-tight max-w-4xl leading-[1.05]">
            <span className="text-foreground">Stay <TypingAnimation
              words={["Organised", "Focused"]}
              typeSpeed={50}
              deleteSpeed={150}
              pauseDelay={1000}
              loop
              cursorStyle="underscore"
            /></span>
            <br />
            <span className="gradient-accent-text pb-2">with Ryu Medha.</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
            Track attendance, calculate grades, manage hobbies,
            and stay on top of your academics — all from WhatsApp.
          </motion.p>

          <motion.div variants={itemVariants} className="mt-10 flex flex-col sm:flex-row gap-3">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/login"
                className="px-8 py-3.5 gradient-accent text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
              >
                Get Started <HiArrowRight />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <a
                href="#features"
                className="px-8 py-3.5 bg-card border border-border font-semibold rounded-xl hover:bg-accent hover:text-accent-foreground transition-colors block"
              >
                Learn more
              </a>
            </motion.div>
          </motion.div>

          {/* ── Feature Grid ─────────────────────────────────────────────────── */}
          <motion.div 
            id="features" 
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-28 max-w-5xl w-full text-left"
          >
            <FeatureCard
              icon={<HiLightningBolt />}
              title="Whatsapp Integration"
              description="No more juggling apps. Interact with Ryu Medha directly through WhatsApp — the tools you need, where you already are."
              delay={0.1}
            />
            <FeatureCard
              icon={<HiChartBar />}
              title="Performance Tracking"
              description="Visualize your performance. Calculate CGPA, track assignments, and never miss a deadline."
              delay={0.2}
            />
            <FeatureCard
              icon={<HiShieldCheck />}
              title="Unlock Your Potential"
              description="Track your progress, set goals, and unlock your best self with personalized insights and weekly reports."
              delay={0.3}
            />
          </motion.div>
        </motion.div>
      </main>

    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  delay
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div 
      variants={itemVariants}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group p-7 bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-colors cursor-default"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5 transition-all duration-300 gradient-accent-subtle text-primary group-hover:gradient-accent group-hover:text-white group-hover:scale-110 group-hover:shadow-md group-hover:shadow-primary/30">
        {icon}
      </div>
      <h3 className="font-bold text-base mb-2 text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}
