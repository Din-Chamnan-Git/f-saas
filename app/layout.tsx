import type { Metadata } from "next";
import { ClientLayoutWrapper } from "@/components/layouts/client-layout-wrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Techey | Infinite Precision Khmer Solution",
  description: "Monitoring, alerting, logs, and fleet operations for the Techey Solution platform.",
  icons: {
    icon: "/techey-mark.svg",
    apple: "/techey-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
      </body>
    </html>
  );
}
