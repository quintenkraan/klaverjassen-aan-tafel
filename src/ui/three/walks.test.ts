import { describe, expect, it } from 'vitest';
import { BAR, ROOM, WALL_TABLE_X } from './layout';
import { AISLE_X, DESTINATIONS, routeFor, routeLength, SIDE_STEP } from './walks';

describe('looproutes van cafégasten', () => {
  for (const dest of DESTINATIONS) {
    it(`naar ${dest}: begint naast de stoel, blijft in de zaal, via het gangpad`, () => {
      const route = routeFor(WALL_TABLE_X, -5, dest);
      expect(route[0]).toEqual([WALL_TABLE_X + SIDE_STEP, -5]);
      expect(route[1]).toEqual([AISLE_X, -5]);
      for (const [x, z] of route) {
        expect(x).toBeGreaterThanOrEqual(ROOM.minX);
        expect(x).toBeLessThanOrEqual(ROOM.maxX);
        expect(z).toBeGreaterThanOrEqual(ROOM.minZ);
        expect(z).toBeLessThanOrEqual(ROOM.maxZ);
      }
      expect(routeLength(route)).toBeGreaterThan(3);
    });
  }

  it('het gangpad loopt tussen de tafeltjes en de barkrukken door', () => {
    expect(AISLE_X).toBeGreaterThan(WALL_TABLE_X + 0.6);
    expect(AISLE_X).toBeLessThan(BAR.x - 0.43 - 0.3);
  });
});
