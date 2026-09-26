import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { LanguageProvider } from "@/lib/i18n";
import "./globals.css";
import { PAY_URL } from "@/lib/seo";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(PAY_URL),
  title: {
    default: "Nexvar Pay — Canadian Payroll Software",
    template: "%s | Nexvar Pay",
  },
  description:
    "CRA-aligned payroll software for Canadian small businesses and accountants. Calculate deductions, run payroll, and produce clear payroll records for every province and territory.",
  applicationName: "Nexvar Pay",
  authors: [{ name: "Nexvar Lab Inc.", url: "https://www.nexvarlab.online" }],
  creator: "Nexvar Lab Inc.",
  publisher: "Nexvar Lab Inc.",
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
    "Nexvar Pay",
    "Nexvar Lab",
  ],
  openGraph: {
    title: "Nexvar Pay — Canadian Payroll Software",
    description:
      "CRA-aligned Canadian payroll calculations, pay stubs, payroll reports, and accountant workflows in one place.",
    type: "website",
    locale: "en_CA",
    siteName: "Nexvar Pay",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexvar Pay — Canadian Payroll Software",
    description: "Canadian payroll calculations, pay stubs, payroll reports, and accountant workflows in one place.",
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
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <LanguageProvider>
          <Providers>{children}</Providers>
        </LanguageProvider>
      </body>
    </html>
  );
}
