import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import NumberInputScrollPrevention from "@/components/NumberInputScrollPrevention";
import { ToastProvider } from "@/components/ToastProvider";
import WelcomeScreen from "@/components/WelcomeScreen";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RetailNext",
  description: "RetailNext Retail Management Software",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ToastProvider>
          <NumberInputScrollPrevention />
          <WelcomeScreen />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
