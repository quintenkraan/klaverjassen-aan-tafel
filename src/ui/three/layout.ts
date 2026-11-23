import type { Seat } from '../../engine';

/** Maten in meters, op echte schaal (kaarten iets groter dan echt, voor leesbaarheid). */
export const TABLE_TOP = 0.76;
export const TABLE_RADIUS = 0.58;
export const CARD_W = 0.085;
export const CARD_H = 0.12;
export const HELD_W = 0.063;
export const HELD_H = 0.088;
/** Afstand van het midden van de tafel tot het midden van de stoel. */
export const SEAT_DISTANCE = 0.88;
/** Linker- en rechterbuur iets naar achteren, zodat ze in beeld passen (zoals in kaartspellen). */
const SIDE_SHIFT = 0.32;

export type Vec3 = [number, number, number];

/** Hoek rond de tafel. Jij (0) zit aan de camerakant (+z), 1 links, 2 tegenover, 3 rechts. */
export function seatAngle(seat: Seat): number {
  return [0, -Math.PI / 2 - SIDE_SHIFT, Math.PI, Math.PI / 2 + SIDE_SHIFT][seat]!;
}

/** Verticaal blikveld zodat er horizontaal steeds ongeveer 84 graden in beeld is. */
export function fovFor(aspect: number): number {
  const half = (84 / 2) * (Math.PI / 180);
  const v = 2 * Math.atan(Math.tan(half) / aspect) * (180 / Math.PI);
  return Math.min(80, Math.max(44, v));
}

function around(seat: Seat, r: number, y: number): Vec3 {
  const a = seatAngle(seat);
  return [Math.sin(a) * r, y, Math.cos(a) * r];
}

/** Waar de kaart van deze speler in de slag op het kleed komt te liggen. */
export function spotFor(seat: Seat, order: number): Vec3 {
  return around(seat, 0.11, TABLE_TOP + 0.006 + order * 0.002);
}

/** Bij de handen van deze speler: waar een kaart vandaan komt en heen gaat. */
export function edgeFor(seat: Seat): Vec3 {
  return around(seat, 0.5, TABLE_TOP + 0.18);
}

/** Positie van een stoel/persoon (op de vloer) en de draaiing zodat hij naar het midden kijkt. */
export function seatPose(seat: Seat): { position: Vec3; rotationY: number } {
  return { position: around(seat, SEAT_DISTANCE, 0), rotationY: seatAngle(seat) + Math.PI };
}

/** Vaste, licht scheve hoek per kaart, zodat het eruitziet als neergegooid. */
export function tiltFor(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 25) - 12) * (Math.PI / 180);
}
