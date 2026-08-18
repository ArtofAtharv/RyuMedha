"use client"

import Link from "next/link"
import {
  ArrowRight,
  Zap,
  BarChart2,
  ShieldCheck,
  BookOpen,
  Clock,
  CheckSquare,
  GraduationCap,
  MessageCircle,
  BarChart,
  Timer,
} from "lucide-react"
import { m, Variants } from "motion/react"
import type { ReactNode } from "react"
import { useSupabaseSession } from "@/lib/supabase-auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

/* ── animation presets ── */
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
}
const itemVariants: Variants = {
  hidden: { y: 15, opacity: 0, filter: "blur(4px)" },
  visible: {
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
}
const fadeUp: Variants = {
  hidden: { y: 24, opacity: 0, filter: "blur(4px)" },
  visible: {
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

export default function LandingPage() {
  const { session, loading } = useSupabaseSession()
  const router = useRouter()

  useEffect(() => {
    if (session) router.push("/dashboard")
  }, [session, router])

  if (loading || session) return null

  return (
    <div className="bg-background text-foreground">
      {/* ══════════════════════════════════════════
          HERO — full viewport below navbar
          ══════════════════════════════════════════ */}
      <section className="flex items-center" style={{ minHeight: "calc(100dvh - 56px)" }}>
        <m.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid w-full items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_480px] lg:px-14 xl:grid-cols-[1fr_520px] xl:px-20"
        >
          {/* Left */}
          <div className="max-w-2xl">
            <m.h1
              variants={itemVariants}
              className="font-serif text-5xl leading-[1.06] font-bold tracking-[-0.03em] text-balance md:text-6xl lg:text-7xl xl:text-8xl"
            >
              Own your
              <br />
              semester,
              <br />
              <span className="text-primary">every single day.</span>
            </m.h1>

            <m.p
              variants={itemVariants}
              className="text-muted-foreground mt-6 max-w-xl text-base leading-7 md:text-lg md:leading-8"
            >
              Ryu Medha keeps attendance, grades, tasks, and study sessions in one calm workspace. The fastest way in is
              a WhatsApp message you already know how to send.
            </m.p>

            <m.div variants={itemVariants} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="bg-primary text-primary-foreground inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold transition-opacity hover:opacity-90 active:opacity-75"
              >
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="border-border hover:bg-muted inline-flex h-12 items-center justify-center rounded-full border px-7 text-sm font-semibold transition-colors"
              >
                See how it works
              </a>
            </m.div>
          </div>

          {/* Right -- preview card */}
          <m.div
            variants={itemVariants}
            className="border-border bg-card/60 w-full overflow-hidden rounded-3xl border shadow-sm backdrop-blur-md"
          >
            <div className="border-border flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="text-sm font-semibold">Today</p>
                <p className="text-muted-foreground mt-0.5 text-xs">{todayLabel()}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-600 dark:text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> On track
              </span>
            </div>

            <div className="divide-border divide-y">
              <PreviewMetric
                icon={<BookOpen className="h-4 w-4" />}
                label="Attendance"
                value="84%"
                detail="2 lectures left to mark today"
                color="text-blue-500"
                bg="bg-blue-500/10"
              />
              <PreviewMetric
                icon={<GraduationCap className="h-4 w-4" />}
                label="Grade average"
                value="8.6"
                detail="3 scores updated this week"
                color="text-violet-500"
                bg="bg-violet-500/10"
              />
              <PreviewMetric
                icon={<Clock className="h-4 w-4" />}
                label="Focus time"
                value="2h 15m"
                detail="Across 4 sessions today"
                color="text-orange-500"
                bg="bg-orange-500/10"
              />
              <PreviewMetric
                icon={<CheckSquare className="h-4 w-4" />}
                label="Tasks due"
                value="3"
                detail="1 assignment, 2 personal goals"
                color="text-rose-500"
                bg="bg-rose-500/10"
              />
            </div>

            <div className="border-border bg-muted/50 m-4 rounded-2xl border p-4">
              <div className="mb-2 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-500" />
                <p className="text-sm font-semibold">WhatsApp shortcut</p>
              </div>
              <p className="text-muted-foreground text-sm leading-6">
                Send{" "}
                <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs">
                  mark today present
                </code>{" "}
                and your dashboard updates in seconds. No app switching needed.
              </p>
            </div>
          </m.div>
        </m.div>
      </section>

      {/* ══════════════════════════════════════════
          GOOGLE INTEGRATION & PURPOSE
          ══════════════════════════════════════════ */}
      <section className="border-border bg-card/25 border-t px-5 py-16 sm:px-8 lg:px-14 xl:px-20">
        <div className="mx-auto flex max-w-4xl flex-col items-start gap-8 md:flex-row">
          <div className="flex-1 space-y-4">
            <h2 className="text-foreground flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <span className="text-primary font-serif font-bold">Ryu Medha</span> - Google Integration & Purpose
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              <strong>Ryu Medha</strong> is a comprehensive academic organizer designed to help students track and
              manage their college semester. Our core mission is to streamline academic schedules, deadlines,
              attendance, and study habits in a centralized, quiet workspace.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              To achieve this, Ryu Medha securely integrates with your Google Account to access:
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="border-border bg-muted/40 rounded-xl border p-4">
                <h3 className="mb-1 text-sm font-semibold">Google Tasks API</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Used to sync your homework, assignments, and exam deadlines directly between your dashboard and Google
                  Tasks. This enables us to schedule offline popup reminders and system notifications when your tasks
                  are due.
                </p>
              </div>
              <div className="border-border bg-muted/40 rounded-xl border p-4">
                <h3 className="mb-1 text-sm font-semibold">Google Calendar API</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Used to display your lecture schedules, exams, and classes on your main calendar layout, helping you
                  balance your focus time and avoid schedule conflicts.
                </p>
              </div>
            </div>
            <p className="text-muted-foreground/80 mt-4 text-xs leading-normal">
              We respect your privacy: your Google data is accessed solely to synchronize your personal tasks and
              schedules, and is never shared, sold, or used for advertising. You can unlink your account at any time in
              your profile settings.
            </p>
          </div>
        </div>
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
        className="border-border flex min-h-dvh flex-col justify-center border-y px-5 py-20 sm:px-8 lg:px-14 xl:px-20"
      >
        <m.p variants={fadeUp} className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
          Why Ryu Medha
        </m.p>
        <m.h2
          variants={fadeUp}
          className="mb-12 max-w-2xl font-serif text-3xl font-bold tracking-tight text-balance md:text-5xl"
        >
          Three principles. One tool that respects your time.
        </m.h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
      <section className="border-border flex min-h-dvh items-center border-b px-5 sm:px-8 lg:px-14 xl:px-20">
        <m.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="max-w-3xl py-16"
        >
          <m.p variants={fadeUp} className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
            What it is
          </m.p>
          <m.h2
            variants={fadeUp}
            className="font-serif text-3xl font-bold tracking-tight text-balance md:text-5xl lg:text-6xl"
          >
            One place for your entire academic life.
          </m.h2>
          <m.p variants={fadeUp} className="text-muted-foreground mt-6 text-base leading-7 md:text-lg">
            Most students juggle five different apps: one for attendance, another for tasks, a spreadsheet for grades, a
            timer app, and a notes folder. Ryu Medha collapses all of that into a single, quietly intelligent workspace
            that stays out of your way.
          </m.p>
          <m.p variants={fadeUp} className="text-muted-foreground mt-4 text-base leading-7 md:text-lg">
            And because the best interface is one you already have open, the WhatsApp bot lets you log attendance, check
            your stats, and manage tasks without ever opening a browser.
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
              <span
                key={item.text}
                className="border-border bg-muted/50 text-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
              >
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
      <section className="border-border flex min-h-dvh items-center border-b px-5 sm:px-8 lg:px-14 xl:px-20">
        <m.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="w-full py-16"
        >
          <m.p variants={fadeUp} className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
            Every feature, intentional
          </m.p>
          <m.h2
            variants={fadeUp}
            className="mb-10 font-serif text-3xl font-bold tracking-tight text-balance md:text-5xl"
          >
            Built around how you actually study.
          </m.h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DeepFeatureCard
              icon={<BookOpen className="h-5 w-5" />}
              color="blue"
              title="Attendance Tracker"
              description="Mark present, absent, or deemed for each subject. Get warned the moment your percentage drops below your target. Never get surprised by a shortage."
            />
            <DeepFeatureCard
              icon={<GraduationCap className="h-5 w-5" />}
              color="violet"
              title="Grade Book"
              description="Log marks for every test, quiz, and exam. See your cumulative average update in real time. Know exactly where you stand before results day."
            />
            <DeepFeatureCard
              icon={<CheckSquare className="h-5 w-5" />}
              color="orange"
              title="Task Manager"
              description="Separate academic deadlines from personal goals. Due-today alerts, subject-linked tasks, and a clean list that doesn't overwhelm you."
            />
            <DeepFeatureCard
              icon={<Timer className="h-5 w-5" />}
              color="rose"
              title="Focus Timers"
              description="Stopwatch and Pomodoro modes built in. Every session is logged so you can see how many hours you've actually invested in each subject."
            />
            <DeepFeatureCard
              icon={<BarChart2 className="h-5 w-5" />}
              color="green"
              title="Study Analytics"
              description="Visual charts of your focus sessions over time. Spot your most productive days, your slowest weeks, and plan accordingly."
            />
            <DeepFeatureCard
              icon={<MessageCircle className="h-5 w-5" />}
              color="emerald"
              title="WhatsApp Bot"
              description="The fastest interface is a message you already know how to type. Mark attendance, check stats, and manage tasks in under 10 seconds."
            />
          </div>
        </m.div>
      </section>

      {/* ══════════════════════════════════════════
          DUAL MODE — full screen
          ══════════════════════════════════════════ */}
      <section className="border-border flex min-h-dvh items-center border-b px-5 sm:px-8 lg:px-14 xl:px-20">
        <m.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid w-full gap-12 py-16 lg:grid-cols-2 lg:items-center"
        >
          <div>
            <m.p
              variants={fadeUp}
              className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase"
            >
              Two modes, one dashboard
            </m.p>
            <m.h2 variants={fadeUp} className="font-serif text-3xl font-bold tracking-tight text-balance md:text-5xl">
              College subjects and personal goals, side by side.
            </m.h2>
            <m.p variants={fadeUp} className="text-muted-foreground mt-5 text-base leading-7">
              Your life is not just lectures and exams. Ryu Medha has an Academic mode for your college subjects and a
              Personal mode for everything else: learning guitar, building a startup, preparing for competitive exams.
            </m.p>
            <m.p variants={fadeUp} className="text-muted-foreground mt-4 text-base leading-7">
              Both modes share the same task manager, timer, and analytics, so you get a complete picture of how you
              spend your time, not just your exam-ready hours.
            </m.p>
          </div>

          <m.div variants={fadeUp} className="grid gap-3 sm:grid-cols-2">
            <DualModeCard
              label="Academic"
              items={[
                "Attendance per subject",
                "Deemed and shortage warnings",
                "Semester-scoped grades",
                "Assignment deadlines",
              ]}
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
      <section className="border-border flex min-h-dvh items-center border-b px-5 sm:px-8 lg:px-14 xl:px-20">
        <m.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="w-full py-16"
        >
          <m.p variants={fadeUp} className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
            By the numbers
          </m.p>
          <m.h2
            variants={fadeUp}
            className="max-w-2xl font-serif text-3xl font-bold tracking-tight text-balance md:text-5xl"
          >
            Built to be fast, free, and frictionless.
          </m.h2>
          <m.p variants={fadeUp} className="text-muted-foreground mt-4 mb-12 max-w-xl text-base leading-7">
            No setup fees, no paywalls, no complexity. Ryu Medha is designed to get out of your way and let you focus on
            what matters.
          </m.p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCell
              value="30 Days"
              label="Free Trial"
              description="Every new student receives 1 full month of unlimited workspace access."
            />
            <StatCell
              value="WhatsApp"
              label="Primary interface"
              description="No app to install, no new habit to build. The fastest interface is already open on your phone."
            />
            <StatCell
              value="5 sec"
              label="To log attendance"
              description="Send one message. Your attendance is marked, your dashboard updates, and you are back to your lecture."
            />
            <StatCell
              value="60 Days"
              label="Data Retention"
              description="Your data is safely preserved for 60 days even if your subscription temporarily expires."
            />
          </div>
        </m.div>
      </section>

      {/* ══════════════════════════════════════════
          PRICING & FREE TRIAL
          ══════════════════════════════════════════ */}
      <section
        id="pricing"
        className="border-border flex min-h-dvh items-center border-b px-5 py-20 sm:px-8 lg:px-14 xl:px-20"
      >
        <m.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto w-full max-w-5xl"
        >
          <m.p variants={fadeUp} className="text-primary mb-3 text-xs font-semibold tracking-widest uppercase">
            Simple & Transparent Pricing
          </m.p>
          <m.h2
            variants={fadeUp}
            className="max-w-2xl font-serif text-3xl font-bold tracking-tight text-balance md:text-6xl"
          >
            Start with a 1-Month Free Trial.
          </m.h2>
          <m.p variants={fadeUp} className="text-muted-foreground mt-4 mb-12 max-w-xl text-base leading-relaxed">
            Every new student gets 30 days of full access completely free. Set up auto-pay anytime to ensure your data
            stays protected.
          </m.p>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Monthly Card */}
            <m.div
              variants={fadeUp}
              className="border-border bg-card/60 hover:border-primary/40 flex flex-col justify-between rounded-3xl border p-8 shadow-sm backdrop-blur-md transition-all"
            >
              <div>
                <div className="bg-primary/10 text-primary mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold">
                  1ST MONTH FREE
                </div>
                <h3 className="text-xl font-bold tracking-tight">Monthly Auto-Pay</h3>
                <p className="text-muted-foreground mt-1 text-xs">Perfect for semester-by-semester tracking</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-extrabold tracking-tight">₹39</span>
                  <span className="text-muted-foreground text-sm font-medium">/ month</span>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  Billed automatically monthly via Razorpay after 30-day trial.
                </p>

                <ul className="text-muted-foreground border-border/60 mt-8 space-y-3 border-t pt-6 text-sm">
                  <li className="flex items-center gap-3">
                    <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                    Full Web Dashboard & WhatsApp Bot Access
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                    Attendance, Grades, Tasks & Focus Timers
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                    2-Month Data Retention Policy Protection
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                    Cancel Anytime
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <Link
                  href="/login"
                  className="bg-primary text-primary-foreground inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
                >
                  Start 1-Month Free Trial <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </m.div>

            {/* Yearly Card */}
            <m.div
              variants={fadeUp}
              className="border-primary bg-card relative flex flex-col justify-between rounded-3xl border-2 p-8 shadow-md"
            >
              <span className="bg-primary text-primary-foreground absolute -top-3.5 right-6 rounded-full px-3 py-1 text-xs font-bold shadow-sm">
                BEST VALUE • SAVE 15%
              </span>

              <div>
                <div className="bg-primary/10 text-primary mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold">
                  1ST MONTH FREE
                </div>
                <h3 className="text-xl font-bold tracking-tight">Yearly Auto-Pay</h3>
                <p className="text-muted-foreground mt-1 text-xs">Best value for complete annual coverage</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-extrabold tracking-tight">₹399</span>
                  <span className="text-muted-foreground text-sm font-medium">/ year</span>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  Billed annually via Razorpay after 30-day trial (equivalent to ~₹33/mo).
                </p>

                <ul className="text-muted-foreground border-border/60 mt-8 space-y-3 border-t pt-6 text-sm">
                  <li className="flex items-center gap-3">
                    <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                    Everything in Monthly Plan
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                    15% Savings compared to monthly plan
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                    Priority Support & Continuous Backups
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                    Cancel Anytime
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <Link
                  href="/login"
                  className="bg-primary text-primary-foreground inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
                >
                  Start 1-Month Free Trial <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </m.div>
          </div>

          <m.div
            variants={fadeUp}
            className="border-border bg-muted/40 mt-12 space-y-2 rounded-2xl border p-6 text-center"
          >
            <p className="flex items-center justify-center gap-2 text-sm font-bold">
              <ShieldCheck className="text-primary h-5 w-5" /> 60-Day Data Retention Guarantee
            </p>
            <p className="text-muted-foreground mx-auto max-w-2xl text-xs leading-relaxed">
              If your subscription expires or trial ends without auto-pay, we retain your data safely for 60 days. After
              60 days, un-subscribed accounts are permanently deleted from our database.
            </p>
          </m.div>
        </m.div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS
          ══════════════════════════════════════════ */}
      <section className="border-border flex min-h-dvh items-center border-b px-5 sm:px-8 lg:px-14 xl:px-20">
        <m.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="w-full py-16"
        >
          <m.p variants={fadeUp} className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
            Getting started
          </m.p>
          <m.h2
            variants={fadeUp}
            className="max-w-2xl font-serif text-3xl font-bold tracking-tight text-balance md:text-5xl"
          >
            Up and running in under two minutes.
          </m.h2>
          <m.p variants={fadeUp} className="text-muted-foreground mt-4 mb-12 max-w-xl text-base leading-7">
            No signup form, no onboarding slides, no waiting. Just open WhatsApp and you are already in.
          </m.p>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Sign up via WhatsApp",
                body: "Open the Ryu Medha bot and send your first message. No email, no password, no forms. Your account is created the moment you say hello.",
                detail: "Takes about 30 seconds",
              },
              {
                step: "02",
                title: "Add your subjects",
                body: "Tell the bot which subjects you are studying this semester, or add them from the dashboard. Set your attendance target and you are ready.",
                detail: "One time, takes under a minute",
              },
              {
                step: "03",
                title: "Start your semester",
                body: "Mark attendance, log grades, set task deadlines, start a focus timer. Everything you do is reflected across WhatsApp and your dashboard instantly.",
                detail: "Your data, always in sync",
              },
            ].map((s) => (
              <m.div
                key={s.step}
                variants={fadeUp}
                className="group border-border bg-card/50 hover:border-primary/25 flex flex-col rounded-2xl border p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-sm"
              >
                <span className="text-primary/20 mb-5 text-4xl leading-none font-bold tracking-tight">{s.step}</span>
                <h3 className="text-base font-semibold tracking-tight">{s.title}</h3>
                <p className="text-muted-foreground mt-2 flex-1 text-sm leading-6">{s.body}</p>
                <div className="border-border mt-5 inline-flex items-center gap-2 border-t pt-4">
                  <span className="bg-primary h-1.5 w-1.5 shrink-0 rounded-full" />
                  <span className="text-muted-foreground text-xs">{s.detail}</span>
                </div>
              </m.div>
            ))}
          </div>
        </m.div>
      </section>

      {/* ══════════════════════════════════════════
          CTA — full screen
          ══════════════════════════════════════════ */}
      <section className="flex min-h-dvh items-center px-5 sm:px-8 lg:px-14 xl:px-20">
        <m.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="flex w-full flex-col items-center gap-6 py-16 text-center"
        >
          <m.h2
            variants={fadeUp}
            className="max-w-2xl font-serif text-3xl font-bold tracking-tight text-balance md:text-6xl"
          >
            Your semester is already happening. Start tracking it.
          </m.h2>
          <m.p variants={fadeUp} className="text-muted-foreground max-w-lg text-base">
            Free, fast, and built for the way you already live. Sign up in under 60 seconds with just your WhatsApp
            number.
          </m.p>
          <m.div variants={fadeUp} className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="bg-primary text-primary-foreground inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-sm font-semibold transition-opacity hover:opacity-90 active:opacity-75"
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://wa.me/message/P4QSZGK7MV2PL1"
              target="_blank"
              rel="noopener noreferrer"
              className="border-border hover:bg-muted inline-flex h-12 items-center justify-center gap-2 rounded-full border px-8 text-sm font-semibold transition-colors"
            >
              <MessageCircle className="h-4 w-4 text-green-500" />
              Open WhatsApp bot
            </a>
          </m.div>
        </m.div>
      </section>
    </div>
  )
}

