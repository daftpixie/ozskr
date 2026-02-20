import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Livepaper',
  description: 'The canonical technical specification for ozskr.ai — architecture, principles, and on-chain proof.',
  openGraph: {
    title: 'The ozskr.ai Livepaper',
    description: 'Architecture, principles, and on-chain proof.',
    images: [{ url: '/og/og-livepaper.png', width: 1200, height: 630, alt: 'ozskr.ai Livepaper' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og/og-livepaper.png'],
  },
};

export default function LivepaperPage() {
  redirect('/blog/the-ozskr-livepaper');
}
