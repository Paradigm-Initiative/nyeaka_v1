import type { Metadata } from "next";
import { Montserrat, Raleway } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-heading",
});

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
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
        montserrat.variable,
        raleway.variable,
      )}
    >
      <body className="flex flex-col w-full min-h-full">
        <Header />
        <main className="flex flex-col flex-1">{children}</main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
