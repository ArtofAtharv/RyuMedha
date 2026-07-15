import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms & Conditions — Ryu Medha",
  description: "Read the Terms and Conditions governing your use of the Ryu Medha academic tracking platform.",
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-3">
    <h2 className="text-lg font-bold text-foreground border-b border-border/60 pb-2">{title}</h2>
    <div className="flex flex-col gap-2 text-sm text-muted-foreground leading-relaxed">{children}</div>
  </div>
)

export default function TermsConditionsPage() {
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
            Terms & Conditions
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: <span className="text-foreground font-medium">{lastUpdated}</span>
          </p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Please read these Terms and Conditions carefully before using{" "}
            <strong className="text-foreground">Ryu Medha</strong> ("the Platform", "we", "us", or "our") at{" "}
            <a href="https://ryumedha.in" className="text-primary hover:underline">
              ryumedha.in
            </a>
            . By accessing or using our platform, you agree to be bound by these terms.
          </p>
        </div>

        {/* Sections */}
        <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md p-6 sm:p-8 shadow-xl flex flex-col gap-8">

          <Section title="1. Acceptance of Terms">
            <p>
              By creating an account, signing in, or using any part of Ryu Medha, you agree to these Terms and
              Conditions and our{" "}
              <Link href="/privacy-policy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              . If you do not agree to these terms, please do not use the platform.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              Ryu Medha is an academic management platform designed for college and university students. It
              provides tools for:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>Tracking class attendance and academic performance</li>
              <li>Managing tasks synced with Google Tasks</li>
              <li>Monitoring study sessions via focus timers</li>
              <li>Receiving WhatsApp-based reminders and notifications</li>
              <li>Viewing grade summaries and academic statistics</li>
            </ul>
          </Section>

          <Section title="3. Eligibility">
            <p>
              You must be at least 13 years of age to use Ryu Medha. By using the platform, you represent and
              warrant that you meet this minimum age requirement and that all information you provide is accurate
              and truthful.
            </p>
          </Section>

          <Section title="4. Account Registration">
            <p>
              To use Ryu Medha, you must sign in with a valid Google account. You are responsible for:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>Maintaining the confidentiality of your login credentials.</li>
              <li>All activity that occurs under your account.</li>
              <li>Notifying us immediately of any unauthorized use of your account.</li>
            </ul>
            <p>
              We reserve the right to terminate accounts that violate these Terms or that have been inactive for
              an extended period.
            </p>
          </Section>

          <Section title="5. Acceptable Use">
            <p>You agree to use Ryu Medha only for lawful, personal, and non-commercial academic purposes. You must not:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>Attempt to gain unauthorized access to other users' accounts or our systems.</li>
              <li>Use the platform to transmit harmful, abusive, or illegal content.</li>
              <li>Reverse-engineer, scrape, or copy any part of the platform without permission.</li>
              <li>Use the platform in a manner that could damage, disable, or impair our servers or networks.</li>
              <li>Share your account credentials with others.</li>
            </ul>
          </Section>

          <Section title="6. Google Services Integration">
            <p>
              Ryu Medha integrates with Google Tasks and Google Calendar. By enabling these features, you
              authorize us to access and manage your Google data on your behalf, strictly within the scope of
              permissions you grant. You may revoke these permissions at any time through your{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google Account settings
              </a>
              .
            </p>
          </Section>

          <Section title="7. WhatsApp Feature">
            <p>
              By linking your WhatsApp number, you consent to receive automated messages from our WhatsApp bot,
              including reminders, attendance alerts, and task notifications. You may unlink your WhatsApp number
              at any time from your profile settings to stop receiving messages.
            </p>
          </Section>

          <Section title="8. Intellectual Property">
            <p>
              All content, branding, design, code, and materials on Ryu Medha — including the name, logo, and
              interface — are owned by Ryu Medha and protected by applicable intellectual property laws. You may
              not reproduce, distribute, or create derivative works without our express written permission.
            </p>
            <p>
              Your academic data (subjects, grades, attendance records) remains your own. You grant us a limited
              license to store and process it solely to provide the services described herein.
            </p>
          </Section>

          <Section title="9. Disclaimer of Warranties">
            <p>
              Ryu Medha is provided on an <strong className="text-foreground">"as is" and "as available"</strong>{" "}
              basis. We make no warranties, expressed or implied, that:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>The platform will be uninterrupted, error-free, or secure at all times.</li>
              <li>Any data stored on the platform will be retained indefinitely.</li>
              <li>The platform will meet your specific academic requirements.</li>
            </ul>
            <p>
              We strongly recommend maintaining your own backup of important academic data.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>
              To the fullest extent permitted by law, Ryu Medha and its creators shall not be liable for any
              indirect, incidental, special, or consequential damages arising from your use of — or inability to
              use — the platform, including but not limited to loss of data, academic records, or missed
              deadlines.
            </p>
          </Section>

          <Section title="11. Service Availability">
            <p>
              We strive to keep Ryu Medha available at all times, but we do not guarantee uninterrupted access.
              We may perform maintenance, updates, or experience downtime. We are not liable for any losses
              caused by service interruptions.
            </p>
          </Section>

          <Section title="12. Account Termination">
            <p>
              You may delete your account at any time by contacting us at{" "}
              <a href="mailto:ryumedha@gmail.com" className="text-primary hover:underline">
                ryumedha@gmail.com
              </a>
              . We reserve the right to suspend or terminate accounts that violate these Terms, engage in
              fraudulent activity, or cause harm to other users or the platform.
            </p>
          </Section>

          <Section title="13. Changes to Terms">
            <p>
              We reserve the right to update these Terms and Conditions at any time. We will notify users of
              material changes by updating the "Last updated" date. Continued use of the platform after changes
              are posted constitutes your acceptance of the revised terms.
            </p>
          </Section>

          <Section title="14. Governing Law">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of India. Any disputes
              arising from these Terms shall be subject to the exclusive jurisdiction of the courts in Mumbai,
              Maharashtra, India.
            </p>
          </Section>

          <Section title="15. Contact Us">
            <p>
              If you have any questions about these Terms and Conditions, please reach out:
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
          <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        </div>
      </div>
    </main>
  )
}
