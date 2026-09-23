import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import NumberInputScrollPrevention from "@/components/NumberInputScrollPrevention";
import { ToastProvider } from "@/components/ToastProvider";
import WelcomeScreen from "@/components/WelcomeScreen";
import PwaUpdater from "@/components/PwaUpdater";
import { PrinterProvider } from "@/context/PrinterContext";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RetailNext",
  description: "RetailNext Retail Management Software",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/fav.jpeg" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/fav.jpeg",
    apple: [
      { url: "/fav.jpeg" },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RetailNext",
  },
};

export const viewport: Viewport = {
  themeColor: "#5e2b9d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sora.variable} h-full antialiased`}>
      <head>
        <link rel="icon" href="/fav.jpeg" />
        <link rel="apple-touch-icon" href="/fav.jpeg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="RetailNext" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ToastProvider>
          <PrinterProvider>
            <NumberInputScrollPrevention />
            <PwaUpdater />
            <WelcomeScreen />
            {children}
          </PrinterProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
