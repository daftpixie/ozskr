/**
 * Public Footer
 * Shared footer for public pages (landing, blog, legal, livepaper)
 * Server component — no client-side interactivity needed
 */

import Link from 'next/link';
import { Github } from 'lucide-react';

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
              aria-label="X (Twitter)"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
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
          <Link href="/terms" className="transition-colors hover:text-white">
            Terms
          </Link>
          <span className="text-white/20">&middot;</span>
          <Link href="/privacy" className="transition-colors hover:text-white">
            Privacy
          </Link>
          <span className="text-white/20">&middot;</span>
          <Link href="/cookies" className="transition-colors hover:text-white">
            Cookies
          </Link>
          <span className="text-white/20">&middot;</span>
          <Link href="/legal" className="transition-colors hover:text-white">
            All Legal
          </Link>
        </div>
      </div>
    </footer>
  );
}
