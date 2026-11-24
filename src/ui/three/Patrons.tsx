import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AnimationMixer,
  Color,
  LoopRepeat,
  type AnimationAction,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
} from 'three';
import { lowerFor, usePerson, type AnimKey, type ClipSet, type PersonKey } from './models';

/** Krukken staan iets hoger dan stoelen: zo veel hoger komt een gast aan de bar te zitten. */
const STOOL_LIFT = 0.31;
const BAR_TOP = 1.1;

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
const GUESTS: Guest[] = [
  {
    who: 'henk',
    x: -1.0,
    z: -4.8,
    facing: Math.PI,
    tint: '#c9d3ff',
    moods: ['talk', 'idle', 'laugh', 'idle'],
    period: 5.5,
    offset: 0,
  },
  {
    who: 'ria',
    x: -1.0,
    z: -5.8,
    facing: 0,
    tint: '#ffd9c9',
    moods: ['idle', 'nod', 'laugh', 'talk'],
    period: 5.5,
    offset: 1.3,
  },
  {
    who: 'sjaak',
    x: -0.7,
    z: -2.1,
    facing: Math.PI,
    tint: '#d7ffd2',
    moods: ['think', 'talk', 'idle'],
    period: 7,
    offset: 2.1,
  },
  {
    who: 'ria',
    x: -0.7,
    z: -3.1,
    facing: 0,
    tint: '#e6d0ff',
    moods: ['talk', 'laugh', 'idle', 'nod'],
    period: 6,
    offset: 0.4,
  },
  {
    who: 'henk',
    x: -3.2,
    z: -2.7,
    facing: Math.PI,
    tint: '#fff0c4',
    moods: ['idle', 'think'],
    period: 9,
    offset: 3,
  },
  {
    who: 'sjaak',
    x: 0.57,
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
    x: 0.57,
    z: -1.22,
    facing: Math.PI / 2,
    stool: true,
    tint: '#ffc9d2',
    moods: ['talk', 'idle', 'disapprove', 'idle'],
    period: 6,
    offset: 2.5,
  },
];

function Beer({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.032, 0.027, 0.14, 14]} />
        <meshStandardMaterial color="#d99a2b" transparent opacity={0.85} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.033, 0.033, 0.025, 14]} />
        <meshStandardMaterial color="#fbf6e9" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Patron({ g, clips }: { g: Guest; clips: ClipSet }) {
  const { scene: model, hipsRatio } = usePerson(g.who);
  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  const lowerClip = useMemo(() => lowerFor(clips.lower, hipsRatio), [clips.lower, hipsRatio]);
  const current = useRef<{ key: AnimKey; body: AnimationAction; head: AnimationAction } | null>(
    null,
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

  useFrame(({ clock }, dt) => {
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
    mixer.update(Math.min(dt, 0.1));
  });

  return (
    <group position={[g.x, g.stool ? STOOL_LIFT : 0, g.z]} rotation-y={g.facing}>
      <primitive object={model} />
    </group>
  );
}

/** Andere cafégasten, voor de sfeer. Ze doen hun eigen ding en spelen niet mee. */
export function Patrons({ clips }: { clips: ClipSet }) {
  return (
    <>
      {GUESTS.map((g, i) => (
        <Patron key={i} g={g} clips={clips} />
      ))}
      {/* Bier op tafel bij de pratende gasten en op de bar */}
      <Beer p={[-0.92, 0.76, -5.12]} />
      <Beer p={[-1.1, 0.76, -5.45]} />
      <Beer p={[-0.62, 0.76, -2.45]} />
      <Beer p={[-0.8, 0.76, -2.8]} />
      <Beer p={[-3.1, 0.76, -3.0]} />
      <Beer p={[0.8, BAR_TOP, -3.15]} />
      <Beer p={[0.8, BAR_TOP, -1.3]} />
    </>
  );
}
