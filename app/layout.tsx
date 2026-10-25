import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
