import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy - Ryu Medha",
  description: "Learn how Ryu Medha collects, uses, and protects your personal information.",
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-3">
    <h2 className="text-lg font-bold text-foreground border-b border-border/60 pb-2">{title}</h2>
    <div className="flex flex-col gap-2 text-sm text-muted-foreground leading-relaxed">{children}</div>
  </div>
)

export default function PrivacyPolicyPage() {
  const lastUpdated = "July 14, 2025"

  return (
    <main className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/8 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
        {/* Header */}
        <div className="flex flex-col gap-2 mb-10">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-4 inline-flex items-center gap-1.5"
          >
            ← Back to Ryu Medha
          </Link>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: <span className="text-foreground font-medium">{lastUpdated}</span>
          </p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            At <strong className="text-foreground">Ryu Medha</strong> ("we", "our", or "us"), your privacy is
            important to us. This Privacy Policy explains how we collect, use, and protect your information when
            you use our academic tracking platform at{" "}
            <a href="https://ryumedha.in" className="text-primary hover:underline">
              ryumedha.in
            </a>
            .
          </p>
        </div>

        {/* Sections */}
        <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md p-6 sm:p-8 shadow-xl flex flex-col gap-8">

          <Section title="1. Information We Collect">
            <p>We collect the following types of information to provide and improve our services:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>
                <strong className="text-foreground">Google Account Information:</strong> When you sign in with
                Google, we receive your name, email address, and profile picture from Google's OAuth service.
              </li>
              <li>
                <strong className="text-foreground">Google API Access:</strong> With your explicit permission, we
                access Google Tasks and Google Calendar APIs to sync your tasks and schedule.
              </li>
              <li>
                <strong className="text-foreground">Academic Data:</strong> Subject names, attendance records,
                grades, timer sessions, and other academic data you enter into the app.
              </li>
              <li>
                <strong className="text-foreground">WhatsApp Number:</strong> If you choose to link your WhatsApp
                number, we store it to enable bot notifications and reminders.
              </li>
              <li>
                <strong className="text-foreground">Usage Data:</strong> Basic analytics such as pages visited and
                feature usage to help us improve the platform.
              </li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use the collected information solely for the following purposes:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>To authenticate your identity and provide access to your personal dashboard.</li>
              <li>To display and sync your academic data (subjects, grades, timers, tasks).</li>
              <li>To send WhatsApp reminders and alerts if you have enabled the feature.</li>
              <li>To sync tasks and events with your Google Tasks and Google Calendar.</li>
              <li>To improve our platform and fix bugs based on usage patterns.</li>
              <li>To respond to your support requests and inquiries.</li>
            </ul>
            <p>
              We <strong className="text-foreground">do not</strong> sell, rent, or share your personal information
              with third parties for advertising or marketing purposes.
            </p>
          </Section>

          <Section title="3. Google API Services">
            <p>
              Ryu Medha uses Google APIs to provide certain features. Our use of information received from Google
              APIs adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>We only request access to Google Tasks and Google Calendar when you use those features.</li>
              <li>Google tokens are stored securely and used only to perform actions you initiate.</li>
              <li>You can revoke Google access at any time from your Google Account settings.</li>
            </ul>
          </Section>

          <Section title="4. Data Storage and Security">
            <p>
              Your data is stored securely using{" "}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Supabase
              </a>
              , a trusted open-source backend platform that provides enterprise-grade security including
              row-level security (RLS) to ensure each user can only access their own data.
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>All data is transmitted over HTTPS (TLS encryption).</li>
              <li>Authentication tokens are stored in secure cookies with appropriate expiry.</li>
              <li>We apply row-level security policies so no user can access another user's data.</li>
            </ul>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We retain your data for as long as your account is active. If you delete your account or request
              data deletion, we will remove your personal information and academic records within 30 days, except
              where required by law.
            </p>
          </Section>

          <Section title="6. Your Rights">
            <p>You have the following rights over your data:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li><strong className="text-foreground">Access:</strong> Request a copy of the data we hold about you.</li>
              <li><strong className="text-foreground">Correction:</strong> Update inaccurate information via your profile settings.</li>
              <li><strong className="text-foreground">Deletion:</strong> Request deletion of your account and all associated data.</li>
              <li><strong className="text-foreground">Portability:</strong> Request your data in a portable format.</li>
              <li><strong className="text-foreground">Withdrawal:</strong> Revoke Google permissions from your Google Account at any time.</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:ryumedha@gmail.com" className="text-primary hover:underline">
                ryumedha@gmail.com
              </a>
              .
            </p>
          </Section>

          <Section title="7. Cookies">
            <p>
              We use essential cookies to maintain your login session. These cookies are necessary for the app to
              function and do not track you across other websites. We do not use advertising or tracking cookies.
            </p>
          </Section>

          <Section title="8. Third-Party Services">
            <p>We use the following third-party services, each governed by their own privacy policies:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Supabase
                </a>{" "}
                — Database and authentication
              </li>
              <li>
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Google
                </a>{" "}
                — OAuth sign-in, Tasks, and Calendar APIs
              </li>
              <li>
                <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Vercel
                </a>{" "}
                — Hosting and deployment
              </li>
            </ul>
          </Section>

          <Section title="9. Children's Privacy">
            <p>
              Ryu Medha is designed for college and university students. We do not knowingly collect personal
              information from children under the age of 13. If you believe a child has provided us with personal
              data, please contact us and we will promptly delete it.
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify users of significant changes by
              updating the "Last updated" date at the top of this page. Continued use of Ryu Medha after changes
              constitutes your acceptance of the updated policy.
            </p>
          </Section>

          <Section title="11. Contact Us">
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us:
            </p>
            <ul className="list-none flex flex-col gap-1">
              <li>
                📧{" "}
                <a href="mailto:ryumedha@gmail.com" className="text-primary hover:underline">
                  ryumedha@gmail.com
                </a>
              </li>
              <li>
                🌐{" "}
                <a href="https://ryumedha.in/support" className="text-primary hover:underline">
                  ryumedha.in/support
                </a>
              </li>
            </ul>
          </Section>
        </div>

        {/* Footer links */}
        <div className="mt-8 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link href="/terms-conditions" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
          <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        </div>
      </div>
    </main>
  )
}
