import type { Metadata } from 'next';
import './globals.css';
import { Outfit } from 'next/font/google';
import DevSwCleanup from '@/components/dev-sw-cleanup';

const font = Outfit({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'ShopSense | Public Product Search for Chennai Metro',
  description: 'Search products across Chennai, Tiruvallur, Chengalpattu, and Kanchipuram with nearby store discovery, route guidance, and beta price forecasts.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={font.className}>
      <body>
        <DevSwCleanup />
        <main className="min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
