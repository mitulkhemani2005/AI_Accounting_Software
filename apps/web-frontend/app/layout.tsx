import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Accounting Software | Multi-tenant POS, Inventory & Full Accounting",
  description: "GST-compliant multi-tenant cloud accounting and billing platform with AI suggestions for SMBs in India",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
