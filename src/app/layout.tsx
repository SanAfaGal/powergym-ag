import type { Metadata } from "next";
import { Manrope, Quicksand } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  // 600 isn't used anywhere -- every font-heading element pairs with either
  // font-medium (500, card/dialog/sheet titles) or font-bold (700, page
  // titles), never font-semibold. Declaring it anyway made Next.js preload
  // a font file the browser never actually used.
  weight: ["500", "700"],
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
