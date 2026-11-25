import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimationMixer,
  Color,
  Quaternion,
  Vector3,
  LoopOnce,
  LoopRepeat,
  type AnimationAction,
  type Group,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
} from 'three';
import { Bartender } from './Bartender';
import { twoBoneIK } from './ik';
import { BAR, WALL_TABLE_X } from './layout';
import { createRng } from '../../engine';
import {
  findBone,
  lowerFor,
  movesFor,
  useMoveClips,
  usePerson,
  type AnimKey,
  type ClipSet,
  type MoveClips,
  type PersonKey,
} from './models';
import { DESTINATIONS, routeFor, SIDE_STEP, STAND_FORWARD, WALK_SPEED, type P2 } from './walks';

/** Krukken staan iets hoger dan stoelen: zo veel hoger komt een gast aan de bar te zitten. */
const STOOL_LIFT = 0.31;
const BAR_TOP = 1.1;
/** Bovenkant van het bar-blad en van de tafeltjes. */
const BAR_SURFACE = BAR_TOP + 0.06;
const TABLE_SURFACE = 0.76;

/** Een slok: reiken, optillen, drinken, terugzetten (seconden). */
const SIP = { reach: 0.7, lift: 1.5, drink: 2.3, lower: 3.0, end: 3.4 };

/** Waar het glas van een gast staat: voor hem op tafel (of de bar), iets naar rechts. */
function glassSpot(g: Guest): Vector3 {
  const f = g.stool ? 0.5 : 0.42;
  const fx = Math.sin(g.facing);
  const fz = Math.cos(g.facing);
  // Rechts van de persoon (zoals in Person.tsx).
  const rx = -Math.cos(g.facing);
  const rz = Math.sin(g.facing);
  return new Vector3(
    g.x + fx * f + rx * 0.13,
    g.stool ? BAR_SURFACE : TABLE_SURFACE,
    g.z + fz * f + rz * 0.13,
  );
}

interface Guest {
  who: PersonKey;
  x: number;
  z: number;
  facing: number;
  stool?: boolean;
  /** Kleurtint van kleren (en een beetje huid), zodat niet iedereen een tweeling is. */
  tint: string;
  /** Wat deze gast om de beurt doet; elk een eigen ritme. */
  moods: AnimKey[];
  period: number;
  offset: number;
}

/** Vaste gasten: aan twee tafeltjes in gesprek, een paar aan de bar, een eenling bij het raam. */
const T = WALL_TABLE_X;
const STOOL_X = BAR.x - 0.43;
const GUESTS: Guest[] = [
  // Tafeltje langs de ramen vlak bij jullie: twee in gesprek
  {
    who: 'joe',
    x: T,
    z: -5.0,
    facing: Math.PI,
    tint: '#c9d3ff',
    moods: ['talk', 'idle', 'laugh', 'idle'],
    period: 5.5,
    offset: 0,
  },
  {
    who: 'michelle',
    x: T,
    z: -6.0,
    facing: 0,
    tint: '#ffd9c9',
    moods: ['idle', 'nod', 'laugh', 'talk'],
    period: 5.5,
    offset: 1.3,
  },
  // Eenling met een biertje
  {
    who: 'henk',
    x: T,
    z: -3.1,
    facing: Math.PI,
    tint: '#fff0c4',
    moods: ['idle', 'think'],
    period: 9,
    offset: 3,
  },
  // Voorbij het hutje aan de wandtafel: één op de bank, één op een stoel
  {
    who: 'granny',
    x: -3.72,
    z: 2.1,
    facing: Math.PI / 2,
    tint: '#ffe0b0',
    moods: ['talk', 'idle', 'laugh'],
    period: 6.5,
    offset: 0.8,
  },
  {
    who: 'ria',
    x: -2.85,
    z: 1.7,
    facing: -Math.PI / 2,
    tint: '#cfe8ff',
    moods: ['idle', 'nod', 'talk'],
    period: 6.5,
    offset: 3.5,
  },
  // Verderop nog een stel
  {
    who: 'sjaak',
    x: T,
    z: 4.5,
    facing: Math.PI,
    tint: '#d7ffd2',
    moods: ['think', 'talk', 'idle'],
    period: 7,
    offset: 2.1,
  },
  {
    who: 'ria',
    x: T,
    z: 3.5,
    facing: 0,
    tint: '#e6d0ff',
    moods: ['talk', 'laugh', 'idle', 'nod'],
    period: 6,
    offset: 0.4,
  },
  // Aan de bar
  {
    who: 'joe',
    x: STOOL_X,
    z: -3.2,
    facing: Math.PI / 2,
    stool: true,
    tint: '#c4ecff',
    moods: ['idle', 'nod', 'idle', 'laugh'],
    period: 6.5,
    offset: 1,
  },
  {
    who: 'henk',
    x: STOOL_X,
    z: -1.22,
    facing: Math.PI / 2,
    stool: true,
    tint: '#ffc9d2',
    moods: ['talk', 'idle', 'disapprove', 'idle'],
    period: 6,
    offset: 2.5,
  },
];

