import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "CodeCookbook – Algorithm Visualizer",
  description: "Interactive visualizations for sorting algorithms and data structures",
  manifest: "/manifest.json",
  themeColor: "#7c6af7",
  appleWebApp: {
    capable: true,
    title: "CodeCookbook",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full flex flex-col lg:flex-row" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>
        <ServiceWorkerRegistration />
        <Navigation />
        <main className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
