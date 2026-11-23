import type { GameState, Seat } from '../engine';
import type { Action } from '../ui/useGame';
import type { TableConfig } from '../ui/storage';

/**
 * Berichten tussen host en gasten. De host rekent het spel uit; gasten sturen alleen zetten.
 * Gasten krijgen het spel al gedraaid (zij zitten op stoel 0) en zonder andermans kaarten.
 */

export interface LobbyInfo {
  code: string;
  /** Namen per absolute stoel; null = bot. Stoel 0 is de host. */
  seats: (string | null)[];
  started: boolean;
}

export type ToHost = { t: 'hello'; name: string } | { t: 'action'; action: Action };

export type ToGuest =
  | { t: 'lobby'; lobby: LobbyInfo; you: Seat }
  /** game is al viewFor(jou): jij op stoel 0. names idem, in jouw weergave. */
  | { t: 'state'; game: GameState; names: (string | null)[]; config: TableConfig }
  | { t: 'full' }
  | { t: 'bye'; reason: string };

/** Volgorde waarin gasten een stoel krijgen: eerst tegenover de host (zijn maat), dan links, rechts. */
export const JOIN_ORDER: Seat[] = [2, 1, 3];

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Korte tafelcode, zonder letters die op elkaar lijken (geen 0/O, 1/I). */
export function makeCode(random: () => number = Math.random, length = 5): string {
  return Array.from({ length }, () => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]).join(
    '',
  );
}

export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .slice(0, 8);
}

/** Link om mee te doen: dezelfde site met ?tafel=CODE erachter. */
export function joinLink(code: string, location: { origin: string; pathname: string }): string {
  return `${location.origin}${location.pathname}?tafel=${code}`;
}

/** Peer-id op de (gratis, openbare) PeerJS-server. */
export function peerIdFor(code: string): string {
  return `klaverjassen-aan-tafel-${code.toLowerCase()}`;
}

/** Namen per stoel zoals speler `me` ze ziet (gedraaid zoals viewFor). */
export function namesFor(seats: (string | null)[], me: Seat): (string | null)[] {
  return [0, 1, 2, 3].map((i) => seats[(i + me) % 4] ?? null);
}
