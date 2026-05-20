import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nyeaka - Device Sharing Platform",
  description:
    "Nyeaka is a device sharing platform that allows users to share their devices with others. It provides a secure and convenient way to share devices, making it easier for people to access the technology they need. Set up by Paradigm Initiatives, Nyeaka aims to foster a collaborative and resource-efficient environment where users can easily share and access devices, promoting sustainability and reducing electronic waste.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
      )}
    >
      <body className="flex flex-col w-full min-h-full">{children}</body>
    </html>
  );
}
