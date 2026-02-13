# ozskr.ai Brand Style Guide

**Version:** 1.0
**Date:** February 4, 2026
**Status:** Final

---

## Table of Contents

1. [Brand Overview](#1-brand-overview)
2. [Brand Story & Messaging](#2-brand-story--messaging)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Logo & Iconography](#5-logo--iconography)
6. [Visual Language](#6-visual-language)
7. [Voice & Tone](#7-voice--tone)
8. [CSS Style Guide](#8-css-style-guide)
9. [Application Examples](#9-application-examples)
10. [Do's and Don'ts](#10-dos-and-donts)

---

## 1. Brand Overview

### Brand Name
**ozskr.ai** (pronounced "oz-skr" or "oscar")

### Name Etymology
The name combines two powerful references:

| Element | Meaning | Connection |
|---------|---------|------------|
| **Oz** | The Wizard of Oz | Magic, transformation, pulling back the curtain on AI |
| **skr** | Solana Seeker | Alignment with Solana ecosystem naming conventions |
| **.ai** | Artificial Intelligence | Core technology platform identifier |

### Brand Essence
ozskr.ai empowers creators to build AI-powered digital influencers -- revealing the magic behind the curtain while making powerful AI accessible to everyone.

### Brand Pillars

1. **Transformation** -- Turn imagination into digital reality
2. **Transparency** -- Honest about AI's role in content creation
3. **Self-Discovery** -- Help users find their creative voice
4. **Community** -- Follow the road together

---

## 2. Brand Story & Messaging

### The Wizard of Oz Connection

Like the Wizard of Oz, ozskr.ai deals with the intersection of appearance and reality. The Wizard was revealed to be "just a man behind the curtain" -- but that didn't diminish his ability to help Dorothy and her friends find what they were looking for. They already had the courage, heart, and brains they sought.

Similarly, ozskr.ai reveals that the magic of AI influencers isn't mystical -- it's accessible technology that empowers users to discover their own creative capabilities.

### Primary Tagline

> **"Pay no mind to the 'agents' behind the emerald curtain."**

This playful twist on the iconic line acknowledges our AI agents while inverting the original message -- instead of hiding the technology, we celebrate it.

### Secondary Taglines

| Use Case | Tagline |
|----------|---------|
| Hero/Landing | "Follow the yellow brick road to your digital future" |
| Onboarding | "You've always had the power" |
| Content Creation | "There's no place like $HOME" |
| Community/Social | "We're not in Kansas anymore" |
| Achievement/Success | "Wonderful things happen when you believe" |

### Brand Messaging Framework

#### The Journey Metaphor
Every user is Dorothy -- embarking on a journey of creative discovery. The platform is the Yellow Brick Road, providing clear guidance toward their destination (the Emerald City of creative success).

**Key Narrative Beats:**

1. **Kansas (Before)** -- Ordinary content creation, limited tools
2. **The Cyclone (Disruption)** -- AI technology transforms everything
3. **Munchkinland (Discovery)** -- First encounter with AI capabilities
4. **Yellow Brick Road (Journey)** -- Learning, creating, growing
5. **Emerald City (Destination)** -- Achieving creative vision with AI agents
6. **Home (Realization)** -- The power was within you all along

### Core Messages

**For Creators:**
> "Your AI influencers aren't replacing you -- they're amplifying you. The creativity, vision, and voice? That's all you. We just help you share it with the world."

**For the Web3 Community:**
> "Built on Solana. Powered by AI. Owned by you."

**For Skeptics:**
> "We're not hiding the AI behind a curtain. We're handing you the controls."

---

## 3. Color System

### Primary Palette

The ozskr.ai color system fuses the Solana brand gradient with the emerald greens of the Emerald City and the golden warmth of the Yellow Brick Road.

#### Solana Gradient (Primary Brand Colors)

| Color Name | Hex Code | RGB | Usage |
|------------|----------|-----|-------|
| **Solana Purple** | `#9945FF` | rgb(153, 69, 255) | Primary accent, CTAs, interactive elements |
| **Solana Green** | `#14F195` | rgb(20, 241, 149) | Success states, highlights, secondary accent |

**Gradient Direction:** 135deg (bottom-left to top-right)

```css
background: linear-gradient(135deg, #9945FF 0%, #14F195 100%);
```

#### Emerald City (Secondary Palette)

| Color Name | Hex Code | RGB | Usage |
|------------|----------|-----|-------|
| **Emerald Deep** | `#064E3B` | rgb(6, 78, 59) | Dark backgrounds, text on light |
| **Emerald Core** | `#065F46` | rgb(6, 95, 70) | Primary green, headers |
| **Emerald Bright** | `#047857` | rgb(4, 120, 87) | Buttons, links, interactive |
| **Emerald Light** | `#10B981` | rgb(16, 185, 129) | Hover states, success |
| **Emerald Pale** | `#D1FAE5` | rgb(209, 250, 229) | Backgrounds, subtle highlights |

#### Yellow Brick Road (Accent Palette)

| Color Name | Hex Code | RGB | Usage |
|------------|----------|-----|-------|
| **Brick Gold** | `#F59E0B` | rgb(245, 158, 11) | Logo, premium features, rewards |
| **Brick Warm** | `#FBBF24` | rgb(251, 191, 36) | Highlights, badges, achievements |
| **Brick Light** | `#FDE68A` | rgb(253, 230, 138) | Backgrounds, hover states |
| **Brick Deep** | `#D97706` | rgb(217, 119, 6) | Text on light, borders |
| **Brick Shadow** | `#92400E` | rgb(146, 64, 14) | Shadows, depth |

#### Neutral Palette

| Color Name | Hex Code | RGB | Usage |
|------------|----------|-----|-------|
| **Void Black** | `#0A0A0B` | rgb(10, 10, 11) | Primary dark background |
| **Deep Gray** | `#18181B` | rgb(24, 24, 27) | Card backgrounds |
| **Mid Gray** | `#27272A` | rgb(39, 39, 42) | Borders, dividers |
| **Soft Gray** | `#71717A` | rgb(113, 113, 122) | Secondary text |
| **Light Gray** | `#A1A1AA` | rgb(161, 161, 170) | Placeholder text |
| **Cloud White** | `#FAFAFA` | rgb(250, 250, 250) | Primary light background |
| **Pure White** | `#FFFFFF` | rgb(255, 255, 255) | Text on dark, cards |

### Color Usage Guidelines

#### Dark Mode (Default)
- **Background:** Void Black (`#0A0A0B`)
- **Surface:** Deep Gray (`#18181B`)
- **Text Primary:** Pure White (`#FFFFFF`)
- **Text Secondary:** Light Gray (`#A1A1AA`)
- **Accent:** Solana Gradient or Brick Gold

#### Light Mode
- **Background:** Cloud White (`#FAFAFA`)
- **Surface:** Pure White (`#FFFFFF`)
- **Text Primary:** Void Black (`#0A0A0B`)
- **Text Secondary:** Soft Gray (`#71717A`)
- **Accent:** Emerald Core or Solana Purple

### Semantic Colors

| Purpose | Light Mode | Dark Mode |
|---------|------------|-----------|
| Success | `#047857` | `#14F195` |
| Warning | `#D97706` | `#FBBF24` |
| Error | `#DC2626` | `#F87171` |
| Info | `#9945FF` | `#A855F7` |

---

## 4. Typography

### Font Stack

#### Primary Display Font
**Satoshi** -- A modern, geometric sans-serif with character

```css
font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

#### Secondary Display Font (Alternative)
**Space Grotesk** -- Tech-forward with distinctive character

```css
font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
```

#### Body Font
**Inter** -- Highly legible for long-form content

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

#### Monospace (Code/Technical)
**JetBrains Mono** -- For code blocks and technical content

```css
font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### Type Scale

| Name | Size | Line Height | Weight | Use Case |
|------|------|-------------|--------|----------|
| **Display XL** | 72px / 4.5rem | 1.1 | 700 | Hero headlines |
| **Display LG** | 60px / 3.75rem | 1.1 | 700 | Page titles |
| **Display MD** | 48px / 3rem | 1.2 | 600 | Section headers |
| **H1** | 36px / 2.25rem | 1.2 | 600 | Primary headings |
| **H2** | 30px / 1.875rem | 1.3 | 600 | Secondary headings |
| **H3** | 24px / 1.5rem | 1.3 | 600 | Tertiary headings |
| **H4** | 20px / 1.25rem | 1.4 | 600 | Small headings |
| **Body LG** | 18px / 1.125rem | 1.6 | 400 | Lead paragraphs |
| **Body** | 16px / 1rem | 1.6 | 400 | Standard body text |
| **Body SM** | 14px / 0.875rem | 1.5 | 400 | Secondary content |
| **Caption** | 12px / 0.75rem | 1.5 | 400 | Labels, captions |
| **Overline** | 12px / 0.75rem | 1.5 | 600 | Overlines, tags |

### Typography Guidelines

1. **Headlines** use Satoshi Bold with tight letter-spacing (-0.02em)
2. **Body text** uses Inter Regular with comfortable line-height (1.6)
3. **ALL CAPS** reserved for overlines and badges only
4. **Maximum line width:** 65-75 characters for optimal readability

---

## 5. Logo & Iconography

### Primary Logo: The Yellow Brick

The ozskr.ai logo is a **simple yellow brick** -- a minimalist geometric form referencing the Yellow Brick Road.

#### Logo Specifications

```
+-----------------------------+
|                             |
|   +---------------------+  |
|   |                     |  |
|   |    YELLOW BRICK     |  |
|   |     (Rectangle)     |  |
|   |                     |  |
|   |   Ratio: 2.5:1      |  |
|   |   Corners: 4px      |  |
|   |                     |  |
|   +---------------------+  |
|                             |
|   Color: #F59E0B            |
|   Alt: Solana Gradient      |
|                             |
+-----------------------------+
```

#### Logo Dimensions
- **Aspect Ratio:** 2.5:1 (width:height)
- **Corner Radius:** 4px (proportional to size)
- **Minimum Size:** 24px height / 60px width

#### Logo Color Variants

| Variant | Background | Logo Color |
|---------|------------|------------|
| **Primary** | Dark | Brick Gold (`#F59E0B`) |
| **Gradient** | Dark | Solana Gradient |
| **Light Mode** | Light | Emerald Deep (`#064E3B`) |
| **Monochrome** | Any | White or Black |

### Logo + Wordmark Lockup

```
+----------------------------------------+
|                                        |
|   [brick]  ozskr.ai                   |
|    brick   wordmark                    |
|                                        |
|   Spacing: 0.5x brick height          |
|   Wordmark: Satoshi Bold              |
|                                        |
+----------------------------------------+
```

### Logo Clear Space
Minimum clear space around the logo should equal the height of the brick on all sides.

### Icon System

Use **Lucide Icons** as the primary icon set for consistency with the modern, minimal aesthetic.

#### Custom Brand Icons

| Icon | Name | Use |
|------|------|-----|
| Brick | Yellow Brick | Logo, navigation |
| Sparkle | Sparkle/Magic | AI generation |
| Cyclone | Cyclone | Transformation |
| Rainbow | Rainbow | Success, rewards |
| Gem | Emerald | Premium features |
| Footprints | Ruby Slippers | Home/Return action |

---

## 6. Visual Language

### Design Principles

1. **Magical but Modern** -- Whimsy meets Web3 sophistication
2. **Clear Path Forward** -- Like the Yellow Brick Road, UI guides users
3. **Reveal, Don't Hide** -- Transparency in AI operations
4. **Emerald Elegance** -- Rich greens create depth and atmosphere

### Visual Motifs

#### The Road Pattern
A subtle brick pattern can be used as a background texture:

```css
background-image: repeating-linear-gradient(
  90deg,
  transparent 0px,
  transparent 58px,
  rgba(245, 158, 11, 0.1) 58px,
  rgba(245, 158, 11, 0.1) 60px
),
repeating-linear-gradient(
  0deg,
  transparent 0px,
  transparent 28px,
  rgba(245, 158, 11, 0.1) 28px,
  rgba(245, 158, 11, 0.1) 30px
);
```

#### The Emerald Glow
Cards and interactive elements can have a subtle emerald glow:

```css
box-shadow: 0 0 40px rgba(20, 241, 149, 0.15);
```

#### The Curtain Reveal
Use reveal animations for AI-generated content:

```css
@keyframes curtain-reveal {
  0% { clip-path: inset(0 100% 0 0); }
  100% { clip-path: inset(0 0 0 0); }
}
```

### Imagery Style

- **AI-Generated Content:** Clear visual distinction with subtle border or badge
- **Backgrounds:** Deep, atmospheric with gradients and subtle noise
- **Photography:** High contrast, slightly surreal color grading
- **Illustrations:** Geometric, minimalist with brand colors

### Animation Principles

1. **Purposeful Motion** -- Animations communicate state changes
2. **Ease-Out Dominant** -- Natural deceleration feels organic
3. **Duration:** 150ms-300ms for micro-interactions, 500ms+ for page transitions
4. **Stagger Effects** -- Sequential reveals create narrative flow

---

## 7. Voice & Tone

### Brand Voice Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| **Magical** | Sense of wonder without being childish | "Watch your imagination come to life" |
| **Honest** | Transparent about AI capabilities | "Your AI agent generated this in 12 seconds" |
| **Encouraging** | Supportive of user creativity | "You've already created something amazing" |
| **Playful** | Wizard of Oz references when appropriate | "Ready to see the wizard?" |
| **Confident** | Authority in AI/Web3 space | "Built on Solana for speed that matters" |

### Tone Variations

| Context | Tone | Example |
|---------|------|---------|
| **Marketing** | Inspirational, bold | "The magic is in your hands" |
| **Onboarding** | Friendly, guiding | "Let's build your first AI influencer" |
| **Error States** | Calm, helpful | "Looks like we hit a snag. Let's try again" |
| **Success** | Celebratory | "Your content is live! The Emerald City awaits" |
| **Technical** | Clear, precise | "Transaction confirmed on Solana: 0x..." |

### Writing Guidelines

1. **Use "you" and "your"** -- Make it personal
2. **Active voice** -- "Create content" not "Content is created"
3. **Present tense** -- "Your AI generates..." not "Your AI will generate..."
4. **Avoid jargon** -- Explain complex concepts simply
5. **Wizard of Oz references** -- Use sparingly, 1-2 per user session

### Sample Copy

**CTA Buttons:**
- "Start Creating" (primary)
- "Follow the Road" (exploration)
- "See the Magic" (demo/preview)
- "Take Me Home" (return to dashboard)

**Empty States:**
- "Your gallery is waiting for its first masterpiece"
- "No agents yet? Let's change that"
- "The road is clear -- where will you go?"

**Loading States:**
- "The wizard is working..."
- "Magic in progress..."
- "Following the yellow brick road..."

---

## 8. CSS Style Guide

### Complete CSS Variables System

```css
/* =============================================================================
   ozskr.ai Design System - CSS Variables
   Version: 1.0
   ============================================================================= */

:root {
  /* =========================================================================
     COLOR TOKENS
     ========================================================================= */

  /* Solana Brand Gradient Colors */
  --color-solana-purple: #9945FF;
  --color-solana-green: #14F195;

  /* Solana Gradient */
  --gradient-solana: linear-gradient(135deg, #9945FF 0%, #14F195 100%);
  --gradient-solana-hover: linear-gradient(135deg, #A855F7 0%, #34D399 100%);

  /* Emerald City Palette */
  --color-emerald-deep: #064E3B;
  --color-emerald-core: #065F46;
  --color-emerald-bright: #047857;
  --color-emerald-light: #10B981;
  --color-emerald-pale: #D1FAE5;
  --color-emerald-glow: rgba(20, 241, 149, 0.15);

  /* Yellow Brick Road Palette */
  --color-brick-gold: #F59E0B;
  --color-brick-warm: #FBBF24;
  --color-brick-light: #FDE68A;
  --color-brick-deep: #D97706;
  --color-brick-shadow: #92400E;

  /* Neutral Palette */
  --color-void-black: #0A0A0B;
  --color-deep-gray: #18181B;
  --color-mid-gray: #27272A;
  --color-soft-gray: #71717A;
  --color-light-gray: #A1A1AA;
  --color-cloud-white: #FAFAFA;
  --color-pure-white: #FFFFFF;

  /* Semantic Colors */
  --color-success: #14F195;
  --color-warning: #FBBF24;
  --color-error: #F87171;
  --color-info: #A855F7;

  /* =========================================================================
     DARK THEME (Default)
     ========================================================================= */

  --bg-primary: var(--color-void-black);
  --bg-secondary: var(--color-deep-gray);
  --bg-tertiary: var(--color-mid-gray);
  --bg-elevated: var(--color-deep-gray);

  --text-primary: var(--color-pure-white);
  --text-secondary: var(--color-light-gray);
  --text-tertiary: var(--color-soft-gray);
  --text-inverse: var(--color-void-black);

  --border-default: var(--color-mid-gray);
  --border-subtle: rgba(255, 255, 255, 0.1);
  --border-emphasis: var(--color-solana-purple);

  --accent-primary: var(--color-solana-purple);
  --accent-secondary: var(--color-solana-green);
  --accent-tertiary: var(--color-brick-gold);

  /* =========================================================================
     TYPOGRAPHY
     ========================================================================= */

  /* Font Families */
  --font-display: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

  /* Font Sizes */
  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.875rem;     /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px */
  --text-3xl: 1.875rem;    /* 30px */
  --text-4xl: 2.25rem;     /* 36px */
  --text-5xl: 3rem;        /* 48px */
  --text-6xl: 3.75rem;     /* 60px */
  --text-7xl: 4.5rem;      /* 72px */

  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* Line Heights */
  --leading-none: 1;
  --leading-tight: 1.1;
  --leading-snug: 1.2;
  --leading-normal: 1.5;
  --leading-relaxed: 1.6;
  --leading-loose: 1.8;

  /* Letter Spacing */
  --tracking-tighter: -0.03em;
  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.02em;
  --tracking-wider: 0.05em;

  /* =========================================================================
     SPACING
     ========================================================================= */

  --space-0: 0;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
  --space-24: 6rem;     /* 96px */
  --space-32: 8rem;     /* 128px */

  /* =========================================================================
     BORDERS & RADIUS
     ========================================================================= */

  --radius-none: 0;
  --radius-sm: 0.25rem;    /* 4px */
  --radius-md: 0.5rem;     /* 8px */
  --radius-lg: 0.75rem;    /* 12px */
  --radius-xl: 1rem;       /* 16px */
  --radius-2xl: 1.5rem;    /* 24px */
  --radius-full: 9999px;

  --border-width-thin: 1px;
  --border-width-medium: 2px;
  --border-width-thick: 4px;

  /* =========================================================================
     SHADOWS
     ========================================================================= */

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.3);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.3);
  --shadow-2xl: 0 25px 50px rgba(0, 0, 0, 0.4);

  /* Brand Glows */
  --shadow-emerald-glow: 0 0 40px rgba(20, 241, 149, 0.15);
  --shadow-purple-glow: 0 0 40px rgba(153, 69, 255, 0.2);
  --shadow-gold-glow: 0 0 30px rgba(245, 158, 11, 0.2);

  /* =========================================================================
     TRANSITIONS
     ========================================================================= */

  --duration-instant: 0ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
  --duration-slower: 500ms;

  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

  /* =========================================================================
     Z-INDEX SCALE
     ========================================================================= */

  --z-behind: -1;
  --z-base: 0;
  --z-raised: 10;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-overlay: 300;
  --z-modal: 400;
  --z-popover: 500;
  --z-toast: 600;
  --z-tooltip: 700;

  /* =========================================================================
     COMPONENT TOKENS
     ========================================================================= */

  /* Buttons */
  --btn-height-sm: 2rem;
  --btn-height-md: 2.5rem;
  --btn-height-lg: 3rem;
  --btn-padding-x-sm: var(--space-3);
  --btn-padding-x-md: var(--space-4);
  --btn-padding-x-lg: var(--space-6);

  /* Cards */
  --card-padding: var(--space-6);
  --card-radius: var(--radius-xl);
  --card-border: var(--border-width-thin) solid var(--border-default);

  /* Inputs */
  --input-height: 2.75rem;
  --input-padding-x: var(--space-4);
  --input-radius: var(--radius-md);
  --input-border: var(--border-width-thin) solid var(--border-default);

  /* Logo */
  --logo-brick-ratio: 2.5;
  --logo-brick-radius: var(--radius-sm);
  --logo-brick-color: var(--color-brick-gold);
}

/* =============================================================================
   LIGHT THEME OVERRIDE
   ============================================================================= */

[data-theme="light"],
.light-mode {
  --bg-primary: var(--color-cloud-white);
  --bg-secondary: var(--color-pure-white);
  --bg-tertiary: #F4F4F5;
  --bg-elevated: var(--color-pure-white);

  --text-primary: var(--color-void-black);
  --text-secondary: var(--color-soft-gray);
  --text-tertiary: var(--color-light-gray);
  --text-inverse: var(--color-pure-white);

  --border-default: #E4E4E7;
  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-emphasis: var(--color-emerald-core);

  --accent-primary: var(--color-emerald-bright);
  --accent-secondary: var(--color-solana-purple);

  /* Adjusted shadows for light mode */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1);

  /* Semantic colors for light mode */
  --color-success: var(--color-emerald-bright);
  --color-warning: var(--color-brick-deep);
  --color-error: #DC2626;
  --color-info: var(--color-solana-purple);
}

/* =============================================================================
   BASE STYLES
   ============================================================================= */

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--text-primary);
  background-color: var(--bg-primary);
}

/* =============================================================================
   TYPOGRAPHY UTILITIES
   ============================================================================= */

.font-display { font-family: var(--font-display); }
.font-body { font-family: var(--font-body); }
.font-mono { font-family: var(--font-mono); }

/* Display Headings */
.display-xl {
  font-family: var(--font-display);
  font-size: var(--text-7xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
}

.display-lg {
  font-family: var(--font-display);
  font-size: var(--text-6xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
}

.display-md {
  font-family: var(--font-display);
  font-size: var(--text-5xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
  letter-spacing: var(--tracking-tight);
}

h1, .h1 {
  font-family: var(--font-display);
  font-size: var(--text-4xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
}

h2, .h2 {
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
}

h3, .h3 {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
}

h4, .h4 {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-normal);
}

/* =============================================================================
   COLOR UTILITIES
   ============================================================================= */

/* Text Gradient */
.text-gradient-solana {
  background: var(--gradient-solana);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* =============================================================================
   COMPONENT STYLES
   ============================================================================= */

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: var(--btn-height-md);
  padding: 0 var(--btn-padding-x-md);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  line-height: 1;
  text-decoration: none;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-primary {
  color: var(--color-void-black);
  background: var(--gradient-solana);
}

.btn-primary:hover {
  background: var(--gradient-solana-hover);
  box-shadow: var(--shadow-purple-glow);
  transform: translateY(-1px);
}

.btn-secondary {
  color: var(--text-primary);
  background: transparent;
  border: var(--border-width-thin) solid var(--border-default);
}

.btn-secondary:hover {
  border-color: var(--color-solana-purple);
  background: rgba(153, 69, 255, 0.1);
}

.btn-gold {
  color: var(--color-void-black);
  background: var(--color-brick-gold);
}

.btn-gold:hover {
  background: var(--color-brick-warm);
  box-shadow: var(--shadow-gold-glow);
}

/* Cards */
.card {
  padding: var(--card-padding);
  background: var(--bg-elevated);
  border: var(--card-border);
  border-radius: var(--card-radius);
}

.card-glow {
  box-shadow: var(--shadow-emerald-glow);
}

/* Inputs */
.input {
  width: 100%;
  height: var(--input-height);
  padding: 0 var(--input-padding-x);
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: var(--input-border);
  border-radius: var(--input-radius);
  transition: border-color var(--duration-fast) var(--ease-out),
              box-shadow var(--duration-fast) var(--ease-out);
}

.input:focus {
  outline: none;
  border-color: var(--color-solana-purple);
  box-shadow: 0 0 0 3px rgba(153, 69, 255, 0.2);
}

/* =============================================================================
   LOGO COMPONENT
   ============================================================================= */

.logo-brick {
  display: inline-block;
  width: calc(var(--logo-brick-ratio) * 1em);
  height: 1em;
  background: var(--logo-brick-color);
  border-radius: var(--logo-brick-radius);
}

.logo-brick-gradient {
  background: var(--gradient-solana);
}

.logo-lockup {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
}

.logo-wordmark {
  font-family: var(--font-display);
  font-weight: var(--font-bold);
  letter-spacing: var(--tracking-tight);
}

/* =============================================================================
   BRAND PATTERNS & TEXTURES
   ============================================================================= */

/* Yellow Brick Road Pattern */
.pattern-bricks {
  background-image:
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 58px,
      rgba(245, 158, 11, 0.08) 58px,
      rgba(245, 158, 11, 0.08) 60px
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 28px,
      rgba(245, 158, 11, 0.08) 28px,
      rgba(245, 158, 11, 0.08) 30px
    );
}

/* Glow Effects */
.glow-emerald { box-shadow: var(--shadow-emerald-glow); }
.glow-purple { box-shadow: var(--shadow-purple-glow); }
.glow-gold { box-shadow: var(--shadow-gold-glow); }

/* =============================================================================
   ANIMATIONS
   ============================================================================= */

/* Curtain Reveal Animation */
@keyframes curtain-reveal {
  0% {
    clip-path: inset(0 100% 0 0);
    opacity: 0;
  }
  100% {
    clip-path: inset(0 0 0 0);
    opacity: 1;
  }
}

.animate-curtain-reveal {
  animation: curtain-reveal var(--duration-slow) var(--ease-out) forwards;
}

/* Fade In Up */
@keyframes fade-in-up {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up var(--duration-normal) var(--ease-out) forwards;
}

/* Pulse Glow */
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: var(--shadow-emerald-glow);
  }
  50% {
    box-shadow: 0 0 60px rgba(20, 241, 149, 0.25);
  }
}

.animate-pulse-glow {
  animation: pulse-glow 2s var(--ease-in-out) infinite;
}

/* Stagger Delays */
.stagger-1 { animation-delay: 100ms; }
.stagger-2 { animation-delay: 200ms; }
.stagger-3 { animation-delay: 300ms; }
.stagger-4 { animation-delay: 400ms; }
.stagger-5 { animation-delay: 500ms; }

/* =============================================================================
   RESPONSIVE TYPOGRAPHY
   ============================================================================= */

@media (max-width: 768px) {
  .display-xl { font-size: var(--text-5xl); }
  .display-lg { font-size: var(--text-4xl); }
  .display-md { font-size: var(--text-3xl); }
  h1, .h1 { font-size: var(--text-3xl); }
  h2, .h2 { font-size: var(--text-2xl); }
  h3, .h3 { font-size: var(--text-xl); }
}

@media (max-width: 480px) {
  .display-xl { font-size: var(--text-4xl); }
  .display-lg { font-size: var(--text-3xl); }
  .display-md { font-size: var(--text-2xl); }
  h1, .h1 { font-size: var(--text-2xl); }
  h2, .h2 { font-size: var(--text-xl); }
}

/* =============================================================================
   ACCESSIBILITY
   ============================================================================= */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Application Examples

### Hero Section Example

```html
<section class="bg-primary pattern-bricks">
  <div class="container">
    <div class="logo-lockup">
      <span class="logo-brick"></span>
      <span class="logo-wordmark text-2xl">ozskr.ai</span>
    </div>

    <h1 class="display-xl text-gradient-solana animate-fade-in-up">
      Pay no mind to the 'agents'<br>
      behind the emerald curtain.
    </h1>

    <p class="text-lg text-secondary animate-fade-in-up stagger-1">
      Create AI-powered digital influencers.
      Built on Solana. Powered by imagination.
    </p>

    <div class="button-group animate-fade-in-up stagger-2">
      <button class="btn btn-primary btn-lg">
        Follow the Road
      </button>
      <button class="btn btn-secondary btn-lg">
        See the Magic
      </button>
    </div>
  </div>
</section>
```

### Card Component Example

```html
<div class="card card-glow">
  <div class="card-header">
    <span class="logo-brick logo-brick-gradient" style="font-size: 24px;"></span>
    <h3 class="h4">AI Character</h3>
  </div>
  <div class="card-body">
    <p class="text-secondary">
      Your AI influencer is ready to create magic.
    </p>
  </div>
  <div class="card-footer">
    <button class="btn btn-gold">
      Create Content
    </button>
  </div>
</div>
```

---

## 10. Do's and Don'ts

### Do's

| Category | Guideline |
|----------|-----------|
| **Color** | Use the Solana gradient for primary CTAs |
| **Color** | Apply emerald glow effects sparingly for emphasis |
| **Color** | Maintain high contrast for accessibility |
| **Typography** | Use Satoshi for headlines, Inter for body |
| **Typography** | Keep headlines tight (-0.02em tracking) |
| **Messaging** | Reference Wizard of Oz themes naturally |
| **Messaging** | Be transparent about AI capabilities |
| **Logo** | Maintain clear space around the yellow brick |
| **Animation** | Use ease-out for natural deceleration |
| **Patterns** | Apply brick pattern subtly on backgrounds |

### Don'ts

| Category | Avoid |
|----------|-------|
| **Color** | Don't use pure black (#000000) -- use Void Black (#0A0A0B) |
| **Color** | Don't overuse gradients -- reserve for key elements |
| **Color** | Don't mix competing accent colors in close proximity |
| **Typography** | Don't use ALL CAPS for body text |
| **Typography** | Don't exceed 75 characters per line |
| **Messaging** | Don't overuse Wizard of Oz references (max 1-2 per session) |
| **Messaging** | Don't hide AI involvement -- embrace transparency |
| **Logo** | Don't stretch or distort the brick proportions |
| **Logo** | Don't place logo on busy backgrounds without contrast |
| **Animation** | Don't animate everything -- be purposeful |

### Accessibility Guidelines

- Maintain WCAG 2.1 AA contrast ratios (4.5:1 for text)
- Provide focus states for all interactive elements
- Support reduced-motion preferences (see CSS above)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 4, 2026 | Claude (AI) | Initial brand style guide |

---

*"You've always had the power, my dear. You just had to learn it for yourself."*
-- Glinda the Good Witch

---

**ozskr.ai** -- Follow the yellow brick road to your digital future.
