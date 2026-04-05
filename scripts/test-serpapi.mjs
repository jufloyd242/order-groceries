import { readFileSync } from 'fs';

const lines = readFileSync('.env.local', 'utf8').split('\n');
const keyLine = lines.find(l => l.startsWith('SERPAPI_API_KEY='));
const key = keyLine.split('=').slice(1).join('=').trim();

async function test(label, params) {
  const url = 'https://serpapi.com/search.json?' + params;
  const r = await fetch(url);
  const d = await r.json();
  if (d.error) {
    console.log(label, '❌ error:', d.error);
    return;
  }
  const count = (d.organic_results ?? []).length;
  const symbol = count > 0 ? '✅' : '⚠️';
  console.log(label, symbol, 'organic_results:', count);
  if (count > 0) {
    const first = d.organic_results[0];
    console.log('  first title:', first.title);
    console.log('  first price:', JSON.stringify(first.price));
    console.log('  first asin:', first.asin);
  } else {
    console.log('  top-level keys:', Object.keys(d).join(', '));
    // Check if results are under a different key
    if (d.search_results) console.log('  search_results count:', d.search_results.length);
    if (d.results) console.log('  results count:', d.results.length);
  }
}

const withType = new URLSearchParams({ engine: 'amazon', type: 'search', amazon_domain: 'amazon.com', k: 'milk', api_key: key, zip_code: '80516' });
const withoutType = new URLSearchParams({ engine: 'amazon', amazon_domain: 'amazon.com', k: 'milk', api_key: key, zip_code: '80516' });

await test('WITH type=search:', withType);
await test('WITHOUT type:', withoutType);
