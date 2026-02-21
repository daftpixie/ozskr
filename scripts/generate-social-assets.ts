/**
 * Generate Social Media Assets
 * Creates profile pictures and banners for X/Twitter and other platforms.
 * Outputs to public/social/ — run once, commit the PNGs.
 *
 * Usage: npx tsx scripts/generate-social-assets.ts
 */

import satori from 'satori';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUT_DIR = join(process.cwd(), 'public', 'social');
const FONT_DIR = join(process.cwd(), 'public', 'fonts');
mkdirSync(OUT_DIR, { recursive: true });

const VOID_BLACK = '#0A0A0B';
const BRICK_GOLD = '#F59E0B';

async function loadFont(weight: number): Promise<Buffer> {
  const cached = join(FONT_DIR, `Inter-${weight}.ttf`);
  if (existsSync(cached)) {
    return readFileSync(cached);
  }
  console.log(`  Downloading Inter weight ${weight}...`);
  const cssRes = await fetch(
    `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`,
    { headers: { 'User-Agent': 'node' } }
  );
  if (!cssRes.ok) throw new Error(`Font CSS fetch failed: ${cssRes.status}`);
  const css = await cssRes.text();
  const urlMatch = css.match(/url\(([^)]+\.(?:ttf|otf))\)/);
  if (!urlMatch) throw new Error(`No TTF URL found for weight ${weight}`);
  const fontRes = await fetch(urlMatch[1]);
  if (!fontRes.ok) throw new Error(`Font download failed: ${fontRes.status}`);
  const buf = Buffer.from(await fontRes.arrayBuffer());
  writeFileSync(cached, buf);
  return buf;
}

async function render(
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
      { name: 'Inter', data: fonts.regular, weight: 400, style: 'normal' as const },
      { name: 'Inter', data: fonts.bold, weight: 700, style: 'normal' as const },
    ],
  });

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const outPath = join(OUT_DIR, filename);
  writeFileSync(outPath, png);
  console.log(`  ${filename} (${width}x${height})`);
}

// ─── X/Twitter Profile Picture (400x400) ─────────────────────────────
// Minimalistic: centered golden brick on void black, subtle gradient
function xProfilePic() {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: 400,
        height: 400,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        backgroundColor: VOID_BLACK,
        backgroundImage:
          'linear-gradient(135deg, rgba(153,69,255,0.12) 0%, rgba(20,241,149,0.12) 100%)',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              width: 160,
              height: 64,
              backgroundColor: BRICK_GOLD,
              borderRadius: 14,
            },
          },
        },
      ],
    },
  };
}

// ─── X/Twitter Banner (1500x500) ─────────────────────────────────────
function xBanner() {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: 1500,
        height: 500,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        backgroundColor: VOID_BLACK,
        backgroundImage:
          'linear-gradient(135deg, rgba(153,69,255,0.15) 0%, rgba(20,241,149,0.15) 100%)',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column' as const,
              alignItems: 'center' as const,
              gap: 20,
            },
            children: [
              // Brick
              {
                type: 'div',
                props: {
                  style: {
                    width: 80,
                    height: 32,
                    backgroundColor: BRICK_GOLD,
                    borderRadius: 8,
                  },
                },
              },
              // Wordmark
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: 48,
                    fontWeight: 700,
                    color: '#FFFFFF',
                    letterSpacing: '-0.02em',
                  },
                  children: 'ozskr.ai',
                },
              },
              // Tagline
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: 20,
                    fontWeight: 400,
                    color: '#A1A1AA',
                  },
                  children: 'Your AI agents. Your rules. On-chain.',
                },
              },
            ],
          },
        },
      ],
    },
  };
}

async function main() {
  console.log('Generating social media assets...');

  const [bold, regular] = await Promise.all([loadFont(700), loadFont(400)]);
  const fonts = { bold, regular };

  await render(xProfilePic() as Record<string, unknown>, 400, 400, 'x-profile.png', fonts);
  await render(xBanner() as Record<string, unknown>, 1500, 500, 'x-banner.png', fonts);

  console.log('\nDone! Assets saved to public/social/');
}

main().catch((err) => {
  console.error('Failed to generate social assets:', err);
  process.exit(1);
});
