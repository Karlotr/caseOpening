import type { Metadata } from "next";
import { Chakra_Petch, Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import { Navbar } from "@/components/Navbar";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] });
const display = Chakra_Petch({ variable: "--font-chakra", weight: ["500", "600", "700"], subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "GARAŽA.gg — kutije, battles i oldtajmeri",
  description: "Otvaraj kutije s automobilima, igraj case battles, upgrader, slide, trinity i jackpot. Samo virtualni coini.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hr" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          <ToastProvider>
            <Navbar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">{children}</main>
            <footer className="border-t border-line py-6 text-center text-xs text-muted">
              GARAŽA.gg — hobi projekt. Svi coini, gemovi i automobili su virtualni i nemaju stvarnu vrijednost. Nema uplata ni isplata.
            </footer>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
