import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const satoshi = localFont({
  src: [
    {
      path: "../../public/fonts/Satoshi-Variable.woff2",
      style: "normal",
    },
    {
      path: "../../public/fonts/Satoshi-VariableItalic.woff2",
      style: "italic",
    },
  ],
  variable: "--font-satoshi",
  display: "swap",
  weight: "300 900",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://ozskr.vercel.app"
  ),
  title: {
    default: "ozskr.ai — Solana AI Agent Platform",
    template: "%s | ozskr.ai",
  },
  description:
    "Your AI agents. Your rules. On-chain. Create, manage, and deploy autonomous AI agents on Solana.",
  openGraph: {
    type: "website",
    siteName: "ozskr.ai",
    title: "ozskr.ai — Solana AI Agent Platform",
    description:
      "Your AI agents. Your rules. On-chain. Create, manage, and deploy autonomous AI agents on Solana.",
    images: [{ url: "/og/og-default.png", width: 1200, height: 630, alt: "ozskr.ai" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@ozskrai",
    title: "ozskr.ai — Solana AI Agent Platform",
    description:
      "Your AI agents. Your rules. On-chain. Create, manage, and deploy autonomous AI agents on Solana.",
    images: ["/og/og-default.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${satoshi.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
