import { describe, expect, it } from 'vitest';
import {
  BENCH_Z,
  clampLook,
  edgeFor,
  fovFor,
  LOOK_LIMITS,
  onBench,
  ROOM,
  seatPose,
  spotFor,
  TABLE,
  TABLE_TOP,
  tiltFor,
} from './layout';

const inTable = ([x, , z]: number[]) =>
  Math.abs(x! - TABLE.x) < TABLE.w / 2 && Math.abs(z! - TABLE.z) < TABLE.d / 2;

describe('café-indeling', () => {
  it('jij en Sjaak op de bank, Ria en Henk op stoelen', () => {
    expect(onBench(0)).toBe(true);
    expect(onBench(3)).toBe(true);
    expect(onBench(1)).toBe(false);
    expect(onBench(2)).toBe(false);
    expect(seatPose(0).position[2]).toBe(BENCH_Z);
  });

  it('Sjaak zit rechts van je (jij kijkt naar +z, rechts is dan -x)', () => {
    expect(seatPose(3).position[0]).toBeLessThan(seatPose(0).position[0]);
  });

  it('maten zitten diagonaal: Henk is het verst van jou', () => {
    const d = (s: 1 | 2 | 3) => {
      const [x0, , z0] = seatPose(0).position;
      const [x, , z] = seatPose(s).position;
      return Math.hypot(x - x0, z - z0);
    };
    expect(d(2)).toBeGreaterThan(d(1));
    expect(d(2)).toBeGreaterThan(d(3));
  });

  it('speelvolgorde gaat rond de tafel (zelfde draairichting voor elke stap)', () => {
    const angle = (s: 0 | 1 | 2 | 3) => {
      const [x, , z] = seatPose(s).position;
      return Math.atan2(x - TABLE.x, z - TABLE.z);
    };
    const steps = [0, 1, 2, 3].map((s) => {
      let d = angle(((s + 1) % 4) as 0 | 1 | 2 | 3) - angle(s as 0 | 1 | 2 | 3);
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return Math.sign(d);
    });
    expect(new Set(steps).size).toBe(1);
  });

  it('iedereen kijkt naar de tafel', () => {
    for (const seat of [0, 1, 2, 3] as const) {
      const { position, rotationY } = seatPose(seat);
      const fz = Math.cos(rotationY);
      expect(Math.sign(TABLE.z - position[2])).toBe(Math.sign(fz));
    }
  });

  it('kaarten liggen op tafel en de tafel staat in de zaal', () => {
    for (const seat of [0, 1, 2, 3] as const) {
      const spot = spotFor(seat, 3);
      expect(spot[1]).toBeGreaterThan(TABLE_TOP);
      expect(inTable(spot)).toBe(true);
      // Kaarten komen uit de handen: tussen de stoel en het midden van de tafel.
      const [sx, , sz] = seatPose(seat).position;
      const [ex, , ez] = edgeFor(seat);
      expect(Math.hypot(ex - TABLE.x, ez - TABLE.z)).toBeLessThan(
        Math.hypot(sx - TABLE.x, sz - TABLE.z),
      );
    }
    expect(TABLE.x - TABLE.w / 2).toBeGreaterThan(ROOM.minX);
    expect(TABLE.z - TABLE.d / 2).toBeGreaterThan(ROOM.minZ);
  });

  it('rondkijken blijft binnen de grenzen', () => {
    expect(clampLook(10, 10)).toEqual([LOOK_LIMITS.yaw, LOOK_LIMITS.pitchUp]);
    expect(clampLook(-10, -10)).toEqual([-LOOK_LIMITS.yaw, -LOOK_LIMITS.pitchDown]);
    expect(clampLook(0.2, 0.1)).toEqual([0.2, 0.1]);
  });

  it('blikveld past zich aan: smal scherm krijgt een groter verticaal blikveld', () => {
    expect(fovFor(1)).toBeGreaterThan(fovFor(16 / 9));
  });

  it('scheve hoek is vast per kaart en klein', () => {
    expect(tiltFor('harten-B')).toBe(tiltFor('harten-B'));
    expect(Math.abs(tiltFor('klaveren-7'))).toBeLessThanOrEqual((12 * Math.PI) / 180);
  });
});
