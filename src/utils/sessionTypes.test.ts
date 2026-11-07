import test from 'node:test';
import assert from 'node:assert/strict';
import { VIBE_CONFIGS, VibeType } from './sessionTypes';

test('all required vibe configurations exist with valid colors and names', () => {
  const expectedVibes: VibeType[] = [
    'cyberpunk',
    'romantic',
    'midnight',
    'neon_sunset',
    'emerald_matrix',
  ];

  for (const v of expectedVibes) {
    const config = VIBE_CONFIGS[v];
    assert.ok(config, `Vibe ${v} must exist`);
    assert.ok(config.name.length > 0);
    assert.ok(config.primaryGlow.startsWith('#'));
    assert.ok(config.secondaryGlow.startsWith('#'));
    assert.equal(config.orbGradient.length, 3);
  }
});
