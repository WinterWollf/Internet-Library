// [v0 import] Component: RootLayout
// Location: frontend/app/layout.tsx
// Connect to: N/A — shell layout, no direct API
// Mock data: none
// Auth: public
// TODO: add Toaster for toast notifications when implementing actions
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Internet Library — Discover Your Next Great Read",
  description: "Borrow books online, track your loans, and never miss a return date.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
