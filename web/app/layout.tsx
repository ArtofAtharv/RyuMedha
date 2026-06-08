import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ryu Medha — Your Academic Edge",
  description: "Track attendance, grades, tasks, and focus sessions in one quiet workspace. With WhatsApp as the fastest way in.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ryu Medha",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Ryu Medha — Your Academic Edge",
    url: "https://ryumedha.in",
    siteName: "Ryu Medha",
    type: "website",
    locale: "en_US",
    description: "Track attendance, grades, tasks, and focus sessions in one quiet workspace. With WhatsApp as the fastest way in.",
    images: [
      {
        url: "https://ryumedha.vercel.app/icon.png",
        width: 630,
        height: 630,
        alt: "Ryu Medha — Your Academic Edge",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: next-themes + our data-theme script both mutate
    // the html element before React hydrates — this suppresses the mismatch warning
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased pb-[80px] md:pb-0`}
        suppressHydrationWarning
      >
        {/* Restore color theme from localStorage before first paint — no flash */}
        <Script id="color-theme-init" strategy="beforeInteractive">{`
          try {
            var t = localStorage.getItem('ryumedha-color-theme');
            if (t && t !== 'neutral') {
              document.documentElement.setAttribute('data-theme', t);
            }
          } catch(e) {}
        `}</Script>
        <Providers>
          <Navigation />
          {children}
          <Footer />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
