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
    slug: 'ad-astra-per-aspera',
    title: 'Ad Astra Per Aspera',
    description:
      'The story behind ozskr.ai — from a GED and a heart condition to building an AI agent platform with nothing but Claude Code and grit.',
    author: 'Matty Adams',
    publishedAt: '2026-02-22',
    readingTime: '5 min read',
    keywords: ['AI', 'Solana', 'Building', 'Personal', 'ozskr', 'Claude Code', 'builder bio'],
    content: `*Through Hardships to the Stars*

I have been a tinkerer my entire life. Not the credentialed kind. Not the kind that earns you a seat at the table before you've proven anything. The kind that takes apart the VCR at six to understand how it works. The kind that builds interactive wine menus on iPads at Disney restaurants because nobody else can see what's coming. The kind that learns Sencha and jQuery Mobile and deploys on Verizon hotspots because the dream won't wait for better infrastructure.

I am a digital tinkerer. A hobbyist developer born in 1985 — the same year Geoffrey Hinton built his first tiny language model in a basement lab, decades before the world would understand what he'd started. Hinton planted a seed. I grew up learning to build in its shade, long before I knew the tree had a name.

But here's the thing about tinkerers — we have questions. Endless questions. And for most of my life, the answers were gated behind institutions I couldn't access and credentials I didn't carry. I have a GED. At 17, I was a gifted student in mathematics at an engineering, science, and technology magnet. I enjoyed Cisco. I exploited telnet to spoof a love letter from my Cisco teacher to my Pre-Algebra teacher across the hall. Earned me a 10-day in school suspension. I was proud of it. I only studied in classes that mattered to me — this is because Novell's network "security" was more of a suggestion. Teachers stored their exams on shared storage. They just didn't know who all it was really shared with.

Then, I was involved in a major car accident coming home from my summer job before my senior year. The snakebite of Purdue Pharma got me — hard. My academic ambitions were gone. 20 years later — I rekindled with Academia. I am a full time student at AIU (Artificial Intelligence University).

In July 2025, Elon Musk stood on a stage and said his latest AI model was "better than PhD level in everything." Context matters here. Musk was talking about Grok. I use Claude. Of the frontier models, Claude is the best. It isn't even close. But when a man of Musk's stature tells the world that an artificial intelligence system has achieved doctoral-level competence across *every discipline simultaneously* — I listened. Because in this life, I have questions. And for the first time in human history, the answers aren't locked behind a paywall, a pedigree, or a proximity to power.

## The 2 Sigma Problem

In 1984, educational psychologist Benjamin Bloom published a paper that should have changed everything. He found that students who received one-to-one tutoring performed two standard deviations above their conventionally taught peers. The average tutored student outperformed 98% of the classroom. Bloom called it the 2 Sigma Problem: if individualized instruction is this powerful, why can't we scale it?

For forty years, the answer was simple. One-to-one education was a luxury. A privilege of the aristocracy. The child of a senator got a private tutor in Latin and calculus while the child of a divorced family in Orlando delivered newspapers at dawn and rang groceries at Publix by fourteen. The knowledge was the same. The access was not. Bloom himself said it: "One-to-one tutoring is too costly for most societies to bear on a large scale."

**That sentence is no longer true.**

For twenty dollars a month, every human on Earth can now have a PhD-level tutor available around the clock, in every subject, with infinite patience and near-perfect recall. The 2 Sigma Problem isn't unsolved. It's obsolete. The paradigm didn't shift. It shattered.

This is why I am an accelerator. Not a developer. Not an engineer. An *accelerator*. I believe the paradigm has inverted. It was learn to build. Now it's build to learn. You don't study architecture for four years and then design a building. You design the building with an intelligence partner that teaches you architecture in real time, at the exact moment you need it, calibrated to the exact problem in front of you. Bloom's dream, delivered through a chat window.

Academia is due for a reckoning. Not destruction — **transformation**. The four-year degree was a gatekeeping mechanism dressed as education. It worked for a world where knowledge was scarce and access was rationed. We no longer live in that world.

## The Hardship Is the Point

*Ad astra per aspera isn't a bumper sticker. It's a diagnosis.*

My parents divorced when I was young enough for it to fracture everything. My mother's mental illness was treated as a scarlet letter in the Catholic school system of the 1990s. My dad and I delivered newspapers at dawn to keep the lights on. I was racing BMX and winning spelling bees while the foundation beneath me was turning to sand. Then the car accident and consequent battle with addiction.

Then the heart. For over a decade, arrhythmogenic right ventricular cardiomyopathy kept my body in a state of constant vigilance. Millions of extra heartbeats. Multiple trips to the electrophysiology lab (seven — to be exact). A life lived in permanent fight-or-flight. Doctors call it allostatic load. I called it the bear that only I could see.

On December 9, 2024, an off-label Farapulse ablation — approved for nothing of the sort — silenced the arrhythmia. The bear disappeared. And in the sudden quiet, everything snapped into focus. Not peace. Clarity. The kind of clarity that demands you build something worthy of the suffering that preceded it.

**And then ozskr.ai.**

## The Recursive Proof

ozskr is what happens when the thesis becomes the product. It is a platform for Constitutional AI Commerce — autonomous agents that create content, pay for services, and publish across social platforms on behalf of their human creators, all within cryptographically enforced spending limits the user controls. Three enforcement layers. Three open-source npm packages. Zero custodial risk. Every line of code committed by an AI agent, directed by a human builder.

The agents didn't just build payment rails. They built the governance checkpoint, the settlement engine, the compliance layer, the content pipeline, the FTC disclosure enforcement, the OFAC screening, and the seven-stage content moderation system. The entire stack. Autonomously orchestrated.

This is the recursive proof: if AI agents can build the infrastructure for AI agent commerce, the thesis holds. If one tinkerer with a GED can architect what traditionally required teams of ten to twenty specialists and twelve to eighteen months of runway, then the gatekeepers are obsolete. The courts are open. Everyone can play ball now.

## Augmentation, Not Replacement

I believe in augmentation, not replacement. That distinction is the spine of everything I build.

In an age when the largest technology companies actively lay off workers in favor of AI as replacement, I choose the opposite stance. I see AI as the democratization of capability — the great equalizer that Bloom dreamed about in 1984 but couldn't scale. For corporations that choose to replace their employees with AI, I would rather see their technology replaced. By people like me. By people like you. By anyone willing to believe in themselves completely — enough to achieve their own impossible dreams.

ozskr exists because I believe human beings spend irreplaceable hours performing tasks that machines can perform better, faster, and at a fraction of the cost — and that the infrastructure to delegate that work safely didn't exist. I built it so a small business owner can attend his daughter's softball games instead of managing cross-platform publishing schedules. So the human sets the destination and the budget, the agent navigates the path, and the human can click their heels and come home at any time.

*There's no place like the chain. And there's no place like home.*

---

To the solo entrepreneurs: you no longer need venture capital, elite teams, or corporate infrastructure. The tools exist. The methodology is proven.

To anyone who was ever told "you can't": the gatekeepers are obsolete. Skills matter more than credentials. Vision trumps pedigree. Persistence beats privilege.

*The hardship was the fuel. The stars were always the destination.*

**AI doesn't replace us. It amplifies us. It doesn't diminish human potential. It unleashes it. It doesn't create dependency. It enables independence.**

Never let anyone tell you that you can't.

---

**Matty Adams**
Founder, VT Infinite, Inc.
Creator of ozskr.ai
AI Accelerator · Grit Junkie · Builder

*[github.com/daftpixie/ozskr](https://github.com/daftpixie/ozskr)*`,
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
