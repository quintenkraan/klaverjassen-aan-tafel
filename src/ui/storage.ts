import {
  DEFAULT_AGREEMENT,
  BIDDING_RULES as DEFAULT_RULES,
  GESTURES,
  MEANINGS,
  type Agreement,
  type Difficulty,
  type GameLength,
  type GameState,
  type Rules,
  type SignalPenalty,
  type TrumpMode,
  type Variant,
} from '../engine';

/** Alles wat een tafel nodig heeft om te starten. */
export interface TableConfig {
  rules: Rules;
  agreement: Agreement;
  showLog: boolean;
  difficulty: Difficulty;
  /** Ontbreekt in oude saves: dan 3D. */
  view?: View;
}

/** 3d = echte 3D-tafel, 2d = eenvoudige (2.5D) tafel voor trage apparaten. */
export type View = '3d' | '2d';

export interface Settings {
  /** 2 = sinds de biedvariant; oudere instellingen krijgen eenmalig die regels. */
  ruleset: 2;
  view: View;
  variant: Variant;
  trumpMode: TrumpMode;
  length: GameLength;
  difficulty: Difficulty;
  signals: { enabled: boolean; penalty: SignalPenalty };
  showLog: boolean;
  agreement: Agreement;
}

export interface SavedGame {
  version: 1;
  game: GameState;
  config: TableConfig;
}

export const DEFAULT_SETTINGS: Settings = {
  ruleset: 2,
  view: '3d',
  variant: DEFAULT_RULES.variant,
  trumpMode: DEFAULT_RULES.trumpMode,
  length: DEFAULT_RULES.length,
  difficulty: 'gemiddeld',
  signals: DEFAULT_RULES.signals,
  showLog: false,
  agreement: DEFAULT_AGREEMENT,
};

export const SETTINGS_KEY = 'klaverjas:instellingen';
export const SAVE_KEY = 'klaverjas:potje';

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** localStorage kan ontbreken of gooien (privévenster, geblokkeerde opslag). */
function defaultStore(): KV | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function read(kv: KV | null, key: string): unknown {
  try {
    const raw = kv?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function write(kv: KV | null, key: string, value: unknown): void {
  try {
    kv?.setItem(key, JSON.stringify(value));
  } catch {
    /* opslag vol of geblokkeerd: dan maar niet bewaren */
  }
}

function oneOf<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function validLength(value: unknown): GameLength {
  const v = value as Partial<GameLength> | null;
  if (v?.kind === 'spellen' && typeof v.count === 'number' && v.count > 0) return v as GameLength;
  if (v?.kind === 'punten' && typeof v.target === 'number' && v.target > 0) return v as GameLength;
  return DEFAULT_SETTINGS.length;
}

function validAgreement(value: unknown): Agreement {
  const v = (value ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_AGREEMENT };
  for (const g of GESTURES) {
    if (v[g] === null) out[g] = null;
    else if (MEANINGS.includes(v[g] as never)) out[g] = v[g] as Agreement[typeof g];
  }
  return out;
}

export function loadSettings(kv: KV | null = defaultStore()): Settings {
  const v = (read(kv, SETTINGS_KEY) ?? {}) as Partial<Settings>;
  const d = DEFAULT_SETTINGS;
  // Eenmalig naar jullie regels (bieden), de rest van je instellingen blijft staan.
  const old = v.ruleset !== 2;
  return {
    ruleset: 2,
    view: oneOf(v.view, ['3d', '2d'] as const, d.view),
    variant: old ? d.variant : oneOf(v.variant, ['amsterdams', 'rotterdams'] as const, d.variant),
    trumpMode: old
      ? d.trumpMode
      : oneOf(v.trumpMode, ['bieden', 'verplicht', 'vrij', 'utrechts'] as const, d.trumpMode),
    length: old ? d.length : validLength(v.length),
    difficulty: oneOf(v.difficulty, ['makkelijk', 'gemiddeld', 'sterk'] as const, d.difficulty),
    signals: {
      enabled: typeof v.signals?.enabled === 'boolean' ? v.signals.enabled : d.signals.enabled,
      penalty: oneOf(v.signals?.penalty, ['punten', 'spel'] as const, d.signals.penalty),
    },
    showLog: typeof v.showLog === 'boolean' ? v.showLog : d.showLog,
    agreement: validAgreement(v.agreement),
  };
}

export function saveSettings(s: Settings, kv: KV | null = defaultStore()): void {
  write(kv, SETTINGS_KEY, s);
}

export function configFrom(s: Settings): TableConfig {
  return {
    rules: { variant: s.variant, trumpMode: s.trumpMode, length: s.length, signals: s.signals },
    agreement: s.agreement,
    showLog: s.showLog,
    difficulty: s.difficulty,
    view: s.view,
  };
}

/** Opgeslagen potje, of null als er niets (bruikbaars) is. */
export function loadGame(kv: KV | null = defaultStore()): SavedGame | null {
  const v = read(kv, SAVE_KEY) as Partial<SavedGame> | null;
  const g = v?.game;
  const ok =
    v?.version === 1 &&
    !!v.config?.rules &&
    !!g &&
    Array.isArray(g.scores) &&
    Array.isArray(g.round?.hands) &&
    g.round.hands.length === 4 &&
    !!g.signals;
  return ok ? (v as SavedGame) : null;
}

export function saveGame(saved: SavedGame, kv: KV | null = defaultStore()): void {
  write(kv, SAVE_KEY, saved);
}

export function clearGame(kv: KV | null = defaultStore()): void {
  try {
    kv?.removeItem(SAVE_KEY);
  } catch {
    /* niets te doen */
  }
}
