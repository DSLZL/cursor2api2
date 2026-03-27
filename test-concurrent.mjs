import { createRequire } from 'module';

const BASE = 'http://127.0.0.1:3010';

const REQUESTS = [
  {
    id: 'A',
    system: 'You are a chef. Always respond in the context of cooking.',
    user: 'What is the best way to boil water?'
  },
  {
    id: 'B',
    system: 'You are a historian specializing in ancient Rome.',
    user: 'Tell me about Julius Caesar in one sentence.'
  },
  {
    id: 'C',
    system: 'You are a pirate. Speak like a pirate always.',
    user: 'What is 2 + 2?'
  },
  {
    id: 'D',
    system: 'You are a Zen Buddhist monk. Answer with koans.',
    user: 'What is the meaning of life?'
  },
  {
    id: 'E',
    system: 'You are a sports commentator covering football.',
    user: 'Describe a beautiful sunny day.'
  }
];

async function sendRequest(ctx) {
  const start = Date.now();
  try {
    const body = {
      model: 'claude-sonnet-4-5',
      max_tokens: 200,
      stream: false,
      system: ctx.system,
      messages: [{ role: 'user', content: ctx.user }]
    };
    const resp = await fetch(`${BASE}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    const elapsed = Date.now() - start;
    const text = data.content?.[0]?.text ?? JSON.stringify(data).slice(0, 300);
    return { id: ctx.id, status: resp.status, elapsed, text, system: ctx.system, user: ctx.user };
  } catch (e) {
    return { id: ctx.id, status: 'ERROR', elapsed: Date.now() - start, text: e.message };
  }
}

console.log('发送 5 个并发请求...\n');
const t0 = Date.now();
const results = await Promise.all(REQUESTS.map(sendRequest));
console.log(`全部完成，总耗时 ${Date.now() - t0}ms\n`);
console.log('='.repeat(70));
for (const r of results) {
  console.log(`\n[请求 ${r.id}] HTTP ${r.status} | ${r.elapsed}ms`);
  console.log(`  系统角色: ${r.system}`);
  console.log(`  用户问题: ${r.user}`);
  console.log(`  模型回复: ${r.text}`);
  console.log('-'.repeat(70));
}
