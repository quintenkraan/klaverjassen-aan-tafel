import { FRONT_DOOR_X, ROOM, WC_DOOR_X } from './layout';

/** Punt op de vloer: [x, z]. */
export type P2 = [number, number];

/** Midden van het gangpad tussen de tafeltjes langs de ramen en de barkrukken. */
export const AISLE_X = -2.3;
/** Een gast staat zo ver opzij van zijn stoel op, richting het gangpad (+x). */
export const SIDE_STEP = 0.45;
/** Bij het opstaan komt de heup zo ver naar voren. */
export const STAND_FORWARD = 0.2;
/** Loopsnelheid in meter per seconde. */
export const WALK_SPEED = 0.95;

export type Destination = 'wc' | 'buiten' | 'zijdeur';
export const DESTINATIONS: readonly Destination[] = ['wc', 'buiten', 'zijdeur'];

/** Vanaf het gangpad naar de bestemming (de laatste stap is de deur, daar verdwijnt hij). */
const LEGS: Record<Destination, P2[]> = {
  // Voorbij het eind van de bar naar links, naar de WC-deur.
  wc: [
    [AISLE_X, 5.6],
    [WC_DOOR_X, 5.7],
    [WC_DOOR_X, 5.3],
  ],
  // Naar de hoofddeur, helemaal links in de voorgevel.
  buiten: [
    [AISLE_X, 7.5],
    [FRONT_DOOR_X, 7.6],
    [FRONT_DOOR_X, ROOM.maxZ - 0.3],
  ],
  // Om het hutje heen naar de zijdeur in de ramenmuur.
  zijdeur: [
    [AISLE_X, -0.85],
    [-3.4, -0.85],
    [-3.4, 0],
    [ROOM.minX + 0.15, 0],
  ],
};

/** Waar een gast staat na het opstaan: naast zijn stoel, richting gangpad. */
export function standPoint(x: number, z: number): P2 {
  return [x + SIDE_STEP, z];
}

/** Hele route van opstaan tot de deur. Terug is dezelfde route andersom. */
export function routeFor(x: number, z: number, dest: Destination): P2[] {
  const stand = standPoint(x, z);
  return [stand, [AISLE_X, stand[1]], ...LEGS[dest]];
}

export function routeLength(route: readonly P2[]): number {
  let sum = 0;
  for (let i = 1; i < route.length; i++)
    sum += Math.hypot(route[i]![0] - route[i - 1]![0], route[i]![1] - route[i - 1]![1]);
  return sum;
}
