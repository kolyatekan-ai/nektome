import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Burmalda',
  description: 'Discord-like real-time messenger',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