/** Glas bier; `size` 2 is een flinke pul. */
export function Beer({
  p = [0, 0, 0],
  size = 1,
  liquidRef,
}: {
  p?: [number, number, number];
  size?: number;
  /** Om het bier te laten zakken (schaal in hoogte, vanaf de bodem). */
  liquidRef?: React.RefObject<Group | null>;
}) {
  return (
    <group position={p} scale={size}>
      {/* Glas, iets breder en doorzichtig, om het bier heen */}
      <mesh position={[0, 0.085, 0]}>
        <cylinderGeometry args={[0.035, 0.029, 0.17, 14, 1, true]} />
        <meshStandardMaterial color="#e8f0f0" transparent opacity={0.18} roughness={0.05} />
      </mesh>
      <group ref={liquidRef}>
        <mesh position={[0, 0.07, 0]}>
          <cylinderGeometry args={[0.032, 0.027, 0.14, 14]} />
          <meshStandardMaterial
            color="#c98a22"
            emissive="#b8701a"
            emissiveIntensity={0.4}
            roughness={0.12}
          />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.033, 0.033, 0.025, 14]} />
          <meshStandardMaterial color="#fbf6e9" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

/** Glazen pitcher (ruim 1,5 liter) met oor, voor Ome Henk. */
export function Pitcher({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.095, 0]}>
        <cylinderGeometry args={[0.062, 0.055, 0.19, 18]} />
        <meshStandardMaterial
          color="#c98a22"
          emissive="#b8701a"
          emissiveIntensity={0.4}
          roughness={0.12}
        />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.063, 0.063, 0.03, 18]} />
        <meshStandardMaterial color="#fbf6e9" roughness={0.9} />
      </mesh>
      {/* Glazen rand boven het bier en een tuitje */}
      <mesh position={[0, 0.235, 0]}>
        <cylinderGeometry args={[0.066, 0.064, 0.04, 18, 1, true]} />
        <meshStandardMaterial color="#e8f0f0" transparent opacity={0.25} roughness={0.05} />
      </mesh>
      <mesh position={[0.075, 0.12, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.045, 0.009, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#e8f0f0" transparent opacity={0.45} roughness={0.05} />
      </mesh>
    </group>
  );
}

/** Een uitstapje: route van opstaan tot de deur, en hoe lang hij wegblijft. */
export interface Trip {
  id: number;
  route: P2[];
  away: number;
}

type Phase = 'zit' | 'op' | 'loop' | 'weg' | 'terug' | 'neer';

