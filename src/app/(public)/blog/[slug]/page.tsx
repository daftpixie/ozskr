import { readFileSync } from 'fs';
import { join } from 'path';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBlogPost, getAllBlogSlugs } from '@/lib/blog/posts';
import { MarkdownRenderer } from '@/components/features/legal/markdown-renderer';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: 'Not Found | ozskr.ai' };

  const ogImage = slug === 'the-ozskr-livepaper'
    ? '/og/og-livepaper.png'
    : '/og/og-default.png';

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author],
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [ogImage],
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  // Load content from file if contentFile is specified
  let content = post.content;
  if (post.contentFile) {
    try {
      content = readFileSync(join(process.cwd(), post.contentFile), 'utf-8');
    } catch {
      notFound();
    }
  }

  const useMarkdownRenderer = !!post.contentFile;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <Link
        href="/blog"
        className="mb-8 inline-block text-sm text-muted-foreground transition-colors hover:text-white"
      >
        &larr; All posts
      </Link>

      <article>
        <header className="mb-8">
          <time
            dateTime={post.publishedAt}
            className="text-sm text-muted-foreground"
          >
            {new Date(post.publishedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {post.title}
          </h1>
          <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
            <span>{post.author}</span>
            <span>&middot;</span>
            <span>{post.readingTime}</span>
          </div>
        </header>

        {useMarkdownRenderer ? (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-8 md:p-12">
            <MarkdownRenderer content={content} />
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            {content.split('\n\n').map((block, i) => {
              if (block.startsWith('## ')) {
                return (
                  <h2
                    key={i}
                    className="mt-8 mb-4 font-display text-xl font-bold text-white"
                  >
                    {block.slice(3)}
                  </h2>
                );
              }
              if (block.startsWith('**') && block.endsWith('**')) {
                return (
                  <p key={i} className="my-4 font-medium text-white">
                    {block.slice(2, -2)}
                  </p>
                );
              }
              if (block.startsWith('- ')) {
                const items = block.split('\n').filter(Boolean);
                return (
                  <ul key={i} className="my-4 space-y-1 pl-4">
                    {items.map((item, j) => (
                      <li key={j} className="text-muted-foreground">
                        {item.slice(2)}
                      </li>
                    ))}
                  </ul>
                );
              }
              if (block.startsWith('1. ') || block.startsWith('**1.')) {
                const items = block.split('\n').filter(Boolean);
                return (
                  <ol key={i} className="my-4 space-y-1 pl-4 list-decimal">
                    {items.map((item, j) => {
                      const text = item.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '');
                      return (
                        <li key={j} className="text-muted-foreground">
                          {text}
                        </li>
                      );
                    })}
                  </ol>
                );
              }
              if (block.startsWith('*') && block.endsWith('*') && !block.startsWith('**')) {
                return (
                  <p key={i} className="my-4 italic text-muted-foreground">
                    {block.slice(1, -1)}
                  </p>
                );
              }
              return (
                <p key={i} className="my-4 leading-relaxed text-muted-foreground">
                  {block}
                </p>
              );
            })}
          </div>
        )}
      </article>

      <hr className="my-12 border-white/5" />

      <div className="text-center">
        <Link
          href="/blog"
          className="text-sm text-muted-foreground transition-colors hover:text-white"
        >
          &larr; Back to all posts
        </Link>
      </div>
    </div>
  );
}
