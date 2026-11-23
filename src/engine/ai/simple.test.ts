import { describe, expect, it } from 'vitest';
import { createGame, DEFAULT_RULES } from '../game';
import { createRng } from '../rng';
import type { Rules } from '../types';
import { simpleBotStep } from './simple';

describe('simpleBotStep', () => {
  for (const trumpMode of ['verplicht', 'vrij', 'utrechts'] as const) {
    it(`speelt een heel spel uit (${trumpMode})`, () => {
      const R: Rules = { ...DEFAULT_RULES, trumpMode };
      const rng = createRng(11);
      let r = createGame(R, 3).round;
      let steps = 0;
      while (r.phase !== 'klaar' && steps++ < 100) r = simpleBotStep(r, R, rng);
      expect(r.phase).toBe('klaar');
      expect(r.tricks).toHaveLength(8);
    });
  }
});
