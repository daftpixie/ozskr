/**
 * Generate Brand Favicon
 * Creates icon.png (32x32) and apple-icon.png (180x180) for Next.js App Router.
 * The logo mark is the golden brick on void black with a subtle gradient.
 *
 * Usage: npx tsx scripts/generate-favicon.ts
 */

import satori from 'satori';
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const APP_DIR = join(process.cwd(), 'src', 'app');
const FONT_DIR = join(process.cwd(), 'public', 'fonts');

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

function brickIcon(size: number) {
  // Scale the brick proportionally to the icon size
  const brickW = Math.round(size * 0.5);
  const brickH = Math.round(size * 0.2);
  const borderRadius = Math.max(2, Math.round(size * 0.08));

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: size,
        height: size,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        backgroundColor: VOID_BLACK,
        backgroundImage:
          'linear-gradient(135deg, rgba(153,69,255,0.2) 0%, rgba(20,241,149,0.2) 100%)',
        borderRadius: Math.round(size * 0.15),
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              width: brickW,
              height: brickH,
              backgroundColor: BRICK_GOLD,
              borderRadius,
              boxShadow: '0 0 8px rgba(245,158,11,0.4)',
            },
          },
        },
      ],
    },
  };
}

async function renderIcon(
  element: Record<string, unknown>,
  size: number,
  filename: string,
  font: Buffer
) {
  const svg = await satori(element as React.ReactNode, {
    width: size,
    height: size,
    fonts: [
      {
        name: 'Inter',
        data: font,
        weight: 700,
        style: 'normal' as const,
      },
    ],
  });

  const png = await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toBuffer();

  const outPath = join(APP_DIR, filename);
  writeFileSync(outPath, png);
  console.log(`  ${filename} (${size}x${size})`);
}

async function main() {
  console.log('Generating favicons...');

  const font = await loadFont(700);

  // Standard favicon (32x32) — used by browsers
  await renderIcon(
    brickIcon(32) as Record<string, unknown>,
    32,
    'icon.png',
    font
  );

  // Apple touch icon (180x180) — used by iOS home screen
  await renderIcon(
    brickIcon(180) as Record<string, unknown>,
    180,
    'apple-icon.png',
    font
  );

  console.log('\nDone! Icons saved to src/app/');
}

main().catch((err) => {
  console.error('Failed to generate favicons:', err);
  process.exit(1);
});
