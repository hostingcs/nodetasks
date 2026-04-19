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
  metadataBase: new URL("https://nodetasks.com"),
  title: "NodeTasks — Node.js process monitor for Windows",
  description:
    "A tiny, native Windows app that shows every running Node.js process, live CPU and memory, and lets you kill them all with one click.",
  openGraph: {
    title: "NodeTasks",
    description:
      "A tiny, native Windows app for monitoring Node.js processes.",
    url: "https://nodetasks.com",
    siteName: "NodeTasks",
    type: "website",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0f0f11] text-[#e8e8ea]">
        {children}
      </body>
    </html>
  );
}
