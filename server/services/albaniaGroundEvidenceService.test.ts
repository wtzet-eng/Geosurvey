import assert from 'node:assert/strict';
import testFn from 'node:test';
import { albaniaGroundEvidence } from './albaniaGroundEvidenceService';

testFn('Albania evidence catalogue includes engineering geology and hazards', () => {
  const result = albaniaGroundEvidence();
  assert.equal(result.evidence.some(e => e.id === 'al-asig-engineering-geology'), true);
  assert.equal(result.evidence.some(e => e.id === 'al-asig-geological-hazard'), true);
  assert.equal(result.evidence.some(e => e.id === 'al-asig-flood-risk'), true);
});
