"use client"

import Link from "next/link";
import {
  ArrowRight, Zap, BarChart2, ShieldCheck,
  BookOpen, Clock, CheckSquare, GraduationCap,
  MessageCircle, BarChart, Timer
} from "lucide-react";
import { m, Variants } from "motion/react"
import type { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/* ── animation presets ── */
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.05 }
  }
}
const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0, opacity: 1,
    transition: { type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.4 }
  }
}
const fadeUp: Variants = {
  hidden: { y: 32, opacity: 0 },
  visible: {
    y: 0, opacity: 1,
    transition: { type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.4 }
  }
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long"
  })
}

export default function LandingPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.push("/dashboard");
  }, [status, router]);

  if (status === "loading" || status === "authenticated") return null;

  return (
    <div className="bg-background text-foreground">

      {/* ══════════════════════════════════════════
          HERO — full viewport below navbar
          ══════════════════════════════════════════ */}
      <section
        className="flex items-center"
        style={{ minHeight: "calc(100vh - 56px)" }}
      >
        <m.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full px-5 sm:px-8 lg:px-14 xl:px-20 py-10 grid items-center gap-10 lg:grid-cols-[1fr_480px] xl:grid-cols-[1fr_520px]"
        >
          {/* Left */}
          <div className="max-w-2xl">
            <m.h1
              variants={itemVariants}
              className="text-5xl font-semibold tracking-[-0.055em] text-balance leading-[1.06] md:text-6xl lg:text-7xl xl:text-8xl"
            >
              Own your<br />semester,<br />
              <span className="text-primary">every single day.</span>
            </m.h1>

            <m.p
              variants={itemVariants}
              className="mt-6 max-w-xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8"
            >
              Ryu Medha keeps attendance, grades, tasks, and study sessions
              in one calm workspace. The fastest way in is a WhatsApp message
              you already know how to send.
            </m.p>

            <m.div
              variants={itemVariants}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-75"
              >
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex h-12 items-center justify-center rounded-full border border-border px-7 text-sm font-semibold transition-colors hover:bg-muted"
              >
                See how it works
              </a>
            </m.div>
          </div>

          {/* Right -- preview card */}
          <m.div
            variants={itemVariants}
            className="w-full rounded-3xl border border-border bg-card/60 backdrop-blur-md shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-sm font-semibold">Today</p>
                <p className="text-xs text-muted-foreground mt-0.5">{todayLabel()}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 border border-green-500/20 px-3 py-1 text-xs font-semibold text-green-600 dark:text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {" "}On track
              </span>
            </div>

            <div className="divide-y divide-border">
              <PreviewMetric icon={<BookOpen className="h-4 w-4" />} label="Attendance" value="84%" detail="2 lectures left to mark today" color="text-blue-500" bg="bg-blue-500/10" />
              <PreviewMetric icon={<GraduationCap className="h-4 w-4" />} label="Grade average" value="8.6" detail="3 scores updated this week" color="text-violet-500" bg="bg-violet-500/10" />
              <PreviewMetric icon={<Clock className="h-4 w-4" />} label="Focus time" value="2h 15m" detail="Across 4 sessions today" color="text-orange-500" bg="bg-orange-500/10" />
              <PreviewMetric icon={<CheckSquare className="h-4 w-4" />} label="Tasks due" value="3" detail="1 assignment, 2 personal goals" color="text-rose-500" bg="bg-rose-500/10" />
            </div>

            <div className="m-4 rounded-2xl border border-border bg-muted/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="h-4 w-4 text-green-500" />
                <p className="text-sm font-semibold">WhatsApp shortcut</p>
              </div>
              <p className="text-sm text-muted-foreground leading-6">
                Send{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                  mark today present
                </code>{" "}
                and your dashboard updates in seconds. No app switching needed.
              </p>
            </div>
          </m.div>
        </m.div>
      </section>

      {/* ══════════════════════════════════════════
          FEATURE STRIP
          ══════════════════════════════════════════ */}
      <m.section
        id="features"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="border-y border-border min-h-screen flex flex-col justify-center px-5 sm:px-8 lg:px-14 xl:px-20 py-20"
      >
        <m.p variants={fadeUp} className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Why Ryu Medha
        </m.p>
        <m.h2 variants={fadeUp} className="text-3xl font-semibold tracking-tight md:text-4xl text-balance max-w-2xl mb-12">
          Three principles. One tool that respects your time.
        </m.h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon={<Zap className="h-5 w-5" />}
            title="Captured in a heartbeat"
            description="Logging should never interrupt thinking. Ryu Medha is built for speed above all else."
            bullets={[
              "Mark attendance from WhatsApp in one message",
              "Add tasks without leaving your current screen",
              "Start a focus timer with a single tap",
            ]}
          />
          <FeatureCard
            icon={<BarChart2 className="h-5 w-5" />}
            title="Progress you can feel"
            description="Not just numbers. Patterns and signals that tell you something genuinely useful."
            bullets={[
              "Attendance percentage per subject, always visible",
              "Grade average updated after every exam",
              "Focus hours charted day by day",
            ]}
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Calm by design"
            description="No dark patterns, no guilt mechanics. Just the information you asked for, nothing more."
            bullets={[
              "Zero push notifications by default",
              "No social comparison or leaderboards",
              "Your data stays private, always",
            ]}
          />
        </div>
      </m.section>

      {/* ══════════════════════════════════════════
          WHAT IS RYU MEDHA — full screen
          ══════════════════════════════════════════ */}
      <section className="min-h-screen flex items-center border-b border-border px-5 sm:px-8 lg:px-14 xl:px-20">
        <m.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="max-w-3xl py-16"
        >
          <m.p variants={fadeUp} className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            What it is
          </m.p>
          <m.h2 variants={fadeUp} className="text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl text-balance">
            One place for your entire academic life.
          </m.h2>
          <m.p variants={fadeUp} className="mt-6 text-base leading-7 text-muted-foreground md:text-lg">
            Most students juggle five different apps: one for attendance,
            another for tasks, a spreadsheet for grades, a timer app, and
            a notes folder. Ryu Medha collapses all of that into a single,
            quietly intelligent workspace that stays out of your way.
          </m.p>
          <m.p variants={fadeUp} className="mt-4 text-base leading-7 text-muted-foreground md:text-lg">
            And because the best interface is one you already have open,
            the WhatsApp bot lets you log attendance, check your stats, and
            manage tasks without ever opening a browser.
          </m.p>
          <m.div variants={fadeUp} className="mt-10 flex flex-wrap gap-4">
            {[
              { icon: <BookOpen className="h-4 w-4" />, text: "Attendance per subject" },
              { icon: <GraduationCap className="h-4 w-4" />, text: "Cumulative grade tracking" },
              { icon: <CheckSquare className="h-4 w-4" />, text: "Task deadlines" },
              { icon: <Timer className="h-4 w-4" />, text: "Focus sessions" },
              { icon: <BarChart className="h-4 w-4" />, text: "Study analytics" },
              { icon: <MessageCircle className="h-4 w-4" />, text: "WhatsApp commands" },
            ].map((item) => (
              <span key={item.text} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium text-foreground">
                <span className="text-primary">{item.icon}</span>
                {item.text}
              </span>
            ))}
          </m.div>
        </m.div>
      </section>

      {/* ══════════════════════════════════════════
          FEATURES DEEP DIVE — full screen
          ══════════════════════════════════════════ */}
      <section className="min-h-screen flex items-center border-b border-border px-5 sm:px-8 lg:px-14 xl:px-20">
        <m.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="w-full py-16"
        >
          <m.p variants={fadeUp} className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Every feature, intentional
          </m.p>
          <m.h2 variants={fadeUp} className="mb-10 text-3xl font-semibold tracking-tight md:text-4xl text-balance">
            Built around how you actually study.
          </m.h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DeepFeatureCard icon={<BookOpen className="h-5 w-5" />} color="blue" title="Attendance Tracker" description="Mark present, absent, or deemed for each subject. Get warned the moment your percentage drops below your target. Never get surprised by a shortage." />
            <DeepFeatureCard icon={<GraduationCap className="h-5 w-5" />} color="violet" title="Grade Book" description="Log marks for every test, quiz, and exam. See your cumulative average update in real time. Know exactly where you stand before results day." />
            <DeepFeatureCard icon={<CheckSquare className="h-5 w-5" />} color="orange" title="Task Manager" description="Separate academic deadlines from personal goals. Due-today alerts, subject-linked tasks, and a clean list that doesn't overwhelm you." />
            <DeepFeatureCard icon={<Timer className="h-5 w-5" />} color="rose" title="Focus Timers" description="Stopwatch and Pomodoro modes built in. Every session is logged so you can see how many hours you've actually invested in each subject." />
            <DeepFeatureCard icon={<BarChart2 className="h-5 w-5" />} color="green" title="Study Analytics" description="Visual charts of your focus sessions over time. Spot your most productive days, your slowest weeks, and plan accordingly." />
            <DeepFeatureCard icon={<MessageCircle className="h-5 w-5" />} color="emerald" title="WhatsApp Bot" description="The fastest interface is a message you already know how to type. Mark attendance, check stats, and manage tasks in under 10 seconds." />
          </div>
        </m.div>
      </section>

      {/* ══════════════════════════════════════════
          DUAL MODE — full screen
          ══════════════════════════════════════════ */}
      <section className="min-h-screen flex items-center border-b border-border px-5 sm:px-8 lg:px-14 xl:px-20">
        <m.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="w-full py-16 grid gap-12 lg:grid-cols-2 lg:items-center"
        >
          <div>
            <m.p variants={fadeUp} className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Two modes, one dashboard
            </m.p>
            <m.h2 variants={fadeUp} className="text-3xl font-semibold tracking-tight md:text-4xl text-balance">
              College subjects and personal goals, side by side.
            </m.h2>
            <m.p variants={fadeUp} className="mt-5 text-base leading-7 text-muted-foreground">
              Your life is not just lectures and exams. Ryu Medha has an
              Academic mode for your college subjects and a Personal mode for
              everything else: learning guitar, building a startup, preparing
              for competitive exams.
            </m.p>
            <m.p variants={fadeUp} className="mt-4 text-base leading-7 text-muted-foreground">
              Both modes share the same task manager, timer, and analytics,
              so you get a complete picture of how you spend your time, not
              just your exam-ready hours.
            </m.p>
          </div>

          <m.div variants={fadeUp} className="grid gap-3 sm:grid-cols-2">
            <DualModeCard
              label="Academic"
              items={["Attendance per subject", "Deemed and shortage warnings", "Semester-scoped grades", "Assignment deadlines"]}
              accent="blue"
            />
            <DualModeCard
              label="Personal"
              items={["Custom learning tracks", "Skill score board", "Goal-linked tasks", "Deep work analytics"]}
              accent="violet"
            />
          </m.div>
        </m.div>
      </section>

      {/* ══════════════════════════════════════════
          BY THE NUMBERS
          ══════════════════════════════════════════ */}
      <section className="min-h-screen flex items-center border-b border-border px-5 sm:px-8 lg:px-14 xl:px-20">
        <m.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="w-full py-16"
        >
          <m.p variants={fadeUp} className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            By the numbers
          </m.p>
          <m.h2 variants={fadeUp} className="text-3xl font-semibold tracking-tight md:text-4xl text-balance max-w-2xl">
            Built to be fast, free, and frictionless.
          </m.h2>
          <m.p variants={fadeUp} className="mt-4 mb-12 max-w-xl text-base leading-7 text-muted-foreground">
            No setup fees, no paywalls, no complexity. Ryu Medha is designed to get out of your way and let you focus on what matters.
          </m.p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCell
              value="100%"
              label="Free to use"
              description="No subscription, no trial period. Every feature is unlocked for every student from the moment they sign up."
            />
            <StatCell
              value="WhatsApp"
              label="Primary interface"
              description="No app to install, no new habit to build. The fastest interface is the one already open on your phone."
            />
            <StatCell
              value="5 sec"
              label="To log attendance"
              description="Send one message. Your attendance is marked, your dashboard updates, and you are already back to your lecture."
            />
            <StatCell
              value="1 app"
              label="For your entire semester"
              description="Attendance, grades, tasks, focus timers, and analytics. Everything you need, in one focused workspace."
            />
          </div>
        </m.div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS
          ══════════════════════════════════════════ */}
      <section className="min-h-screen flex items-center border-b border-border px-5 sm:px-8 lg:px-14 xl:px-20">
        <m.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="w-full py-16"
        >
          <m.p variants={fadeUp} className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Getting started
          </m.p>
          <m.h2 variants={fadeUp} className="text-3xl font-semibold tracking-tight md:text-4xl text-balance max-w-2xl">
            Up and running in under two minutes.
          </m.h2>
          <m.p variants={fadeUp} className="mt-4 mb-12 max-w-xl text-base leading-7 text-muted-foreground">
            No signup form, no onboarding slides, no waiting. Just open WhatsApp and you are already in.
          </m.p>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Sign up via WhatsApp",
                body: "Open the Ryu Medha bot and send your first message. No email, no password, no forms. Your account is created the moment you say hello.",
                detail: "Takes about 30 seconds"
              },
              {
                step: "02",
                title: "Add your subjects",
                body: "Tell the bot which subjects you are studying this semester, or add them from the dashboard. Set your attendance target and you are ready.",
                detail: "One time, takes under a minute"
              },
              {
                step: "03",
                title: "Start your semester",
                body: "Mark attendance, log grades, set task deadlines, start a focus timer. Everything you do is reflected across WhatsApp and your dashboard instantly.",
                detail: "Your data, always in sync"
              }
            ].map((s) => (
              <m.div
                key={s.step}
                variants={fadeUp}
                className="group flex flex-col rounded-2xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/25 hover:shadow-sm"
              >
                <span className="mb-5 text-4xl font-bold tracking-tight text-primary/20 leading-none">{s.step}</span>
                <h3 className="text-base font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground flex-1">{s.body}</p>
                <div className="mt-5 inline-flex items-center gap-2 border-t border-border pt-4">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span className="text-xs text-muted-foreground">{s.detail}</span>
                </div>
              </m.div>
            ))}
          </div>
        </m.div>
      </section>

      {/* ══════════════════════════════════════════
          CTA — full screen
          ══════════════════════════════════════════ */}
      <section className="min-h-screen flex items-center px-5 sm:px-8 lg:px-14 xl:px-20">
        <m.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="w-full py-16 flex flex-col items-center text-center gap-6"
        >
          <m.h2 variants={fadeUp} className="text-3xl font-semibold tracking-tight md:text-5xl text-balance max-w-2xl">
            Your semester is already happening. Start tracking it.
          </m.h2>
          <m.p variants={fadeUp} className="text-base text-muted-foreground max-w-lg">
            Free, fast, and built for the way you already live.
            Sign up in under 60 seconds with just your WhatsApp number.
          </m.p>
          <m.div variants={fadeUp} className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-75"
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://wa.me/message/P4QSZGK7MV2PL1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border px-8 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <MessageCircle className="h-4 w-4 text-green-500" />
              Open WhatsApp bot
            </a>
          </m.div>
        </m.div>
      </section>

    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────── */

