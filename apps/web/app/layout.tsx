import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import '@bench/ui/theme';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700', '900'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bench - Consultant Profile Platform',
  description: 'Multi-tenant consultant profile platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] antialiased" style={{ fontFamily: 'var(--font-body)' }}>
        {children}
      </body>
    </html>
  );
}
