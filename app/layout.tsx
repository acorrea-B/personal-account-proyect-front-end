import type { Metadata } from 'next';
import { Inter, Inter_Tight } from 'next/font/google';
import './globals.css';

// Self-hosted by next/font into the static export: the DESIGN.md substitutes
// (Inter Tight for the Roobert display face, Inter for body/UI) actually ship
// with the site instead of falling back to system fonts.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter-loaded',
  display: 'swap',
});

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-tight-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Professional Profile',
  description: 'Private profile and CV management.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable}`}>
      <body>{children}</body>
    </html>
  );
}
