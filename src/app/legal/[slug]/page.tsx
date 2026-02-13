/**
 * Legal Document Page
 * Dynamic route for displaying legal documents from docs/legal/
 * Server component — reads markdown files at build time
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MarkdownRenderer } from '@/components/features/legal/markdown-renderer';
import { notFound } from 'next/navigation';

// Map slugs to markdown files and titles
const LEGAL_DOCS = {
  privacy: {
    file: 'privacy-policy.md',
    title: 'Privacy Policy',
  },
  terms: {
    file: 'terms-of-service.md',
    title: 'Terms of Service',
  },
  'acceptable-use': {
    file: 'acceptable-use-policy.md',
    title: 'Acceptable Use Policy',
  },
  'token-disclaimer': {
    file: 'token-disclaimer.md',
    title: '$HOPE Token Disclaimer',
  },
  'ai-disclosure': {
    file: 'ai-content-disclosure.md',
    title: 'AI Content Disclosure',
  },
  'token-usage': {
    file: 'token-usage-terms.md',
    title: 'Token Usage Terms',
  },
  cookies: {
    file: 'cookie-policy.md',
    title: 'Cookie Policy',
  },
  'data-retention': {
    file: 'data-retention-policy.md',
    title: 'Data Retention Policy',
  },
  dmca: {
    file: 'dmca-policy.md',
    title: 'DMCA Policy',
  },
  'content-moderation': {
    file: 'content-moderation-policy.md',
    title: 'Content Moderation Policy',
  },
  'wallet-terms': {
    file: 'wallet-terms.md',
    title: 'Wallet & Transaction Terms',
  },
} as const;

type LegalSlug = keyof typeof LEGAL_DOCS;

interface LegalPageProps {
  params: {
    slug: string;
  };
}

// Generate static params for all legal documents
export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((slug) => ({
    slug,
  }));
}

// Generate metadata for each legal page
export function generateMetadata({ params }: LegalPageProps) {
  const doc = LEGAL_DOCS[params.slug as LegalSlug];
  if (!doc) {
    return {
      title: 'Not Found',
    };
  }

  return {
    title: `${doc.title} | ozskr.ai`,
    description: `Legal documentation for ozskr.ai — ${doc.title}`,
  };
}

export default function LegalPage({ params }: LegalPageProps) {
  const doc = LEGAL_DOCS[params.slug as LegalSlug];

  // 404 if slug is not in our map
  if (!doc) {
    notFound();
  }

  // Read markdown file at build time
  const legalDocsPath = join(process.cwd(), 'docs', 'legal', doc.file);
  let content: string;

  try {
    content = readFileSync(legalDocsPath, 'utf-8');
  } catch (error) {
    console.error(`Failed to read legal document: ${doc.file}`, error);
    notFound();
  }

  return (
    <div className="relative min-h-screen bg-void-black text-white">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <span className="logo-brick logo-brick-gradient text-[10px]" />
            <span className="font-display bg-gradient-to-r from-solana-purple to-solana-green bg-clip-text text-transparent">
              ozskr.ai
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-24">
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-8 md:p-12">
          <MarkdownRenderer content={content} />
        </div>

        {/* Footer navigation */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
          <Link
            href="/legal"
            className="text-sm text-muted-foreground transition-colors hover:text-white"
          >
            View all legal documents
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-white"
          >
            Return to ozskr.ai
          </Link>
        </div>
      </main>
    </div>
  );
}
