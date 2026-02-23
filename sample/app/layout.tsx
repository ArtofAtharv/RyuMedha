import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navigation from "./components/navigation";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Providers } from "./components/Providers";
import { SyncProvider } from "./components/SyncProvider";
import { fetchDashboardData } from "./actions/academic";
import { auth } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Academics Tracker",
  description: "Track your academic progress with ease.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Academics Tracker",
    url: "https://academicstracker.vercel.app",
    siteName: "Academics Tracker",
    type: "website",
    locale: "en_US",
    description: "Track your academic progress with ease.",
    images: [
      {
        url: "https://academicstracker.vercel.app/icon.png",
        width: 630,
        height: 630,
        alt: "Academics Tracker",
        type: "image/png",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  // We can also fetch full data if needed, but session is enough for simple nav profile link
  // But navigation was checking 'userData' to decide link target. 
  // 'userData' implies full profile setup.
  const userData = await fetchDashboardData();

  return (
    // Add suppressHydrationWarning here
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>
            <SyncProvider />
            <Navigation user={userData} />
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
