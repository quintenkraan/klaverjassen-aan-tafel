import { describe, expect, it } from 'vitest';
import { chance, createRng, shuffle } from './rng';

describe('rng', () => {
  it('is reproduceerbaar met dezelfde seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('geeft waarden in [0, 1)', () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('shuffle behoudt alle elementen', () => {
    const input = Array.from({ length: 32 }, (_, i) => i);
    const out = shuffle(input, createRng(7));
    expect([...out].sort((x, y) => x - y)).toEqual(input);
    expect(out).not.toEqual(input);
  });

  it('chance respecteert grenzen', () => {
    const r = createRng(3);
    expect(chance(0, r)).toBe(false);
    expect(chance(1, r)).toBe(true);
  });
});
