import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import type { Card, Gesture, Seat, Trick } from '../../engine';
import { nl } from '../../i18n/nl';
import type { Speech } from '../Avatar';
import { Cafe } from './Cafe';
import { Mood } from './Mood';
import { isLite } from './support';
import { TrickCards } from './Cards3D';
import { fovFor, LOOK_AT, seatPose, spotFor, TABLE, TABLE_TOP, type Vec3 } from './layout';
import { isLookingAway, lookBy, lookReset } from './look';
import { preloadModels, useClips, type AnimKey, type PersonKey } from './models';
import { Beer, Patrons, Pitcher } from './Patrons';
import { Person } from './Person';
import { playerName } from '../names';

export interface Scene3DProps {
  trick: Trick | undefined;
  winner: Seat | null;
  handCounts: [number, number, number];
  thinking: Seat | null;
  dealer: Seat;
  speech: Speech | null;
  gesture: { seat: Seat; gesture: Gesture } | null;
  nodSeat: Seat | null;
  label: string;
  /** Jouw kaarten in je handen, en welke je nu mag spelen. */
  myCards: Card[];
  playable: Card[];
  onPlay: (card: Card) => void;
}

const BOTS = [1, 2, 3] as const;
const WHO: Record<1 | 2 | 3, PersonKey> = { 1: 'ria', 2: 'henk', 3: 'sjaak' };
const PLAY_MS = 900;

preloadModels();

/** Blikveld bijstellen op de schermverhouding. */
function Lens() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    cam.fov = fovFor(size.width / size.height);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

/** Tijdens het laden van de mensen: vaste camera op ooghoogte. */
function FallbackCamera() {
  useFrame(({ camera }) => {
    const [x, , z] = seatPose(0).position;
    camera.position.set(x, 1.2, z + 0.1);
    camera.lookAt(...LOOK_AT);
  });
  return null;
}

/**
 * Zet de HTML-bordjes (naam, ballon) elk frame boven het hoofd van de tafelgenoot.
 * Schrijft direct in de DOM, zonder React te laten herrenderen.
 */
function TagProjector({ tags }: { tags: RefObject<(HTMLDivElement | null)[]> }) {
  const { camera, size } = useThree();
  const anchors = useMemo(
    () =>
      BOTS.map((seat) => {
        const [x, , z] = seatPose(seat).position;
        // Sjaak zit naast je op de bank en komt dus hoger in beeld: zijn bordje iets lager.
        return new Vector3(x, seat === 3 ? 1.22 : 1.33, z);
      }),
    [],
  );
  const v = useMemo(() => new Vector3(), []);
  useFrame(() => {
    anchors.forEach((a, i) => {
      const el = tags.current?.[i];
      if (!el) return;
      v.copy(a).project(camera);
      el.style.display = v.z < 1 ? '' : 'none';
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    });
  });
  return null;
}

/** Welke beweging bij welke tekst hoort. */
function moodFor(text: string): AnimKey {
  const t = nl.talk;
  const has = (lines: readonly string[]) => lines.includes(text);
  if (has(t.caughtWarn) || has(t.caughtPenalty)) return 'disapprove';
  if (has(t.win) || has(t.pit) || has(t.natUs) || has(t.natThem) || has(t.busted)) return 'laugh';
  return 'talk';
}

/** Houdt bij wie net een kaart speelde, voor de "kaart neerleggen"-beweging. */
function useLastPlayed(trick: Trick | undefined): { seat: Seat; at: number } | null {
  const [last, setLast] = useState<{ seat: Seat; at: number } | null>(null);
  const count = trick?.cards.length ?? 0;
  const seat = trick?.cards.at(-1)?.seat;
  useEffect(() => {
    if (count > 0 && seat !== undefined) setLast({ seat, at: performance.now() });
  }, [count, seat]);
  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => setLast(null), PLAY_MS);
    return () => clearTimeout(t);
  }, [last]);
  return last;
}

/** Wie de laatste slag pakte, en wanneer (voor de veeg-beweging). */
function useSweep(
  trick: Trick | undefined,
  winner: Seat | null,
): { seat: Seat; at: number } | null {
  const [s, setS] = useState<{ seat: Seat; at: number } | null>(null);
  const full = (trick?.cards.length ?? 0) === 4;
  useEffect(() => {
    if (full && winner !== null && winner !== 0) setS({ seat: winner, at: performance.now() });
  }, [full, winner]);
  useEffect(() => {
    if (!s) return;
    const t = setTimeout(() => setS(null), 1200);
    return () => clearTimeout(t);
  }, [s]);
  return s;
}

