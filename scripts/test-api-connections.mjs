/**
 * API Connection Diagnostic Script
 * Tests connectivity and latency for all external AI providers.
 * Run: node --env-file=.env.local scripts/test-api-connections.mjs
 */

const TIMEOUT_MS = 15_000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function testAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: 'ANTHROPIC_API_KEY not set' };

  const start = Date.now();
  try {
    const res = await withTimeout(
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 16,
          messages: [{ role: 'user', content: 'Reply with just: ok' }],
        }),
      }),
      TIMEOUT_MS,
      'Anthropic'
    );

    const latency = Date.now() - start;
    const body = await res.json();

    if (!res.ok) {
      return { ok: false, latency, error: `HTTP ${res.status}: ${JSON.stringify(body)}` };
    }

    const text = body?.content?.[0]?.text ?? '(no text)';
    return { ok: true, latency, model: body.model, response: text.trim() };
  } catch (err) {
    return { ok: false, latency: Date.now() - start, error: err.message };
  }
}

async function testOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, error: 'OPENAI_API_KEY not set' };

  const start = Date.now();
  try {
    const res = await withTimeout(
      fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'omni-moderation-latest',
          input: 'Hello world test message',
        }),
      }),
      TIMEOUT_MS,
      'OpenAI'
    );

    const latency = Date.now() - start;
    const body = await res.json();

    if (!res.ok) {
      return { ok: false, latency, error: `HTTP ${res.status}: ${JSON.stringify(body)}` };
    }

    const flagged = body?.results?.[0]?.flagged ?? null;
    return { ok: true, latency, flagged };
  } catch (err) {
    return { ok: false, latency: Date.now() - start, error: err.message };
  }
}

async function testLangfuse() {
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const baseUrl = process.env.LANGFUSE_BASEURL ?? 'https://cloud.langfuse.com';

  if (!secretKey || !publicKey) {
    return { ok: false, error: 'LANGFUSE_SECRET_KEY or LANGFUSE_PUBLIC_KEY not set' };
  }

  const start = Date.now();
  try {
    // Hit the health/auth endpoint
    const credentials = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
    const res = await withTimeout(
      fetch(`${baseUrl}/api/public/health`, {
        headers: { Authorization: `Basic ${credentials}` },
      }),
      TIMEOUT_MS,
      'Langfuse'
    );

    const latency = Date.now() - start;
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, latency, error: `HTTP ${res.status}: ${JSON.stringify(body)}` };
    }

    return { ok: true, latency, status: body.status ?? 'healthy' };
  } catch (err) {
    return { ok: false, latency: Date.now() - start, error: err.message };
  }
}

async function testFal() {
  const key = process.env.FAL_KEY;
  if (!key) return { ok: false, error: 'FAL_KEY not set' };

  const start = Date.now();
  try {
    // Hit the fal.ai REST API — queue an extremely simple request and cancel it
    // Just check auth works with a lightweight models list call
    const res = await withTimeout(
      fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: {
          Authorization: `Key ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'test', num_inference_steps: 1, num_images: 1 }),
      }),
      TIMEOUT_MS,
      'fal.ai'
    );

    const latency = Date.now() - start;
    const body = await res.json().catch(() => ({}));

    // 200 = worked, 401/403 = bad key, 422 = validation error (still means connected)
    if (res.status === 401 || res.status === 403) {
      return { ok: false, latency, error: `Auth failed HTTP ${res.status}: ${JSON.stringify(body)}` };
    }

    return { ok: true, latency, status: res.status, note: res.ok ? 'connected + responded' : `HTTP ${res.status} (connected, check params)` };
  } catch (err) {
    return { ok: false, latency: Date.now() - start, error: err.message };
  }
}

// ── Run all tests ──────────────────────────────────────────────────────────────

console.log('Testing API connections (15s timeout each)...\n');

const [anthropic, openai, langfuse, fal] = await Promise.all([
  testAnthropic(),
  testOpenAI(),
  testLangfuse(),
  testFal(),
]);

const pad = (s, n = 10) => s.padEnd(n);
const status = (r) => r.ok ? '✅ OK' : '❌ FAIL';
const ms = (r) => r.latency != null ? `${r.latency}ms` : 'N/A';

console.log(`┌─────────────────────────────────────────────────────┐`);
console.log(`│ Provider     Status   Latency  Details              │`);
console.log(`├─────────────────────────────────────────────────────┤`);
console.log(`│ Anthropic    ${pad(status(anthropic), 8)} ${pad(ms(anthropic), 8)} ${pad(anthropic.error ?? anthropic.response ?? anthropic.model ?? '', 20)} │`);
console.log(`│ OpenAI       ${pad(status(openai), 8)} ${pad(ms(openai), 8)} ${pad(openai.error ?? `flagged=${openai.flagged}`, 20)} │`);
console.log(`│ Langfuse     ${pad(status(langfuse), 8)} ${pad(ms(langfuse), 8)} ${pad(langfuse.error ?? langfuse.status ?? '', 20)} │`);
console.log(`│ fal.ai       ${pad(status(fal), 8)} ${pad(ms(fal), 8)} ${pad(fal.error ?? fal.note ?? '', 20)} │`);
console.log(`└─────────────────────────────────────────────────────┘`);

if (!anthropic.ok) {
  console.log(`\n⚠️  Anthropic: ${anthropic.error}`);
  console.log(`   → Check ANTHROPIC_API_KEY and model 'claude-sonnet-4-6' is accessible on your account.`);
}
if (!openai.ok) {
  console.log(`\n⚠️  OpenAI: ${openai.error}`);
  console.log(`   → Check OPENAI_API_KEY. Moderation stage will fail without this.`);
}
if (!langfuse.ok) {
  console.log(`\n⚠️  Langfuse: ${langfuse.error}`);
  console.log(`   → Langfuse flush was blocking the pipeline. Check LANGFUSE_PUBLIC_KEY/SECRET_KEY.`);
  console.log(`   → NOTE: Langfuse flush is now fire-and-forget so this won't block generation.`);
}
if (!fal.ok) {
  console.log(`\n⚠️  fal.ai: ${fal.error}`);
  console.log(`   → Image generation will fail. Text generation is unaffected.`);
}

const allOk = anthropic.ok && openai.ok && langfuse.ok && fal.ok;
console.log(allOk ? '\n✅ All providers reachable.' : '\n⚠️  One or more providers failed — see above.');