/* ─── Sub-components ────────────────────────────────────── */

function PreviewMetric({
  icon,
  label,
  value,
  detail,
  color,
  bg,
}: Readonly<{
  icon: ReactNode
  label: string
  value: string
  detail: string
  color: string
  bg: string
}>) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p className="text-muted-foreground/70 mt-0.5 text-[11px]">{detail}</p>
      </div>
      <p className="shrink-0 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  bullets,
}: Readonly<{
  icon: ReactNode
  title: string
  description: string
  bullets: string[]
}>) {
  return (
    <m.div
      variants={itemVariants}
      className="group border-border bg-card/50 hover:border-primary/25 flex flex-col rounded-2xl border p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-sm"
    >
      <div className="border-primary/20 bg-primary/10 text-primary mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-105">
        {icon}
      </div>

      <div className="flex flex-1 flex-col">
        <h3 className="text-foreground text-base font-semibold tracking-tight">{title}</h3>
        <p className="text-muted-foreground mt-2 text-sm leading-6">{description}</p>
      </div>

      <ul className="border-border mt-6 space-y-3 border-t pt-5">
        {bullets.map((b) => (
          <li key={b} className="flex items-center gap-3">
            <span className="bg-primary h-1.5 w-1.5 shrink-0 rounded-full" />
            <span className="text-muted-foreground text-sm">{b}</span>
          </li>
        ))}
      </ul>
    </m.div>
  )
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
  icon,
  color,
  title,
  description,
}: Readonly<{
  icon: ReactNode
  color: string
  title: string
  description: string
}>) {
  const c = colorMap[color] ?? colorMap.blue
  return (
    <m.div
      variants={fadeUp}
      className="group border-border bg-card/50 hover:border-primary/25 flex flex-col rounded-2xl border p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-sm"
    >
      <div
        className={`mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl border ${c.border} ${c.bg} ${c.icon} transition-transform duration-300 group-hover:scale-105`}
      >
        {icon}
      </div>
      <h3 className="mb-2 text-base font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground text-sm leading-6">{description}</p>
    </m.div>
  )
}

