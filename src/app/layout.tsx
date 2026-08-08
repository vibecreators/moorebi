import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOORE OS",
  description: "The operating-intelligence layer for founder-led businesses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink font-sans">{children}</body>
    </html>
  );
}
