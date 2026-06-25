import type { Metadata } from 'next';
import { Inter, Oswald } from 'next/font/google';
import '@cchub/ui/theme';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-oswald',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CCHub - Consultant Profile Platform',
  description: 'Manage and share consultant profiles for Change Connected',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable}`}>
      <body className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-body antialiased">
        {children}
      </body>
    </html>
  );
}
