import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MapleRun — Canadian Payroll, Done in Minutes",
  description:
    "Accurate CRA-compliant payroll for Canadian small businesses. Calculate deductions, run payroll, and produce pay stubs in minutes. Supports all provinces and territories. 2026 T4127 tax tables.",
  keywords: [
    "Canadian payroll",
    "payroll software",
    "small business payroll",
    "CRA payroll deductions",
    "T4127",
    "pay stub",
    "T4",
    "remittance",
    "PD7A",
    "MapleRun",
  ],
  openGraph: {
    title: "MapleRun — Canadian Payroll, Done in Minutes",
    description:
      "Accurate CRA-compliant payroll for Canadian small businesses. Calculate deductions, run payroll, produce pay stubs in minutes.",
    type: "website",
    locale: "en_CA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-CA"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
