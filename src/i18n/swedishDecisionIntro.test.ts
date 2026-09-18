import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Swedish report uses the decision-first introduction instead of the legacy hardcoded heading', () => {
  const source = readFileSync(new URL('../components/ReportViewSwedish.tsx', import.meta.url), 'utf8');
  assert.match(source, /decisionIntroCopy\('sv'\)/);
  assert.match(source, /buyerSummary\(/);
  assert.match(source, /plainSummary/);
  assert.doesNotMatch(source, />Preliminär tomtbedömning<\/h1>/);
});
