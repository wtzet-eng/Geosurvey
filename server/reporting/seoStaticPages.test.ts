import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const newCountryGuides = ['czechia', 'denmark', 'france', 'slovakia'];

test('country SEO guides are crawlable, canonical and linked from the building-plot page', () => {
  const hub = read('public/building-plot-check/index.html');
  const sitemap = read('public/sitemap.xml');

  for (const slug of newCountryGuides) {
    const html = read(`public/${slug}/index.html`);
    assert.match(html, /<meta name="robots" content="index,follow">/);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://surveyland\\.ai\\.studio/${slug}/">`));
    assert.match(html, /<h1>[^<]+<\/h1>/);
    assert.match(html, /application\/ld\+json/);
    assert.match(hub, new RegExp(`href="/${slug}/"`));
    assert.match(sitemap, new RegExp(`<loc>https://surveyland\\.ai\\.studio/${slug}/</loc>`));
  }
});

test('SEO copy keeps land valuation scoped away from buildings and avoids unsupported Dutch country claims', () => {
  const france = read('public/france/index.html');
  const denmark = read('public/denmark/index.html');
  const hub = read('public/building-plot-check/index.html');

  assert.match(france, /excludes buildings and other improvements/i);
  assert.match(denmark, /Buildings and other improvements are excluded/i);
  assert.doesNotMatch(hub, /href="\/netherlands\/"/i);
});
