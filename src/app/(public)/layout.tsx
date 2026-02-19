/**
 * Public Layout
 * Shared layout for public pages: landing, blog, legal, livepaper
 * Provides consistent header and footer across all public routes
 */

import { PublicHeader } from '@/components/features/public-header';
import { PublicFooter } from '@/components/features/public-footer';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-void-black text-white">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
