import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: `${APP_NAME}: comunicados, novidades, pessoas, agenda, documentos e links úteis.`,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0B2430",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
