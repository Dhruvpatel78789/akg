import type { Metadata } from "next";
import { Exo } from "next/font/google";
import "./globals.css";
import FetchErrorSanitizer from "@/components/FetchErrorSanitizer";

const exo = Exo({
  subsets: ["latin"],
  variable: "--font-exo",
});

export const metadata: Metadata = {
  title: "Game Management",
  description: "Game booking and membership system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={exo.variable} suppressHydrationWarning>
        <FetchErrorSanitizer />
        {children}
      </body>
    </html>
  );
}