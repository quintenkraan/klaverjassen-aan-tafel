import type { Seat } from '../engine';
import { nl } from '../i18n/nl';

/**
 * Namen aan tafel, per stoel zoals jij ze ziet (0 = jij). Standaard de vaste tafelgenoten;
 * bij online spelen de namen van de echte spelers (bots houden hun eigen naam).
 */
let names: string[] = [...nl.players];

export function playerName(seat: Seat | number): string {
  return names[seat] ?? nl.players[seat as Seat];
}

/** null = bot op die stoel: die houdt zijn standaardnaam. */
export function setPlayerNames(list: (string | null)[] | null): void {
  names = nl.players.map((n, i) => list?.[i] ?? n);
}
