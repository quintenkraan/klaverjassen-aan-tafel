import { describe, expect, it } from 'vitest';
import { createRng } from '../engine';
import { JOIN_ORDER, joinLink, makeCode, namesFor, normalizeCode, peerIdFor } from './protocol';

describe('online: codes en links', () => {
  it('codes zijn kort, leesbaar en reproduceerbaar met een seed', () => {
    const code = makeCode(createRng(1));
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    expect(makeCode(createRng(1))).toBe(code);
  });

  it('ingetypte codes worden opgeschoond', () => {
    expect(normalizeCode(' ab-c d7 ')).toBe('ABCD7');
  });

  it('link en peer-id', () => {
    expect(joinLink('ABCDE', { origin: 'https://x.github.io', pathname: '/klaverjas/' })).toBe(
      'https://x.github.io/klaverjas/?tafel=ABCDE',
    );
    expect(peerIdFor('ABCDE')).toBe('klaverjassen-aan-tafel-abcde');
  });

  it('eerste gast wordt je maat, daarna links en rechts', () => {
    expect(JOIN_ORDER).toEqual([2, 1, 3]);
  });

  it('namen draaien mee zodat jij op 0 zit', () => {
    const seats = ['Host', 'Links', 'Maat', null];
    expect(namesFor(seats, 0)).toEqual(['Host', 'Links', 'Maat', null]);
    expect(namesFor(seats, 2)).toEqual(['Maat', null, 'Host', 'Links']);
  });
});