function PreviewMetric({
  icon, label, value, detail, color, bg
}: Readonly<{
  icon: ReactNode; label: string; value: string; detail: string; color: string; bg: string;
}>) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{detail}</p>
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums shrink-0">{value}</p>
    </div>
  );
}

function FeatureCard({
  icon, title, description, bullets
}: Readonly<{
  icon: ReactNode; title: string; description: string; bullets: string[];
}>) {
  return (
    <m.div
      variants={itemVariants}
      className="group flex flex-col rounded-2xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/25 hover:shadow-sm"
    >
      <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
        {icon}
      </div>

      <div className="flex flex-col flex-1">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      <ul className="mt-6 space-y-3 border-t border-border pt-5">
        {bullets.map((b) => (
          <li key={b} className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">{b}</span>
          </li>
        ))}
      </ul>
    </m.div>
  );
}

const colorMap: Record<string, { icon: string; bg: string; border: string }> = {
  blue: { icon: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  violet: { icon: "text-violet-500", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  orange: { icon: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  rose: { icon: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  green: { icon: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" },
  emerald: { icon: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  crimson: { icon: "text-[#FF4E6B]", bg: "bg-[#FF4E6B]/10", border: "border-[#FF4E6B]/20" },
}

function DeepFeatureCard({
  icon, color, title, description
}: Readonly<{
  icon: ReactNode; color: string; title: string; description: string;
}>) {
  const c = colorMap[color] ?? colorMap.blue
  return (
    <m.div
      variants={fadeUp}
      className="group flex flex-col rounded-2xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/25 hover:shadow-sm"
    >
      <div className={`mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl border ${c.border} ${c.bg} ${c.icon} transition-transform duration-300 group-hover:scale-105`}>
        {icon}
      </div>
      <h3 className="mb-2 text-base font-semibold tracking-tight">{title}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </m.div>
  )
}

function DualModeCard({
  label, items, accent
}: Readonly<{
  label: string; items: string[]; accent: "blue" | "violet";
}>) {
  const accentCls = accent === "blue"
    ? { dot: "bg-blue-500", badge: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20" }
    : { dot: "bg-violet-500", badge: "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20" }

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/25 hover:shadow-sm">
      <span className={`mb-5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${accentCls.badge}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${accentCls.dot}`} />
        {label}
      </span>
      <ul className="space-y-3 mt-3">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${accentCls.dot}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function StatCell({ value, label, description }: Readonly<{ value: string; label: string; description: string }>) {
  return (
    <m.div
      variants={fadeUp}
      className="group flex flex-col rounded-2xl border border-border bg-card/50 p-8 backdrop-blur-sm transition-all duration-300 hover:border-primary/25 hover:shadow-sm"
    >
      {/* Primary accent line follows theme */}
      <div className="mb-6 h-px w-8 rounded-full bg-primary" />
      {/* Value in primary color */}
      <p className="text-4xl font-semibold tracking-tight text-primary lg:text-5xl">{value}</p>
      <div className="mt-4 flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </m.div>
  )
}
