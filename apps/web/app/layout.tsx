import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono, Newsreader } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const viewport: Viewport = {
  themeColor: "#0c0e14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Sunday Funday | Personal Finance ERP",
    template: "%s | Sunday Funday ERP",
  },
  description:
    "Desktop and mobile personal finance ERP for payroll waterfall allocation, 12-month rolling liability tracking, daily safe-to-spend pacing, and audit reporting.",
  keywords: [
    "personal finance ERP",
    "cash flow waterfall",
    "debt matrix tracker",
    "payday cycle budgeting",
    "daily spend pacing",
  ],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Sunday Funday | Personal Finance ERP",
    description:
      "Payroll waterfall allocation, 12-month debt matrix, and real-time safe-to-spend cash flow control.",
    type: "website",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SundayERP",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${jetbrainsMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="h-full bg-canvas text-text-primary overflow-hidden">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
