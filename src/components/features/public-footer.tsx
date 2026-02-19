/**
 * Public Footer
 * Shared footer for public pages (landing, blog, legal, livepaper)
 * Server component — no client-side interactivity needed
 */

import Link from 'next/link';
import { Github, Twitter } from 'lucide-react';

export function PublicFooter() {
  return (
    <footer className="border-t border-white/5 py-8">
      <div className="mx-auto max-w-6xl space-y-6 px-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/daftpixie/ozskr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-white"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            <a
              href="https://x.com/ozskr_ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-white"
              aria-label="Twitter"
            >
              <Twitter className="h-5 w-5" />
            </a>
          </div>

          <p className="text-sm text-muted-foreground">
            Built with Claude Code. The magic is in your hands.
          </p>

          <p className="text-sm text-muted-foreground">
            MIT License
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 border-t border-white/5 pt-6 text-xs text-muted-foreground">
          <Link href="/blog" className="transition-colors hover:text-white">
            Blog
          </Link>
          <span className="text-white/20">&middot;</span>
          <Link href="/livepaper" className="transition-colors hover:text-white">
            Livepaper
          </Link>
          <span className="text-white/20">&middot;</span>
          <Link href="/legal/privacy" className="transition-colors hover:text-white">
            Privacy Policy
          </Link>
          <span className="text-white/20">&middot;</span>
          <Link href="/legal/terms" className="transition-colors hover:text-white">
            Terms of Service
          </Link>
          <span className="text-white/20">&middot;</span>
          <Link href="/legal/cookies" className="transition-colors hover:text-white">
            Cookies
          </Link>
        </div>
      </div>
    </footer>
  );
}
