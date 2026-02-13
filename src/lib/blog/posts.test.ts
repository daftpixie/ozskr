/**
 * Blog Posts Tests
 */

import { describe, it, expect } from 'vitest';
import { getAllBlogPosts, getBlogPost, getAllBlogSlugs, blogPosts } from './posts';

describe('Blog Posts', () => {
  describe('blogPosts data', () => {
    it('contains at least one post', () => {
      expect(blogPosts.length).toBeGreaterThan(0);
    });

    it('has unique slugs', () => {
      const slugs = blogPosts.map((p) => p.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('all posts have required fields', () => {
      for (const post of blogPosts) {
        expect(post.slug).toBeTruthy();
        expect(post.title).toBeTruthy();
        expect(post.description).toBeTruthy();
        expect(post.author).toBeTruthy();
        expect(post.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(post.readingTime).toBeTruthy();
        expect(post.keywords.length).toBeGreaterThan(0);
        expect(post.content.length).toBeGreaterThan(100);
      }
    });
  });

  describe('getAllBlogPosts', () => {
    it('returns posts sorted by date descending', () => {
      const posts = getAllBlogPosts();
      for (let i = 1; i < posts.length; i++) {
        expect(
          new Date(posts[i - 1].publishedAt).getTime()
        ).toBeGreaterThanOrEqual(
          new Date(posts[i].publishedAt).getTime()
        );
      }
    });

    it('returns a copy (not the original array)', () => {
      const posts1 = getAllBlogPosts();
      const posts2 = getAllBlogPosts();
      expect(posts1).not.toBe(posts2);
    });
  });

  describe('getBlogPost', () => {
    it('returns post by slug', () => {
      const post = getBlogPost('how-ai-built-ai-platform');
      expect(post).toBeDefined();
      expect(post?.title).toBe('How AI Built an AI Agent Platform');
    });

    it('returns undefined for unknown slug', () => {
      const post = getBlogPost('nonexistent-post');
      expect(post).toBeUndefined();
    });
  });

  describe('getAllBlogSlugs', () => {
    it('returns all slugs', () => {
      const slugs = getAllBlogSlugs();
      expect(slugs).toContain('how-ai-built-ai-platform');
      expect(slugs).toContain('architecture-deep-dive');
    });
  });
});
