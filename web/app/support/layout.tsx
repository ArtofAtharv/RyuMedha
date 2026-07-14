import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support & Help — Ryu Medha",
  description: "Get assistance, report issues, or contact the Ryu Medha team directly. We are here to help you succeed with your academic workflow.",
  openGraph: {
    title: "Support & Help — Ryu Medha",
    description: "Get assistance, report issues, or contact the Ryu Medha team directly.",
    url: "https://ryumedha.in/support",
    siteName: "Ryu Medha",
    type: "website",
  },
};

export default function SupportLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