function Patron({
  g,
  clips,
  moves,
  trip,
  onDone,
}: {
  g: Guest;
  clips: ClipSet;
  moves: MoveClips;
  trip: Trip | null;
  onDone: () => void;
}) {
  const { scene: model, hipsRatio } = usePerson(g.who);
  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  const lowerClip = useMemo(() => lowerFor(clips.lower, hipsRatio), [clips.lower, hipsRatio]);
  const own = useMemo(() => movesFor(moves, hipsRatio, STAND_FORWARD), [moves, hipsRatio]);
  const current = useRef<{ key: AnimKey; body: AnimationAction; head: AnimationAction } | null>(
    null,
  );
  const root = useRef<Group>(null);
  const walk = useRef({ phase: 'zit' as Phase, t: 0, leg: 1, route: [] as P2[], away: 0 });
  // Drinken: eigen glas, eigen ritme.
  const home = useMemo(() => glassSpot(g), [g]);
  const glass = useRef<Group>(null);
  const liquid = useRef<Group>(null);
  const sip = useRef({ next: 6 + g.offset * 4, t: -1, level: 1 });
  const arm = useMemo(
    () => ({
      arm: findBone(model, 'RightArm'),
      fore: findBone(model, 'RightForeArm'),
      hand: findBone(model, 'RightHand'),
      head: findBone(model, 'Head'),
    }),
    [model],
  );
  const v = useMemo(
    () => ({ a: new Vector3(), b: new Vector3(), pole: new Vector3(), q: new Quaternion() }),
    [],
  );

  useEffect(() => {
    const tint = new Color(g.tint);
    model.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = false;
      // Bewaar het origineel: in StrictMode draait dit effect twee keer.
      m.userData.base ??= m.material;
      const base = m.userData.base as Material | Material[];
      const tinted = (mat: Material) => {
        const copy = mat.clone() as MeshStandardMaterial;
        copy.color?.multiply(tint);
        return copy;
      };
      m.material = Array.isArray(base) ? base.map(tinted) : tinted(base);
    });
    const lower = mixer.clipAction(lowerClip);
    lower.setLoop(LoopRepeat, Infinity).play();
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer, lowerClip, model, g.tint]);

  // Een nieuw uitstapje: zittende lagen uit, opstaan (gaan zitten, achterstevoren).
  useEffect(() => {
    if (!trip || walk.current.phase !== 'zit') return;
    walk.current = { phase: 'op', t: 0, leg: 1, route: trip.route, away: trip.away };
    mixer.clipAction(lowerClip).fadeOut(0.3);
    current.current?.body.fadeOut(0.3);
    current.current?.head.fadeOut(0.3);
    current.current = null;
    const sit = mixer.clipAction(own.sit);
    sit.reset().setLoop(LoopOnce, 1);
    sit.clampWhenFinished = true;
    sit.timeScale = -1;
    sit.time = own.sit.duration;
    sit.fadeIn(0.3).play();
  }, [trip, mixer, lowerClip, own]);

  useFrame(({ clock }, dt) => {
    const step = Math.min(dt, 0.1);
    const w = walk.current;
    const grp = root.current;
    const seat: P2 = [g.x, g.z];
    const side = SIDE_STEP;
    const sitDur = own.sit.duration;

    if (w.phase === 'zit') {
      const i = Math.floor((clock.elapsedTime + g.offset) / g.period) % g.moods.length;
      const key = g.moods[i]!;
      if (current.current?.key !== key) {
        const body = mixer.clipAction(clips.body[key]).reset().play();
        const head = mixer.clipAction(clips.head[key]).reset().play();
        if (current.current) {
          current.current.body.crossFadeTo(body, 0.6, false);
          current.current.head.crossFadeTo(head, 0.6, false);
        }
        current.current = { key, body, head };
      }
    } else if (grp) {
      w.t += step;
      const walkAction = mixer.clipAction(own.walk);
      const sitAction = mixer.clipAction(own.sit);
      if (w.phase === 'op' || w.phase === 'neer') {
        // Tijdens opstaan of gaan zitten schuift hij opzij, naast de stoel (richting gangpad).
        const k = Math.min(1, w.t / sitDur);
        const f = w.phase === 'op' ? k : 1 - k;
        grp.position.set(seat[0] + side * f, 0, seat[1]);
        if (w.phase === 'neer') grp.rotation.y = turnTo(grp.rotation.y, g.facing, step * 6);
        if (k >= 1 && w.phase === 'op') {
          w.phase = 'loop';
          w.t = 0;
          w.leg = 1;
          walkAction.reset().setLoop(LoopRepeat, Infinity).play();
          sitAction.crossFadeTo(walkAction, 0.35, false);
        } else if (k >= 1) {
          // Weer zitten: terug naar de gewone, zittende lagen.
          w.phase = 'zit';
          sitAction.fadeOut(0.4);
          mixer.clipAction(lowerClip).reset().fadeIn(0.4).play();
          onDone();
        }
      } else if (w.phase === 'loop' || w.phase === 'terug') {
        const target = w.route[w.leg]!;
        const dx = target[0] - grp.position.x;
        const dz = target[1] - grp.position.z;
        const dist = Math.hypot(dx, dz);
        const move = WALK_SPEED * step;
        if (dist <= move) {
          grp.position.set(target[0], 0, target[1]);
          w.leg++;
          if (w.leg >= w.route.length) {
            if (w.phase === 'loop') {
              // Bij de deur: even weg.
              w.phase = 'weg';
              w.t = 0;
              grp.visible = false;
            } else {
              // Terug bij de stoel: draaien en gaan zitten.
              w.phase = 'neer';
              w.t = 0;
              sitAction.reset().setLoop(LoopOnce, 1);
              sitAction.clampWhenFinished = true;
              sitAction.timeScale = 1;
              walkAction.crossFadeTo(sitAction.play(), 0.35, false);
            }
          }
        } else {
          grp.position.x += (dx / dist) * move;
          grp.position.z += (dz / dist) * move;
          grp.rotation.y = turnTo(grp.rotation.y, Math.atan2(dx, dz), step * 8);
        }
      } else if (w.phase === 'weg' && w.t >= w.away) {
        // Terug naar binnen: dezelfde route andersom, tot naast de stoel.
        w.phase = 'terug';
        w.t = 0;
        w.leg = 1;
        w.route = [...w.route].reverse();
        grp.visible = true;
      }
    }
    mixer.update(step);
    drink(clock.elapsedTime, step);
  });

  /** Af en toe een slok bier: rechterhand naar het glas, naar de mond, en terug. */
  const drink = (now: number, dt: number) => {
    const d = sip.current;
    const gl = glass.current;
    if (!gl) return;
    if (walk.current.phase !== 'zit') {
      d.t = -1;
      gl.position.copy(home);
      gl.rotation.set(0, 0, 0);
      return;
    }
    if (d.t < 0 && now > d.next) d.t = 0;
    if (d.t < 0) return;
    d.t += dt;
    const t = d.t;
    const { arm: up, fore, hand, head } = arm;
    if (!up || !fore || !hand || !head) return;
    const fx = Math.sin(g.facing);
    const fz = Math.cos(g.facing);
    const rx = -Math.cos(g.facing);
    const rz = Math.sin(g.facing);
    // Waar de pols moet zijn om het glas vast te hebben, op tafel en bij de mond.
    const atGlass = v.a.copy(home).add(new Vector3(rx * 0.05, 0.07, rz * 0.05));
    head.getWorldPosition(v.b);
    const mouth = v.b.add(new Vector3(fx * 0.12 + rx * 0.05, -0.08, fz * 0.12 + rz * 0.05));
    const ease = (x: number) => x * x * (3 - 2 * x);
    let k = 0; // 0 = bij het glas, 1 = bij de mond
    if (t > SIP.reach && t < SIP.lift) k = ease((t - SIP.reach) / (SIP.lift - SIP.reach));
    else if (t >= SIP.lift && t < SIP.drink) k = 1;
    else if (t >= SIP.drink && t < SIP.lower)
      k = 1 - ease((t - SIP.drink) / (SIP.lower - SIP.drink));
    const w =
      t < SIP.reach
        ? ease(t / SIP.reach)
        : t > SIP.lower
          ? 1 - ease((t - SIP.lower) / (SIP.end - SIP.lower))
          : 1;
    const target = atGlass.clone().lerp(mouth, k);
    const saved = [up, fore].map((b) => b.quaternion.clone());
    up.getWorldPosition(v.pole);
    v.pole.add(new Vector3(rx * 0.3 - fx * 0.1, -0.45, rz * 0.3 - fz * 0.1));
    twoBoneIK(up, fore, hand, target, v.pole);
    [up, fore].forEach((b, i) => {
      v.q.copy(b.quaternion);
      b.quaternion.copy(saved[i]!).slerp(v.q, Math.max(0, Math.min(1, w)));
    });
    model.updateMatrixWorld(true);
    // Het glas zit in de hand zolang hij het vastheeft.
    if (t > SIP.reach && t < SIP.lower) {
      hand.getWorldPosition(gl.position);
      gl.position.add(new Vector3(-rx * 0.05, -0.07, -rz * 0.05));
      gl.rotation.set(0, 0, 0);
      gl.rotateOnWorldAxis(new Vector3(rx, 0, rz), -0.9 * k);
    } else {
      gl.position.copy(home);
      gl.rotation.set(0, 0, 0);
    }
    if (t >= SIP.end) {
      d.t = -1;
      d.level = d.level < 0.3 ? 1 : d.level - 0.12;
      d.next = now + 14 + ((g.offset * 7.3 + now) % 22);
      liquid.current?.scale.set(1, d.level, 1);
    }
  };

  return (
    <>
      <group ref={root} position={[g.x, g.stool ? STOOL_LIFT : 0, g.z]} rotation-y={g.facing}>
        <primitive object={model} />
      </group>
      <group ref={glass} position={home}>
        <Beer liquidRef={liquid} />
      </group>
    </>
  );
}

