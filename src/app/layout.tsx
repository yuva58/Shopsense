import type { Metadata } from 'next';
import './globals.css';
import { Outfit } from 'next/font/google';

const font = Outfit({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'ShopSense | Discover Nearby Shops & AI Price Predictions',
  description: 'Find the best local shops, compare prices instantly, and leverage AI to predict future discounts and filter genuine reviews.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={font.className}>
      <body>
        <main className="min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
