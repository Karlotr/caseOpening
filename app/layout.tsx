import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import { WinOverlayProvider } from "@/components/WinOverlay";
import { Navbar } from "@/components/Navbar";
import { ChatProvider } from "@/components/Chat";
import { BackgroundFX } from "@/components/BackgroundFX";
import { BackButton } from "@/components/BackButton";
import { Analytics } from "@vercel/analytics/next";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "latin-ext"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin", "latin-ext"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#090a14",
};

export const metadata: Metadata = {
  title: "GARAŽA.gg — kutije, battles i oldtajmeri",
  description: "Otvaraj kutije s automobilima, igraj case battles, upgrader, crash, rulet i jackpot. Samo virtualni coini.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hr" className={`${manrope.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <BackgroundFX />
        <AuthProvider>
          <ToastProvider>
            <WinOverlayProvider>
              <Navbar />
              <ChatProvider>
              <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8"><Suspense fallback={null}><BackButton /></Suspense>{children}</main>
              <footer className="border-t border-white/5">
                <div className="livery-band h-px opacity-60" />
                <p className="py-6 text-center text-xs text-muted">
                  GARAŽA.gg je hobi projekt. Coini, gemovi i automobili su virtualni i nemaju stvarnu vrijednost. Nema uplata ni isplata.{" "}
                  <a href="/autori-fotografija" className="underline hover:text-fg">Autori fotografija</a>
                </p>
              </footer>
              </ChatProvider>
            </WinOverlayProvider>
          </ToastProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
