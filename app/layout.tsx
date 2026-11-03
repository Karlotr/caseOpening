import type { Metadata } from "next";
import { Barlow, Big_Shoulders } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import { WinOverlayProvider } from "@/components/WinOverlay";
import { Navbar } from "@/components/Navbar";
import { ChatProvider } from "@/components/Chat";

const barlow = Barlow({ variable: "--font-barlow", weight: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] });
const shoulders = Big_Shoulders({ variable: "--font-shoulders", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "GARAŽA.gg — kutije, battles i oldtajmeri",
  description: "Otvaraj kutije s automobilima, igraj case battles, upgrader, slide, trinity i jackpot. Samo virtualni coini.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hr" className={`${barlow.variable} ${shoulders.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          <ToastProvider>
            <WinOverlayProvider>
              <Navbar />
              <ChatProvider>
              <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">{children}</main>
              <footer className="border-t border-line">
                <div className="livery-band h-1" />
                <p className="py-6 text-center text-xs text-muted">
                  GARAŽA.gg je hobi projekt. Coini, gemovi i automobili su virtualni i nemaju stvarnu vrijednost. Nema uplata ni isplata.
                </p>
              </footer>
              </ChatProvider>
            </WinOverlayProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
