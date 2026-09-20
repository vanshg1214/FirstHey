import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import PageTransition from "@/components/PageTransition";
import Sidebar from "@/components/Sidebar";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { ToastProvider } from "@/components/Toast";
import RealtimeNotifications from "@/components/RealtimeNotifications";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FirstHey | Live Workspace",
  description: "Enterprise exhibition lead capture and intelligence platform.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#faf8f5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-slate-900" suppressHydrationWarning>
        <div className="mesh-bg" />
        <ServiceWorkerRegister />
        <PWAInstallPrompt />
        <ToastProvider>
          <RealtimeNotifications />
          <Sidebar />
          {/* Offset for the sidebar on desktop, safe padding on mobile for bottom tab bar */}
          <div className="md:pl-24 pb-[60px] md:pb-0 min-h-full flex flex-col flex-1">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
