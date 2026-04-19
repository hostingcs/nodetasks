import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Analytics } from "./components/analytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE = "https://nodetasks.com";
const TITLE = "NodeTasks — Node.js process monitor for Windows";
const DESCRIPTION =
  "A tiny, native Windows app that shows every running Node.js process, live CPU and memory, and lets you kill them all with one click. Free, open source, under 3 MB.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: TITLE,
    template: "%s · NodeTasks",
  },
  description: DESCRIPTION,
  applicationName: "NodeTasks",
  keywords: [
    "node.js",
    "nodejs",
    "process monitor",
    "windows",
    "task manager",
    "cpu monitor",
    "memory monitor",
    "kill node",
    "node.exe",
    "developer tools",
    "dev tools",
  ],
  authors: [{ name: "hostingcs" }],
  creator: "hostingcs",
  publisher: "hostingcs",
  alternates: {
    canonical: SITE,
  },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "NodeTasks",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#0f0f11",
  colorScheme: "dark",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "NodeTasks",
  operatingSystem: "Windows 10, Windows 11",
  applicationCategory: "DeveloperApplication",
  description: DESCRIPTION,
  url: SITE,
  downloadUrl: "https://github.com/hostingcs/nodetasks/releases/latest",
  softwareVersion: "1.0.0",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  publisher: {
    "@type": "Organization",
    name: "hostingcs",
    url: "https://github.com/hostingcs",
  },
  image: `${SITE}/opengraph-image`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0f0f11] text-[#e8e8ea]">
        <Script
          id="ld-software-application"
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Analytics />
        {children}
      </body>
    </html>
  );
}
