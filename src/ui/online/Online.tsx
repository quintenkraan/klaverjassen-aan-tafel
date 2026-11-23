import { useEffect, useMemo, useRef, useState } from 'react';
import { viewFor, type GameState, type Seat } from '../../engine';
import { nl } from '../../i18n/nl';
import { hostTable, joinTable, type GuestLink, type HostLink } from '../../net/peer';
import {
  JOIN_ORDER,
  joinLink,
  makeCode,
  namesFor,
  normalizeCode,
  type LobbyInfo,
  type ToGuest,
  type ToHost,
} from '../../net/protocol';
import { setPlayerNames } from '../names';
import type { TableConfig } from '../storage';
import { TableView } from '../TablePOV';
import { useGame, type Action } from '../useGame';
import { useGuestGame } from './useGuestGame';

const NAME_KEY = 'klaverjas:naam';

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
function storeName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* niet bewaard, geen probleem */
  }
}

type Mode = { kind: 'menu' } | { kind: 'host' } | { kind: 'guest'; code: string };

/** Online spelen: tafel maken (je krijgt een code en link) of meedoen met een code. */
export function Online({
  config,
  initialCode,
  onExit,
}: {
  config: TableConfig;
  initialCode?: string;
  onExit: () => void;
}) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(initialCode ?? '');
  const [mode, setMode] = useState<Mode>({ kind: 'menu' });
  const t = nl.online;
  const okName = name.trim().length > 0;

  if (mode.kind === 'host') return <HostTable name={name.trim()} config={config} onExit={onExit} />;
  if (mode.kind === 'guest')
    return <GuestTable name={name.trim()} code={mode.code} onExit={onExit} />;

  return (
    <main className="setup">
      <h1>{t.title}</h1>
      <p>{t.intro}</p>
      <label className="setup__row">
        {t.yourName}
        <input
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          autoFocus
        />
      </label>
      <div className="online__choices">
        <section>
          <h2>{t.hostTitle}</h2>
          <p>{t.hostText}</p>
          <button
            type="button"
            disabled={!okName}
            onClick={() => {
              storeName(name.trim());
              setMode({ kind: 'host' });
            }}
          >
            {t.host}
          </button>
        </section>
        <section>
          <h2>{t.joinTitle}</h2>
          <input
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            placeholder="ABCDE"
            aria-label={t.code}
            className="online__code"
          />
          <button
            type="button"
            disabled={!okName || code.length < 4}
            onClick={() => {
              storeName(name.trim());
              setMode({ kind: 'guest', code });
            }}
          >
            {t.join}
          </button>
        </section>
      </div>
      <button type="button" className="ghost" onClick={onExit}>
        {nl.back}
      </button>
    </main>
  );
}

// ---------- host ----------