function People(props: Scene3DProps & { reduced: boolean }) {
  const clips = useClips();
  const played = useLastPlayed(props.trick);
  const sweep = useSweep(props.trick, props.winner);
  // Kaart leggen: hand naar de eigen plek op het kleed. Slag pakken: hand naar het midden.
  const reachFor = (seat: Seat): { id: number; to: Vec3 } | null => {
    if (played?.seat === seat) {
      const n = Math.max(0, (props.trick?.cards.length ?? 1) - 1);
      const [x, y, z] = spotFor(seat, n);
      return { id: played.at, to: [x, y + 0.03, z] };
    }
    if (sweep?.seat === seat) return { id: sweep.at, to: [TABLE.x, TABLE_TOP + 0.03, TABLE.z] };
    return null;
  };

  const moods = (seat: Seat): { body: AnimKey; head: AnimKey } => {
    const g = props.gesture?.seat === seat ? props.gesture.gesture : null;
    const speaking = props.speech?.seat === seat ? props.speech : null;
    // Jij: armen en hoofd blijven rustig bij je kaarten; geen animaties die eraan trekken.
    if (seat === 0) return { body: 'hold', head: 'hold' };
    let body: AnimKey = 'hold';
    let head: AnimKey = props.thinking === seat ? 'hold' : 'idle';
    if (speaking) {
      const m = moodFor(speaking.text);
      body = m;
      head = m;
    }
    if (g === 'tikken' || g === 'rugkaart') body = 'point';
    if (g === 'oorkrabben' || g === 'keelschrapen') {
      body = 'think';
      head = 'think';
    }
    if (props.nodSeat === seat) head = 'nod';
    return { body, head };
  };

  return (
    <>
      <Patrons clips={clips} />
      {/* Jouw pul bier, links naast je op tafel */}
      <Beer p={[TABLE.x + 0.42, TABLE_TOP, TABLE.z - 0.27]} size={1.7} />
      {/* De rest van de tafel: Sjaak naast je en Tante Ria een glas, Ome Henk een pitcher */}
      <Beer p={[TABLE.x - 0.42, TABLE_TOP, TABLE.z - 0.27]} size={1.4} />
      <Beer p={[TABLE.x + 0.4, TABLE_TOP, TABLE.z + 0.28]} size={1.4} />
      <Pitcher p={[TABLE.x - 0.38, TABLE_TOP, TABLE.z + 0.26]} />
      <Person
        who="henk"
        seat={0}
        clips={clips}
        {...moods(0)}
        cards={0}
        gesture={null}
        isPlayer
        myCards={props.myCards}
        playable={props.playable}
        onPlay={props.onPlay}
        attention={props.speech?.seat ?? null}
      />
      {BOTS.map((seat) => (
        <Person
          key={seat}
          who={WHO[seat]}
          seat={seat}
          clips={clips}
          {...moods(seat)}
          cards={props.handCounts[seat - 1]!}
          gesture={props.gesture?.seat === seat ? props.gesture.gesture : null}
          reach={reachFor(seat)}
        />
      ))}
    </>
  );
}

/** Het bruine café met echte mensen. Je eigen kaarten en de knoppen blijven HTML erbovenop. */
export default function Scene3D(props: Scene3DProps) {
  const reduced = useMemo(
    () =>
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const tags = useRef<(HTMLDivElement | null)[]>([]);
  const lite = useMemo(isLite, []);
  // Slepen = rondkijken. Een klik (zonder slepen) blijft een klik op een kaart.
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [away, setAway] = useState(false);
  return (
    <div
      className="scene3d"
      role="region"
      aria-label={props.label}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || !(e.buttons & 1)) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) < 6) return;
        d.moved = true;
        lookBy(dx, dy);
        d.x = e.clientX;
        d.y = e.clientY;
        setAway(isLookingAway());
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      <Canvas
        shadows="soft"
        // Telefoon: niet meer pixels dan nodig, dan blijft het soepel; kaarten blijven scherp
        // door hun eigen hoge resolutie en filtering.
        dpr={lite ? [1, 1.6] : [1, 2]}
        camera={{ position: [0, 1.22, 0.86], fov: 60, near: 0.03, far: 30 }}
      >
        <Lens />
        <Cafe />
        <Mood />
        <TrickCards trick={props.trick} winner={props.winner} />
        <Suspense fallback={<FallbackCamera />}>
          <People {...props} reduced={reduced} />
        </Suspense>
        <TagProjector tags={tags} />
      </Canvas>

      {away && (
        <button
          type="button"
          className="look-back"
          onClick={() => {
            lookReset();
            setAway(false);
          }}
        >
          {nl.lookBack}
        </button>
      )}

      {BOTS.map((seat, i) => {
        const speech = props.speech?.seat === seat ? props.speech : null;
        const ahum = props.gesture?.seat === seat && props.gesture.gesture === 'keelschrapen';
        return (
          <div
            key={seat}
            className="tag3d"
            ref={(el) => {
              tags.current[i] = el;
            }}
          >
            {speech && (
              <div key={speech.id} className="bubble bubble--3d" role="status">
                {speech.text}
              </div>
            )}
            {ahum && <div className="ahum3d">ahum</div>}
            <div className={`nametag ${props.thinking === seat ? 'nametag--turn' : ''}`}>
              {playerName(seat)}
              {props.dealer === seat && ` (${nl.dealer})`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
