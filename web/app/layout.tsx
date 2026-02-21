import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ryu Medha - Academics Tracker",
  description: "Track your academic progress with ease.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Ryu Medha - Academics Tracker",
    url: "https://ryumedha.in",
    siteName: "Ryu Medha - Academics Tracker",
    type: "website",
    locale: "en_US",
    description: "Track your academic progress with ease.",
    images: [
      {
        url: "https://ryumedha.vercel.app/icon.png",
        width: 630,
        height: 630,
        alt: "Ryu Medha - Academics Tracker",
        type: "image/png",
      },
    ],
  },
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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
        </Providers>
      </body>
    </html>
  );
}
