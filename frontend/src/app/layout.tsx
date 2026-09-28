import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "DocuMind | AI Document Intelligence & Research Platform",
  description: "Enterprise-grade AI document intelligence platform for PDF, DOCX, and TXT parsing, semantic search, grounded Q&A, and citation-backed analytics.",
  keywords: ["AI document intelligence", "PDF RAG", "pgvector", "enterprise search", "DocuMind", "document comparison"],
  authors: [{ name: "DocuMind Team" }],
  openGraph: {
    title: "DocuMind | AI Document Intelligence",
    description: "Enterprise-grade AI document intelligence platform for PDF, DOCX, and TXT parsing, semantic search, grounded Q&A, and citation-backed analytics.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
