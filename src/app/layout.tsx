import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { getThemeInitScript, type Theme } from "@/lib/theme";
import { PWA_THEME_COLORS } from "@/lib/pwa";
import { SerwistProvider } from "@serwist/turbopack/react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Receipt Splitter",
  description: "Upload a receipt, add people, and easily split items. No downloads or account creation required.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Receipt Splitter",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

// Shared by the pre-hydration script and the provider so first paint matches.
// The script only toggles a light/dark class and always honors the system
// setting, so update getThemeInitScript if the provider's attribute or
// enableSystem props change.
const DEFAULT_THEME: Theme = "system";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: PWA_THEME_COLORS,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript(DEFAULT_THEME) }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* The service worker is only registered in production builds. Don't
            reload when the connection returns: it would discard unsaved edits. */}
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV === "development"}
          reloadOnOnline={false}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme={DEFAULT_THEME}
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </SerwistProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
