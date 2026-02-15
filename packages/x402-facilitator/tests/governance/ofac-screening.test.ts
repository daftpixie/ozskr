import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createOfacScreener, type OfacScreener } from '../../src/governance/ofac-screening.js';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('OfacScreener', () => {
  let testDir: string;
  let blocklistPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ofac-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    blocklistPath = join(testDir, 'blocklist.json');
  });

  afterEach(async () => {
    try { await unlink(blocklistPath); } catch { /* ignore */ }
  });

  it('passes clean address', async () => {
    await writeFile(blocklistPath, JSON.stringify(['SANCTIONED_ADDR']));
    const screener = await createOfacScreener(blocklistPath);
    const result = await screener.screen(['CLEAN_ADDR']);
    expect(result.status).toBe('pass');
  });

  it('fails sanctioned address', async () => {
    await writeFile(blocklistPath, JSON.stringify(['SANCTIONED_ADDR', 'ANOTHER_BAD']));
    const screener = await createOfacScreener(blocklistPath);
    const result = await screener.screen(['CLEAN_ADDR', 'SANCTIONED_ADDR']);
    expect(result.status).toBe('fail');
    expect(result.matchedAddress).toBe('SANCTIONED_ADDR');
    expect(result.matchedList).toBe('SDN');
  });

  it('passes when all addresses are clean', async () => {
    await writeFile(blocklistPath, JSON.stringify(['BAD_ADDR']));
    const screener = await createOfacScreener(blocklistPath);
    const result = await screener.screen(['GOOD_1', 'GOOD_2', 'GOOD_3']);
    expect(result.status).toBe('pass');
    expect(result.screenedAddresses).toHaveLength(3);
  });

  it('passes empty address list', async () => {
    await writeFile(blocklistPath, JSON.stringify(['BAD_ADDR']));
    const screener = await createOfacScreener(blocklistPath);
    const result = await screener.screen([]);
    expect(result.status).toBe('pass');
  });

  it('fail-closed: missing list file throws', async () => {
    await expect(
      createOfacScreener('/nonexistent/blocklist.json', true),
    ).rejects.toThrow('OFAC fail-closed');
  });

  it('fail-open: missing list file creates screener, returns skip', async () => {
    const screener = await createOfacScreener('/nonexistent/blocklist.json', false);
    const result = await screener.screen(['SOME_ADDR']);
    expect(result.status).toBe('skip');
    expect(result.errorDetail).toContain('not loaded');
  });

  it('fail-closed: no list loaded returns error', async () => {
    const screener = await createOfacScreener(undefined, true);
    const result = await screener.screen(['SOME_ADDR']);
    expect(result.status).toBe('error');
  });

  it('updateList refreshes the blocklist', async () => {
    await writeFile(blocklistPath, JSON.stringify(['OLD_ADDR']));
    const screener = await createOfacScreener(blocklistPath);

    // Initially passes NEW_ADDR
    let result = await screener.screen(['NEW_ADDR']);
    expect(result.status).toBe('pass');

    // Update list to include NEW_ADDR
    await writeFile(blocklistPath, JSON.stringify(['OLD_ADDR', 'NEW_ADDR']));
    await screener.updateList(blocklistPath);

    result = await screener.screen(['NEW_ADDR']);
    expect(result.status).toBe('fail');
    expect(result.matchedAddress).toBe('NEW_ADDR');
  });

  it('tracks lastUpdated and listSize', async () => {
    await writeFile(blocklistPath, JSON.stringify(['A', 'B', 'C']));
    const screener = await createOfacScreener(blocklistPath);
    expect(screener.lastUpdated()).toBeInstanceOf(Date);
    expect(screener.listSize()).toBe(3);
  });

  describe('ScreeningProvider interface', () => {
    it('screenAddress returns blocked=true for blocked address', async () => {
      await writeFile(blocklistPath, JSON.stringify(['SANCTIONED_ADDR']));
      const screener = await createOfacScreener(blocklistPath);
      const result = await screener.screenAddress('SANCTIONED_ADDR');
      expect(result.blocked).toBe(true);
      expect(result.source).toBe('static-sdn');
      expect(result.matchType).toBe('exact');
      expect(result.reason).toContain('SDN blocklist');
    });

    it('screenAddress returns blocked=false for clean address', async () => {
      await writeFile(blocklistPath, JSON.stringify(['SANCTIONED_ADDR']));
      const screener = await createOfacScreener(blocklistPath);
      const result = await screener.screenAddress('CLEAN_ADDR');
      expect(result.blocked).toBe(false);
      expect(result.source).toBe('static-sdn');
      expect(result.checkedAt).toBeInstanceOf(Date);
    });

    it('providerName returns "static-sdn"', async () => {
      await writeFile(blocklistPath, JSON.stringify(['A']));
      const screener = await createOfacScreener(blocklistPath);
      expect(screener.providerName).toBe('static-sdn');
    });

    it('lastRefreshed returns a Date', async () => {
      await writeFile(blocklistPath, JSON.stringify(['A', 'B']));
      const screener = await createOfacScreener(blocklistPath);
      expect(screener.lastRefreshed).toBeInstanceOf(Date);
      expect(screener.lastRefreshed.getTime()).toBeGreaterThan(Date.now() - 5000);
    });
  });
});
