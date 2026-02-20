/**
 * Generate OG Images
 * Uses Satori (via @vercel/og) to render JSX to SVG, then sharp to convert to PNG.
 * Outputs to public/og/ — run once, commit the PNGs.
 *
 * Usage: npx tsx scripts/generate-og-images.ts
 */

import satori from 'satori';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { ReactNode } from 'react';

const OUT_DIR = join(process.cwd(), 'public', 'og');
const FONT_DIR = join(process.cwd(), 'public', 'fonts');
mkdirSync(OUT_DIR, { recursive: true });

// Satori requires TTF/OTF — WOFF2 is not supported.
// Download Inter TTF from Google Fonts API if not cached locally.
async function fetchGoogleFontTTF(weight: number): Promise<Buffer> {
  const cached = join(FONT_DIR, `Inter-${weight}.ttf`);
  if (existsSync(cached)) {
    return readFileSync(cached);
  }
  console.log(`  Downloading Inter weight ${weight} from Google Fonts...`);
  // Omit browser user-agent so Google returns TTF (not WOFF2)
  const cssRes = await fetch(
    `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`,
    { headers: { 'User-Agent': 'node' } }
  );
  if (!cssRes.ok) throw new Error(`Font CSS fetch failed: ${cssRes.status}`);
  const css = await cssRes.text();
  const urlMatch = css.match(/url\(([^)]+\.(?:ttf|otf))\)/);
  if (!urlMatch) throw new Error(`No TTF URL found in Google Fonts CSS for weight ${weight}`);
  const fontRes = await fetch(urlMatch[1]);
  if (!fontRes.ok) throw new Error(`Font download failed: ${fontRes.status}`);
  const buf = Buffer.from(await fontRes.arrayBuffer());
  writeFileSync(cached, buf);
  return buf;
}

// Brand colors
const VOID_BLACK = '#0A0A0B';
const SOLANA_PURPLE = '#9945FF';
const SOLANA_GREEN = '#14F195';
const BRICK_GOLD = '#F59E0B';
const PURE_WHITE = '#FFFFFF';
const LIGHT_GRAY = '#A1A1AA';

// Shared logo component
function Logo({ size = 'large' }: { size?: 'large' | 'small' }) {
  const brickW = size === 'large' ? 40 : 28;
  const brickH = size === 'large' ? 16 : 11;
  const fontSize = size === 'large' ? 32 : 22;

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: size === 'large' ? 12 : 8,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              width: brickW,
              height: brickH,
              backgroundColor: BRICK_GOLD,
              borderRadius: 4,
            },
          },
        },
        {
          type: 'span',
          props: {
            style: {
              fontSize,
              fontWeight: 700,
              color: PURE_WHITE,
            },
            children: 'ozskr.ai',
          },
        },
      ],
    },
  };
}

// Shared hashtag
function Hashtag({ size = 20 }: { size?: number }) {
  return {
    type: 'span',
    props: {
      style: {
        fontSize: size,
        fontWeight: 600,
        color: BRICK_GOLD,
      },
      children: '#mindthehive',
    },
  };
}

// Background wrapper with gradient and border
function OGWrapper({
  children,
  width,
  height,
}: {
  children: ReactNode;
  width: number;
  height: number;
}) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width,
        height,
        position: 'relative' as const,
      },
      children: [
        // Background
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column' as const,
              width,
              height,
              padding: 60,
              backgroundColor: VOID_BLACK,
              backgroundImage: `linear-gradient(135deg, rgba(153,69,255,0.15) 0%, rgba(20,241,149,0.15) 100%)`,
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
            },
            children,
          },
        },
      ],
    },
  };
}

async function renderImage(
  element: Record<string, unknown>,
  width: number,
  height: number,
  filename: string,
  fonts: { bold: Buffer; regular: Buffer }
) {
  const svg = await satori(element as React.ReactNode, {
    width,
    height,
    fonts: [
      {
        name: 'Inter',
        data: fonts.regular,
        weight: 400,
        style: 'normal' as const,
      },
      {
        name: 'Inter',
        data: fonts.bold,
        weight: 700,
        style: 'normal' as const,
      },
    ],
  });

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const outPath = join(OUT_DIR, filename);
  writeFileSync(outPath, png);
  console.log(`  ${filename} (${width}x${height})`);
}

// ─── Image Definitions ────────────────────────────────────────────────

function ogDefault() {
  return OGWrapper({
    width: 1200,
    height: 630,
    children: [
      // Logo top-left
      Logo({ size: 'large' }),
      // Spacer
      { type: 'div', props: { style: { flex: 1 } } },
      // Headline
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 8,
          },
          children: [
            {
              type: 'div',
              props: {
                style: { fontSize: 64, fontWeight: 700, color: PURE_WHITE, lineHeight: 1.1 },
                children: 'Your AI agents.',
              },
            },
            {
              type: 'div',
              props: {
                style: { fontSize: 64, fontWeight: 700, color: PURE_WHITE, lineHeight: 1.1 },
                children: 'Your rules.',
              },
            },
            {
              type: 'div',
              props: {
                style: { fontSize: 64, fontWeight: 700, color: PURE_WHITE, lineHeight: 1.1 },
                children: 'On-chain.',
              },
            },
          ],
        },
      },
      // Spacer
      { type: 'div', props: { style: { height: 16 } } },
      // Subline + hashtag row
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            justifyContent: 'space-between' as const,
            alignItems: 'flex-end' as const,
          },
          children: [
            {
              type: 'span',
              props: {
                style: { fontSize: 28, color: LIGHT_GRAY },
                children: 'Built on Solana. Powered by AI.',
              },
            },
            Hashtag({ size: 22 }),
          ],
        },
      },
    ],
  });
}

