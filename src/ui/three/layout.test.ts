import { describe, expect, it } from 'vitest';
import { edgeFor, fovFor, seatPose, spotFor, TABLE_RADIUS, TABLE_TOP, tiltFor } from './layout';

const dist = ([x, , z]: number[]) => Math.hypot(x!, z!);

describe('3D-indeling', () => {
  it('jij zit aan de camerakant, maat tegenover, 1 links en 3 rechts', () => {
    expect(seatPose(0).position[2]).toBeGreaterThan(0.5);
    expect(seatPose(2).position[2]).toBeLessThan(-0.5);
    expect(seatPose(1).position[0]).toBeLessThan(-0.5);
    expect(seatPose(3).position[0]).toBeGreaterThan(0.5);
  });

  it('iedereen zit buiten de tafel', () => {
    for (const seat of [0, 1, 2, 3] as const) {
      expect(dist(seatPose(seat).position)).toBeGreaterThan(TABLE_RADIUS);
    }
  });

  it('tafelgenoten kijken naar het midden', () => {
    for (const seat of [1, 2, 3] as const) {
      const { position, rotationY } = seatPose(seat);
      // Model kijkt naar +z; na draaiing moet die richting naar de oorsprong wijzen.
      const forward = [Math.sin(rotationY), Math.cos(rotationY)];
      const toCenter = [-position[0], -position[2]];
      const dot = forward[0]! * toCenter[0]! + forward[1]! * toCenter[1]!;
      expect(dot).toBeCloseTo(Math.hypot(toCenter[0]!, toCenter[1]!), 5);
    }
  });

  it('slagkaarten liggen op het kleed, kaarten komen van binnen de tafelrand', () => {
    for (const seat of [0, 1, 2, 3] as const) {
      const spot = spotFor(seat, 3);
      expect(spot[1]).toBeGreaterThan(TABLE_TOP);
      expect(dist(spot)).toBeLessThan(0.2);
      expect(dist(edgeFor(seat))).toBeLessThan(TABLE_RADIUS);
    }
  });

  it('blikveld past zich aan: smal scherm krijgt een groter verticaal blikveld', () => {
    expect(fovFor(1)).toBeGreaterThan(fovFor(16 / 9));
    expect(fovFor(0.3)).toBeLessThanOrEqual(80);
    expect(fovFor(4)).toBeGreaterThanOrEqual(44);
  });

  it('scheve hoek is vast per kaart en klein', () => {
    expect(tiltFor('harten-B')).toBe(tiltFor('harten-B'));
    expect(Math.abs(tiltFor('klaveren-7'))).toBeLessThanOrEqual((12 * Math.PI) / 180);
  });
});
