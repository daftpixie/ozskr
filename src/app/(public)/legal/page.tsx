/**
 * Legal Index Page
 * Lists all legal documents
 * Server component — static generation
 * Header and footer provided by (public) layout
 */

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const LEGAL_DOCS = [
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    description: 'How we collect, use, and protect your data',
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    description: 'Terms and conditions for using ozskr.ai',
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    description: 'Rules and guidelines for platform usage',
  },
  {
    slug: 'token-disclaimer',
    title: '$HOPE Token Disclaimer',
    description: 'Important disclaimers about $HOPE tokens',
  },
  {
    slug: 'ai-disclosure',
    title: 'AI Content Disclosure',
    description: 'Transparency about AI-generated content',
  },
  {
    slug: 'token-usage',
    title: 'Token Usage Terms',
    description: 'Terms governing $HOPE token usage',
  },
  {
    slug: 'cookies',
    title: 'Cookie Policy',
    description: 'How we use cookies and tracking technologies',
  },
  {
    slug: 'data-retention',
    title: 'Data Retention Policy',
    description: 'How long we keep your data',
  },
  {
    slug: 'dmca',
    title: 'DMCA Policy',
    description: 'Copyright infringement reporting process',
  },
  {
    slug: 'content-moderation',
    title: 'Content Moderation Policy',
    description: 'How we moderate AI-generated content',
  },
  {
    slug: 'wallet-terms',
    title: 'Wallet & Transaction Terms',
    description: 'Terms for wallet connections and blockchain transactions',
  },
] as const;

export const metadata = {
  title: 'Legal | ozskr.ai',
  description: 'Legal documentation for ozskr.ai — privacy policy, terms of service, and more.',
};

export default function LegalIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 pt-24">
      <div className="mb-12 text-center">
        <h1 className="font-display mb-4 text-4xl font-bold text-white sm:text-5xl">Legal</h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Transparency is part of our magic. All legal documents are publicly available here.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {LEGAL_DOCS.map((doc, i) => (
          <Link key={doc.slug} href={`/legal/${doc.slug}`}>
            <Card
              className="h-full border-white/5 bg-white/[0.02] transition-all duration-200 hover:scale-[1.02] hover:border-solana-purple/30 animate-in fade-in"
              style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
            >
              <CardContent className="flex h-full flex-col gap-3 pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-solana-purple/10">
                  <FileText className="h-5 w-5 text-solana-purple" />
                </div>
                <h2 className="font-display text-lg font-semibold text-white">{doc.title}</h2>
                <p className="text-sm text-muted-foreground">{doc.description}</p>
                <div className="mt-auto pt-2">
                  <span className="text-xs text-solana-purple">Read document &rarr;</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-12 rounded-lg border border-white/5 bg-white/[0.02] p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Questions about our legal docs?{' '}
          <a
            href="mailto:matthew@vt-infinite.com"
            className="text-solana-purple underline transition-colors hover:text-solana-green"
          >
            Contact us
          </a>
        </p>
      </div>
    </div>
  );
}