function ogBlog() {
  return OGWrapper({
    width: 1200,
    height: 630,
    children: [
      Logo({ size: 'large' }),
      { type: 'div', props: { style: { flex: 1 } } },
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 16,
          },
          children: [
            {
              type: 'div',
              props: {
                style: { fontSize: 56, fontWeight: 700, color: SOLANA_GREEN },
                children: 'Blog',
              },
            },
            {
              type: 'div',
              props: {
                style: { fontSize: 28, color: LIGHT_GRAY, lineHeight: 1.4 },
                children: 'Dispatches from the Emerald City',
              },
            },
          ],
        },
      },
      { type: 'div', props: { style: { flex: 1 } } },
      {
        type: 'div',
        props: {
          style: { display: 'flex', justifyContent: 'flex-end' as const },
          children: [Hashtag({ size: 22 })],
        },
      },
    ],
  });
}

function ogLivepaper() {
  return OGWrapper({
    width: 1200,
    height: 630,
    children: [
      Logo({ size: 'large' }),
      { type: 'div', props: { style: { flex: 1 } } },
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 12,
          },
          children: [
            {
              type: 'div',
              props: {
                style: { fontSize: 48, fontWeight: 700, color: PURE_WHITE, lineHeight: 1.1 },
                children: 'The ozskr.ai',
              },
            },
            {
              type: 'div',
              props: {
                style: { fontSize: 56, fontWeight: 700, color: BRICK_GOLD, lineHeight: 1.1 },
                children: 'Livepaper',
              },
            },
            { type: 'div', props: { style: { height: 8 } } },
            {
              type: 'div',
              props: {
                style: { fontSize: 24, color: LIGHT_GRAY },
                children: 'Architecture, principles, and on-chain proof',
              },
            },
          ],
        },
      },
      { type: 'div', props: { style: { flex: 1 } } },
      {
        type: 'div',
        props: {
          style: { display: 'flex', justifyContent: 'flex-end' as const },
          children: [Hashtag({ size: 22 })],
        },
      },
    ],
  });
}

function ogSquare() {
  return OGWrapper({
    width: 600,
    height: 600,
    children: [
      { type: 'div', props: { style: { flex: 1 } } },
      // Centered logo
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'center' as const,
            gap: 8,
          },
          children: [
            {
              type: 'div',
              props: {
                style: {
                  width: 48,
                  height: 19,
                  backgroundColor: BRICK_GOLD,
                  borderRadius: 4,
                },
              },
            },
            {
              type: 'span',
              props: {
                style: { fontSize: 28, fontWeight: 700, color: PURE_WHITE },
                children: 'ozskr.ai',
              },
            },
          ],
        },
      },
      { type: 'div', props: { style: { height: 24 } } },
      // Headline centered
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'center' as const,
            gap: 4,
          },
          children: [
            {
              type: 'div',
              props: {
                style: { fontSize: 36, fontWeight: 700, color: PURE_WHITE },
                children: 'Your AI agents.',
              },
            },
            {
              type: 'div',
              props: {
                style: { fontSize: 36, fontWeight: 700, color: PURE_WHITE },
                children: 'Your rules.',
              },
            },
            {
              type: 'div',
              props: {
                style: { fontSize: 36, fontWeight: 700, color: PURE_WHITE },
                children: 'On-chain.',
              },
            },
          ],
        },
      },
      { type: 'div', props: { style: { flex: 1 } } },
      // Hashtag bottom-right
      {
        type: 'div',
        props: {
          style: { display: 'flex', justifyContent: 'flex-end' as const },
          children: [Hashtag({ size: 18 })],
        },
      },
    ],
  });
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('Generating OG images...');

  const [bold, regular] = await Promise.all([
    fetchGoogleFontTTF(700),
    fetchGoogleFontTTF(400),
  ]);
  const fonts = { bold, regular };

  await renderImage(ogDefault() as Record<string, unknown>, 1200, 630, 'og-default.png', fonts);
  await renderImage(ogBlog() as Record<string, unknown>, 1200, 630, 'og-blog.png', fonts);
  await renderImage(ogLivepaper() as Record<string, unknown>, 1200, 630, 'og-livepaper.png', fonts);
  await renderImage(ogSquare() as Record<string, unknown>, 600, 600, 'og-square.png', fonts);

  console.log('\nDone! Images saved to public/og/');
}

main().catch((err) => {
  console.error('Failed to generate OG images:', err);
  process.exit(1);
});
