import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "CodeCookbook – Algorithm Visualizer",
  description: "Interactive visualizations for sorting algorithms and data structures",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full flex" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>
        <Navigation />
        <main className="flex-1 min-h-dvh overflow-y-auto"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
