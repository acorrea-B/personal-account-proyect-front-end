import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// The woff2 subsets live in the repo and load through next/font/local: the
// build never touches fonts.googleapis.com (the v0.4.1 deploy died there —
// the google loader returned a null manifest on the runner). The variable
// names stay identical to the google loader so the design tokens in
// globals.css keep working. Self-hosted into the static export: the
// DESIGN.md substitutes (Inter Tight for the Roobert display face, Inter
// for body/UI) ship with the site instead of falling back to system fonts.
const inter = localFont({
  src: './fonts/inter-latin-variable.woff2',
  weight: '100 900',
  variable: '--font-inter-loaded',
  display: 'swap',
});

const interTight = localFont({
  src: './fonts/inter-tight-latin-variable.woff2',
  weight: '400 500',
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
