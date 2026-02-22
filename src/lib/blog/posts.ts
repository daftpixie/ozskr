/**
 * Blog Post Registry
 * Static blog posts with metadata for SEO and rendering.
 * Content is stored as string literals — no runtime file reads needed.
 */

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  author: string;
  publishedAt: string;
  readingTime: string;
  keywords: string[];
  content: string;
  contentFile?: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'the-ozskr-livepaper',
    title: 'The ozskr.ai Livepaper',
    description:
      'The canonical technical specification for ozskr.ai. Architecture, delegation model, on-chain enforcement, and everything backing the platform — commit-linked and verifiable.',
    author: 'ozskr.ai',
    publishedAt: '2026-02-19',
    readingTime: '35 min read',
    keywords: ['livepaper', 'architecture', 'Solana', 'AI agents', 'delegation', 'TEE', 'x402'],
    content: '',
    contentFile: 'docs/LIVEPAPER.md',
  },
  {
    slug: 'how-ai-built-ai-platform',
    title: 'How AI Built an AI Agent Platform',
    description:
      'The full story of building ozskr.ai with Claude Code. 12 AI agents. 6 development phases. 547 tests. Real costs, real lessons, real architecture.',
    author: 'Matt',
    publishedAt: '2026-02-13',
    readingTime: '6 min read',
    keywords: ['AI development', 'Claude Code', 'AI agents', 'build-in-public', 'Solana'],
    content: `Every line of code in ozskr.ai was written by AI.

Not generated from a template. Not autocompleted by a copilot. Written, tested, reviewed, and deployed by a team of 12 specialized AI agents orchestrated through Claude Code.

This is the story of how we built an AI agent platform using AI agents.

## The Problem

Building a Web3 AI platform from scratch is a massive undertaking. You need blockchain integration, AI pipelines, content moderation, social publishing, DeFi operations, infrastructure — the list goes on. For a solo founder, this would normally take 6-12 months with a team.

## The Approach: Multi-Agent Orchestration

Instead of writing code manually, we designed a system where Claude Opus 4.6 acts as the strategic orchestrator, delegating work to specialized agents:

- **solana-dev** handles all blockchain operations
- **frontend-dev** builds the React UI
- **ai-agent-dev** designs the content pipeline
- **api-architect** structures the backend
- **test-writer** ensures quality
- **security-auditor** validates safety

Each agent has a defined domain, clear boundaries, and escalation rules. They never call each other directly — only the orchestrator delegates.

## The Results

**6 development phases completed in weeks, not months:**

1. Foundation: Wallet auth, dashboard, Supabase schema
2. Agent Core: Content pipeline with 7-stage processing
3. Trading: Jupiter Ultra integration with DeFi safety
4. Hardening: Rate limiting, monitoring, test coverage
5. Polish: Gamification, performance, multi-agent orchestration
6. Launch Operations: CI/CD, legal, marketing, community

**By the numbers:**
- 482+ passing tests across 48 files
- Zero critical security vulnerabilities
- Full TypeScript strict mode coverage
- 10 legal policy documents
- Complete open-source documentation

## Key Lessons

**1. Agent boundaries matter more than agent capabilities.** The most important architectural decision was defining clear ownership boundaries. When agents try to do too much, quality drops. When boundaries are crisp, each agent can go deep.

**2. The orchestrator's job is coordination, not implementation.** Opus plans, decomposes, reviews, and synthesizes. It never writes code directly. This separation of concerns is what makes the system scale.

**3. Security must be a first-class concern.** Every PR that touches blockchain, DeFi, or API code goes through a mandatory security audit. The security-auditor agent runs read-only checks and cannot be bypassed.

**4. Testing is the foundation of trust.** With AI writing all the code, comprehensive test coverage becomes critical. Each agent is paired with the test-writer to ensure quality.

## What's Next

We're entering closed alpha with a small group of testers. The platform lets you create AI-powered digital influencers on Solana — characters with unique personalities that generate and publish content autonomously.

If you're interested in being an early tester, [join the waitlist](https://ozskr.ai).

*Built with Claude Code. The magic is in your hands.*`,
  },
  {
    slug: 'architecture-deep-dive',
    title: 'Architecture Deep Dive: Building a Web3 AI Platform',
    description:
      'A technical walkthrough of ozskr.ai architecture. Next.js 15, Hono API, Supabase, @solana/kit, and a 7-stage AI content pipeline.',
    author: 'Matt',
    publishedAt: '2026-02-14',
    readingTime: '8 min read',
    keywords: ['architecture', 'Next.js', 'Hono', 'Supabase', 'Solana', 'AI pipeline'],
    content: `How do you build a platform that combines AI content generation, blockchain operations, and social publishing into a coherent system? Here's how ozskr.ai is architected.

## The Stack

- **Frontend:** Next.js 15 App Router with React Server Components
- **API Layer:** Hono running inside Next.js catch-all route
- **Database:** Supabase (PostgreSQL 16 + pgvector + Row Level Security)
- **Blockchain:** @solana/kit for all Solana operations
- **AI:** Claude API (Anthropic) + fal.ai for image generation
- **Memory:** Mem0 for persistent agent memory
- **Background Jobs:** Trigger.dev Cloud

## The Content Pipeline

The heart of ozskr.ai is its 7-stage content pipeline:

1. **Parse** — Validate and normalize the generation request
2. **Context** — Load character DNA, memory, and relevant history
3. **Enhance** — Enrich the prompt with platform context and style guides
4. **Generate** — Call Claude API with the enhanced prompt
5. **Quality** — Evaluate output against quality thresholds
6. **Moderation** — Run content safety checks
7. **Store** — Persist to Supabase with full metadata

Each stage is a pure function with typed inputs and outputs. Stages can be retried independently, and the pipeline supports streaming via Server-Sent Events for real-time UI updates.

## Security Model

Security is non-negotiable in a Web3 platform:

- **All signing is client-side** via wallet adapter. The server never sees private keys.
- **Transaction simulation** is required before any write operation.
- **Slippage guards** are enforced on all swap operations (default 50 bps).
- **Row Level Security** on every Supabase table — no query without auth context.
- **Content moderation** runs before any content is stored or published.
- **Rate limiting** is enforced per-wallet at the edge layer.

## What Makes It Different

Most Web3 platforms treat AI as a feature. ozskr.ai treats AI as the foundation. Every agent you create has persistent memory, a unique voice, and the ability to evolve over time. The platform doesn't just generate content — it creates characters that grow.

*This is just the beginning. More architecture deep dives coming soon.*`,
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

export function getAllBlogPosts(): BlogPost[] {
  return [...blogPosts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getAllBlogSlugs(): string[] {
  return blogPosts.map((p) => p.slug);
}
