import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllBlogPosts } from '@/lib/blog/posts';

export const metadata: Metadata = {
  title: 'Blog | ozskr.ai',
  description: 'Build-in-public updates, technical deep dives, and AI agent development insights from the ozskr.ai team.',
  openGraph: {
    title: 'Blog | ozskr.ai',
    description: 'Build-in-public updates, technical deep dives, and AI agent development insights.',
    type: 'website',
  },
};

export default function BlogPage() {
  const posts = getAllBlogPosts();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <header className="mb-12">
        <h1 className="font-display text-4xl font-bold tracking-tight text-white">Blog</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Build-in-public updates and technical deep dives.
        </p>
      </header>

      <div className="space-y-8">
        {posts.map((post) => (
          <article
            key={post.slug}
            className="group rounded-lg border border-white/5 bg-white/[0.02] p-6 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
          >
            <Link href={`/blog/${post.slug}`} className="block">
              <time
                dateTime={post.publishedAt}
                className="text-xs text-muted-foreground"
              >
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
              <h2 className="mt-2 font-display text-xl font-bold text-white group-hover:text-solana-green transition-colors">
                {post.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {post.description}
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{post.author}</span>
                <span>&middot;</span>
                <span>{post.readingTime}</span>
              </div>
            </Link>
          </article>
        ))}
      </div>

      {posts.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          No posts yet. Check back soon.
        </p>
      )}
    </div>
  );
}