/** Kortste draai van hoek `from` naar `to`, hooguit `max` radialen. */
function turnTo(from: number, to: number, max: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + Math.max(-max, Math.min(max, d));
}

/** Gasten aan de tafeltjes langs de ramen kunnen opstaan; die aan de bar en op de bank niet. */
const WALKERS = GUESTS.map((g, i) => (g.x === T && !g.stool ? i : -1)).filter((i) => i >= 0);

/**
 * Af en toe staat er iemand op en loopt naar de WC, naar buiten of naar de zijdeur, blijft even
 * weg en komt terug. Altijd hooguit één tegelijk: rustig, en zuinig op telefoons.
 */
function useWanderer(): [{ guest: number; trip: Trip } | null, () => void] {
  const [active, setActive] = useState<{ guest: number; trip: Trip } | null>(null);
  const rng = useRef(createRng(0x9a57));
  useEffect(() => {
    if (active) return;
    const r = rng.current;
    const wait = 25000 + r() * 35000;
    const t = setTimeout(() => {
      const guest = WALKERS[Math.floor(r() * WALKERS.length)]!;
      const g = GUESTS[guest]!;
      const dest = DESTINATIONS[Math.floor(r() * DESTINATIONS.length)]!;
      setActive({
        guest,
        trip: { id: Date.now(), route: routeFor(g.x, g.z, dest), away: 8 + r() * 20 },
      });
    }, wait);
    return () => clearTimeout(t);
  }, [active]);
  return [active, () => setActive(null)];
}

/** Andere cafégasten, voor de sfeer. Ze doen hun eigen ding en spelen niet mee. */
export function Patrons({ clips }: { clips: ClipSet }) {
  const moves = useMoveClips();
  const [active, done] = useWanderer();
  return (
    <>
      {GUESTS.map((g, i) => (
        <Patron
          key={i}
          g={g}
          clips={clips}
          moves={moves}
          trip={active?.guest === i ? active.trip : null}
          onDone={done}
        />
      ))}
      <Bartender clips={clips} moves={moves} />
    </>
  );
}
