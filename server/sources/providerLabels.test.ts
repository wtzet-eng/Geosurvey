import assert from 'node:assert/strict'; import test from 'node:test'; import { environmentalEvidenceSource } from './providerLabels';
test('UK environmental labels never leak Polish GDOŚ authority',()=>{const label=environmentalEvidenceSource('GB');assert.match(label,/JNCC/);assert.doesNotMatch(label,/GDOŚ|General Directorate for Environmental Protection/);});
