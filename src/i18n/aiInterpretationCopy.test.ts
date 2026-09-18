import test from 'node:test';
import assert from 'node:assert/strict';
import { aiPanelCopy } from '../components/AIInterpretationPanel';

test('Swedish AI interpretation shell is localized', () => {
  const copy = aiPanelCopy('sv');
  const text = Object.values(copy).join('\n');
  assert.match(copy.brand, /AI-tolkning/);
  assert.match(copy.title, /Tolka det insamlade underlaget/);
  assert.match(copy.completed, /Tolkningen är klar/);
  assert.match(copy.verifyNext, /verifieras härnäst/);
  assert.doesNotMatch(text, /Interpret the collected evidence|AI interpretation|Signed in|Interpretation completed|Direct observations|What to verify next/i);
});

[executed on device: toma (e8359509-e325-4515-b2ff-2da47ff811ad)]