import { describe, expect, it } from 'vitest';
import { createGame, DEFAULT_AGREEMENT } from '../engine';
import {
  clearGame,
  configFrom,
  DEFAULT_SETTINGS,
  loadGame,
  loadSettings,
  SAVE_KEY,
  saveGame,
  saveSettings,
  SETTINGS_KEY,
} from './storage';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('instellingen', () => {
  it('zonder opslag: standaardwaarden', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memoryStore())).toEqual(DEFAULT_SETTINGS);
  });

  it('opslaan en terugladen', () => {
    const kv = memoryStore();
    const s = {
      ...DEFAULT_SETTINGS,
      variant: 'amsterdams' as const,
      difficulty: 'sterk' as const,
      length: { kind: 'punten' as const, target: 1500 },
      agreement: { ...DEFAULT_AGREEMENT, knipoog: null },
    };
    saveSettings(s, kv);
    expect(loadSettings(kv)).toEqual(s);
  });

  it('kapotte of rare data valt terug op standaard', () => {
    const kv = memoryStore();
    kv.setItem(SETTINGS_KEY, '{niet json');
    expect(loadSettings(kv)).toEqual(DEFAULT_SETTINGS);
    kv.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        variant: 'parijs',
        length: { kind: 'spellen', count: -3 },
        agreement: { knipoog: 'hack' },
      }),
    );
    const s = loadSettings(kv);
    expect(s.variant).toBe(DEFAULT_SETTINGS.variant);
    expect(s.length).toEqual(DEFAULT_SETTINGS.length);
    expect(s.agreement.knipoog).toBe(DEFAULT_AGREEMENT.knipoog);
  });

  it('opslag die gooit breekt niets', () => {
    const broken = {
      getItem: () => {
        throw new Error('geblokkeerd');
      },
      setItem: () => {
        throw new Error('vol');
      },
      removeItem: () => {
        throw new Error('nee');
      },
    };
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, broken)).not.toThrow();
    expect(loadGame(broken)).toBeNull();
    expect(() => clearGame(broken)).not.toThrow();
  });
});

describe('potje bewaren', () => {
  it('opslaan, hervatten en wissen', () => {
    const kv = memoryStore();
    const config = configFrom(DEFAULT_SETTINGS);
    const game = createGame(config.rules, 42);
    saveGame({ version: 1, game, config }, kv);
    expect(loadGame(kv)).toEqual({ version: 1, game, config });
    clearGame(kv);
    expect(loadGame(kv)).toBeNull();
  });

  it('oude of onvolledige save wordt genegeerd', () => {
    const kv = memoryStore();
    kv.setItem(SAVE_KEY, JSON.stringify({ version: 0, game: {} }));
    expect(loadGame(kv)).toBeNull();
    kv.setItem(
      SAVE_KEY,
      JSON.stringify({ version: 1, game: { scores: [] }, config: { rules: {} } }),
    );
    expect(loadGame(kv)).toBeNull();
  });
});
