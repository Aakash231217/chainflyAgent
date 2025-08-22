import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DefectProvider } from "@/contexts/DefectContext";
import AuthProvider from "@/components/AuthProvider";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Chainfly AI Agent Dashboard",
  description: "AI-powered defect detection for solar infrastructure",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans antialiased bg-white`}
      >
        <AuthProvider>
          <DefectProvider>
            {children}
          </DefectProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
