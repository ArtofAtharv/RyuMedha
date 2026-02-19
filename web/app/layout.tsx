import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
