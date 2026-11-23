import type { Seat } from '../../engine';

/**
 * Plattegrond van het café (meters). x: links (-) naar rechts (+), z: achterwand (-) naar
 * de straat (+). Jullie tafel staat links achterin bij het raam, tegen de spiegelwand.
 */
export const ROOM = { minX: -4, maxX: 4, minZ: -9, maxZ: 9, height: 3.2 };

export const TABLE_TOP = 0.76;
/** Speeltafel: rechthoekig, voor de bank. */
export const TABLE = { x: -2.9, z: -7.98, w: 1.0, d: 0.84 };
export const BENCH_Z = -8.64;
const CHAIR_Z = -7.3;
/** Afstand tussen twee mensen naast elkaar aan dezelfde kant. */
const HALF = 0.3;

export const CARD_W = 0.085;
export const CARD_H = 0.12;
export const HELD_W = 0.063;
export const HELD_H = 0.088;

export type Vec3 = [number, number, number];

/**
 * Waar iedereen zit. Jij (0) en Sjaak (3, rechts van je) op de bank met de spiegel in de rug,
 * Tante Ria (1) tegenover jou en Ome Henk (2, je maat) schuin tegenover: maten zitten diagonaal
 * en de speelvolgorde 0-1-2-3 gaat netjes rond de tafel.
 */
const SEATS: Record<Seat, { x: number; z: number; facing: number }> = {
  0: { x: TABLE.x + HALF, z: BENCH_Z, facing: 0 },
  1: { x: TABLE.x + HALF, z: CHAIR_Z, facing: Math.PI },
  2: { x: TABLE.x - HALF, z: CHAIR_Z, facing: Math.PI },
  3: { x: TABLE.x - HALF, z: BENCH_Z, facing: 0 },
};

/** Positie van een persoon (op de vloer) en de draaiing (model kijkt naar +z bij 0). */
export function seatPose(seat: Seat): { position: Vec3; rotationY: number } {
  const s = SEATS[seat];
  return { position: [s.x, 0, s.z], rotationY: s.facing };
}

/** Zit deze speler op de bank (tegen de wand) in plaats van op een stoel? */
export function onBench(seat: Seat): boolean {
  return SEATS[seat].z === BENCH_Z;
}

function toward(seat: Seat, t: number, y: number): Vec3 {
  const s = SEATS[seat];
  return [TABLE.x + (s.x - TABLE.x) * t, y, TABLE.z + (s.z - TABLE.z) * t];
}

/** Waar de kaart van deze speler in de slag op tafel komt te liggen. */
export function spotFor(seat: Seat, order: number): Vec3 {
  return toward(seat, 0.33, TABLE_TOP + 0.006 + order * 0.002);
}

/** Bij de handen van deze speler: waar een kaart vandaan komt en heen gaat. */
export function edgeFor(seat: Seat): Vec3 {
  return toward(seat, 0.8, TABLE_TOP + 0.18);
}

/** Waar je standaard naar kijkt: recht vooruit over de tafel, iets naar het midden toe. */
export const LOOK_AT: Vec3 = [SEATS[0].x - 0.1, TABLE_TOP - 0.02, TABLE.z + 0.12];

/** Verticaal blikveld zodat er horizontaal steeds ongeveer 84 graden in beeld is. */
export function fovFor(aspect: number): number {
  const half = (84 / 2) * (Math.PI / 180);
  const v = 2 * Math.atan(Math.tan(half) / aspect) * (180 / Math.PI);
  return Math.min(80, Math.max(44, v));
}

/** Rondkijken: grenzen voor draaien (links/rechts) en knikken (op/neer), in radialen. */
export const LOOK_LIMITS = { yaw: 2.4, pitchUp: 0.75, pitchDown: 0.6 };

export function clampLook(yaw: number, pitch: number): [number, number] {
  return [
    Math.max(-LOOK_LIMITS.yaw, Math.min(LOOK_LIMITS.yaw, yaw)),
    Math.max(-LOOK_LIMITS.pitchDown, Math.min(LOOK_LIMITS.pitchUp, pitch)),
  ];
}

/** Vaste, licht scheve hoek per kaart, zodat het eruitziet als neergegooid. */
export function tiltFor(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 25) - 12) * (Math.PI / 180);
}