function DualModeCard({
  label,
  items,
  accent,
}: Readonly<{
  label: string
  items: string[]
  accent: "blue" | "violet"
}>) {
  const accentCls =
    accent === "blue"
      ? { dot: "bg-blue-500", badge: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20" }
      : { dot: "bg-violet-500", badge: "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20" }

  return (
    <div className="border-border bg-card/50 hover:border-primary/25 rounded-2xl border p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-sm">
      <span
        className={`mb-5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${accentCls.badge}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${accentCls.dot}`} />
        {label}
      </span>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item} className="text-muted-foreground flex items-center gap-3 text-sm">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accentCls.dot}`} />
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
      className="group border-border bg-card/50 hover:border-primary/25 flex flex-col rounded-2xl border p-8 backdrop-blur-sm transition-all duration-300 hover:shadow-sm"
    >
      {/* Primary accent line follows theme */}
      <div className="bg-primary mb-6 h-px w-8 rounded-full" />
      {/* Value in primary color */}
      <p className="text-primary font-serif text-4xl font-bold tracking-tight lg:text-6xl">{value}</p>
      <div className="mt-4 flex flex-col gap-1">
        <p className="text-foreground text-sm font-semibold">{label}</p>
        <p className="text-muted-foreground text-sm leading-6">{description}</p>
      </div>
    </m.div>
  )
}
