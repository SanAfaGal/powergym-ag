import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Self-hosted (latin subset, variable weight) instead of next/font/google:
// the Google variant makes the build download the fonts, which failed inside
// Netlify's builder ("next/font/google queries have exactly one entry"), and
// it would leave a kiosk on a local network without its fonts. The files are
// the same Manrope / Quicksand woff2 that Google serves for the latin range.
const manrope = localFont({
  src: "./fonts/Manrope-latin.woff2",
  variable: "--font-manrope",
  weight: "400 700",
  display: "swap",
});

const quicksand = localFont({
  src: "./fonts/Quicksand-latin.woff2",
  variable: "--font-quicksand",
  // 600 isn't used anywhere -- every font-heading element pairs with either
  // font-medium (500, card/dialog/sheet titles) or font-bold (700, page
  // titles), never font-semibold.
  weight: "500 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PowerGym AG",
  description: "Gestión de clientes, suscripciones y pagos de PowerGym AG",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${manrope.variable} ${quicksand.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