function HostTable({
  name,
  config,
  onExit,
}: {
  name: string;
  config: TableConfig;
  onExit: () => void;
}) {
  const t = nl.online;
  const code = useMemo(() => makeCode(), []);
  const [lobby, setLobby] = useState<LobbyInfo>({
    code,
    seats: [name, null, null, null],
    started: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = useRef<HostLink | null>(null);
  const seatOf = useRef(new Map<string, Seat>());
  const lobbyRef = useRef(lobby);
  lobbyRef.current = lobby;
  /** Wordt gezet door HostGame zodra het spel loopt. */
  const onAction = useRef<((seat: Seat, a: Action) => void) | null>(null);
  const onGuestChange = useRef<(() => void) | null>(null);

  const broadcastLobby = (next: LobbyInfo) => {
    for (const [id, seat] of seatOf.current)
      link.current?.send(id, { t: 'lobby', lobby: next, you: seat });
  };
  const updateLobby = (fn: (l: LobbyInfo) => LobbyInfo) => {
    const next = fn(lobbyRef.current);
    lobbyRef.current = next;
    setLobby(next);
    broadcastLobby(next);
    onGuestChange.current?.();
  };

  useEffect(() => {
    let closed = false;
    hostTable(code, {
      onJoin: (id) => {
        const taken = new Set(seatOf.current.values());
        const free = JOIN_ORDER.find((s) => !taken.has(s));
        if (free === undefined || lobbyRef.current.started) {
          link.current?.send(id, { t: 'full' });
          return;
        }
        seatOf.current.set(id, free);
      },
      onMessage: (id, msg: ToHost) => {
        const seat = seatOf.current.get(id);
        if (seat === undefined) return;
        if (msg.t === 'hello') {
          updateLobby((l) => ({
            ...l,
            seats: l.seats.map((s, i) => (i === seat ? msg.name.slice(0, 20) : s)),
          }));
        } else if (msg.t === 'action') onAction.current?.(seat, msg.action);
      },
      onLeave: (id) => {
        const seat = seatOf.current.get(id);
        seatOf.current.delete(id);
        if (seat !== undefined)
          updateLobby((l) => ({ ...l, seats: l.seats.map((s, i) => (i === seat ? null : s)) }));
      },
      onError: (m) => setError(m),
    })
      .then((l) => {
        if (closed) l.close();
        else link.current = l;
      })
      .catch((e) => setError(String(e?.type ?? e)));
    return () => {
      closed = true;
      link.current?.close();
    };
    // Eenmalig bij openen van de tafel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (lobby.started) {
    return (
      <HostGame
        config={config}
        lobby={lobby}
        send={(seat, msg) => {
          for (const [id, s] of seatOf.current) if (s === seat) link.current?.send(id, msg);
        }}
        onAction={onAction}
        onGuestChange={onGuestChange}
        onExit={onExit}
      />
    );
  }

  const url = joinLink(code, window.location);
  const seatLabel = (s: Seat) => [t.seatYou, t.seatLeft, t.seatPartner, t.seatRight][s];
  return (
    <main className="setup">
      <h1>{t.lobbyTitle}</h1>
      {error && <p className="penalty">{t.error(error)}</p>}
      <p>{t.shareText}</p>
      <div className="online__share">
        <strong className="online__bigcode">{code}</strong>
        <input readOnly value={url} aria-label={t.link} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(() => setCopied(true));
          }}
        >
          {copied ? t.copied : t.copy}
        </button>
      </div>
      <ul className="online__seats">
        {([0, 2, 1, 3] as Seat[]).map((s) => (
          <li key={s}>
            {seatLabel(s)}: <strong>{lobby.seats[s] ?? t.bot}</strong>
          </li>
        ))}
      </ul>
      <div className="setup__buttons">
        <button type="button" onClick={() => updateLobby((l) => ({ ...l, started: true }))}>
          {t.start}
        </button>
        <button type="button" className="ghost" onClick={onExit}>
          {nl.back}
        </button>
      </div>
    </main>
  );
}

function HostGame({
  config,
  lobby,
  send,
  onAction,
  onGuestChange,
  onExit,
}: {
  config: TableConfig;
  lobby: LobbyInfo;
  send: (seat: Seat, msg: ToGuest) => void;
  onAction: React.RefObject<((seat: Seat, a: Action) => void) | null>;
  onGuestChange: React.RefObject<(() => void) | null>;
  onExit: () => void;
}) {
  const seed = useMemo(() => Date.now() >>> 0, []);
  const humans = useMemo(
    () => ([0, 1, 2, 3] as Seat[]).filter((s) => s === 0 || lobby.seats[s] !== null),
    [lobby.seats],
  );
  const g = useGame(seed, config, undefined, { humans, persist: false });
  // Bots heten voor iedereen hetzelfde: de standaardnaam van hun eigen (absolute) stoel.
  const named = useMemo(() => lobby.seats.map((s, i) => s ?? nl.players[i as Seat]), [lobby.seats]);
  onAction.current = g.apply;

  // Elke wijziging: iedere gast krijgt zijn eigen, gedraaide en afgeschermde versie.
  const pushAll = (game: GameState) => {
    for (const seat of humans) {
      if (seat === 0) continue;
      const guestConfig = { ...config, agreement: viewFor(game, seat).signals.agreement };
      send(seat, {
        t: 'state',
        game: viewFor(game, seat),
        names: namesFor(named, seat),
        config: guestConfig,
      });
    }
  };
  useEffect(() => pushAll(g.game));
  onGuestChange.current = () => pushAll(g.game);

  useEffect(() => {
    setPlayerNames(namesFor(named, 0));
    return () => setPlayerNames(null);
  }, [named]);

  return <TableView g={g} seed={seed} config={config} onExit={onExit} />;
}

// ---------- gast ----------

type GuestState =
  | { kind: 'connecting' }
  | { kind: 'lobby'; lobby: LobbyInfo; you: Seat }
  | { kind: 'playing'; game: GameState; names: (string | null)[]; config: TableConfig }
  | { kind: 'error'; message: string };

function GuestTable({ name, code, onExit }: { name: string; code: string; onExit: () => void }) {
  const t = nl.online;
  const [state, setState] = useState<GuestState>({ kind: 'connecting' });
  const link = useRef<GuestLink | null>(null);

  useEffect(() => {
    let closed = false;
    joinTable(code, {
      onMessage: (msg) => {
        if (msg.t === 'lobby') setState({ kind: 'lobby', lobby: msg.lobby, you: msg.you });
        else if (msg.t === 'state')
          setState({ kind: 'playing', game: msg.game, names: msg.names, config: msg.config });
        else if (msg.t === 'full') setState({ kind: 'error', message: t.full });
        else if (msg.t === 'bye') setState({ kind: 'error', message: msg.reason });
      },
      onClose: () => setState({ kind: 'error', message: t.hostLeft }),
      onError: (m) => setState({ kind: 'error', message: t.error(m) }),
    })
      .then((l) => {
        if (closed) return l.close();
        link.current = l;
        l.send({ t: 'hello', name });
      })
      .catch(() => setState({ kind: 'error', message: t.notFound(code) }));
    return () => {
      closed = true;
      link.current?.close();
    };
    // Eenmalig bij openen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.kind === 'playing') {
    return (
      <GuestGame
        game={state.game}
        names={state.names}
        config={state.config}
        send={(m) => link.current?.send(m)}
        onExit={onExit}
      />
    );
  }

  return (
    <main className="setup">
      <h1>{t.joinTitle}</h1>
      {state.kind === 'connecting' && <p>{t.connecting(code)}</p>}
      {state.kind === 'error' && <p className="penalty">{state.message}</p>}
      {state.kind === 'lobby' && (
        <>
          <p>{t.waiting}</p>
          <ul className="online__seats">
            {state.lobby.seats.map((s, i) => (
              <li key={i}>{i === state.you ? `${s ?? name} (${t.you})` : (s ?? t.bot)}</li>
            ))}
          </ul>
        </>
      )}
      <button type="button" className="ghost" onClick={onExit}>
        {nl.back}
      </button>
    </main>
  );
}

function GuestGame({
  game,
  names,
  config,
  send,
  onExit,
}: {
  game: GameState;
  names: (string | null)[];
  config: TableConfig;
  send: (m: ToHost) => void;
  onExit: () => void;
}) {
  const seed = useMemo(() => Date.now() >>> 0, []);
  const g = useGuestGame(game, send, seed);
  useEffect(() => {
    setPlayerNames(names);
    return () => setPlayerNames(null);
  }, [names]);
  return <TableView g={g} seed={seed} config={config} onExit={onExit} />;
}
