import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import type { Gesture, Seat, Trick } from '../../engine';
import { nl } from '../../i18n/nl';
import type { Speech } from '../Avatar';
import { TrickCards } from './Cards3D';
import { Character3D, HEAD_Y } from './Character3D';
import { fovFor, seatPose, TABLE_RADIUS, TABLE_TOP } from './layout';

const BOTS = [1, 2, 3] as const;

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
        return new Vector3(x, HEAD_Y + 0.2, z);
      }),
    [],
  );
  const v = useMemo(() => new Vector3(), []);
  useFrame(() => {
    anchors.forEach((a, i) => {
      const el = tags.current?.[i];
      if (!el) return;
      v.copy(a).project(camera);
      const visible = v.z < 1;
      el.style.display = visible ? '' : 'none';
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    });
  });
  return null;
}

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
}

/** Jij zit aan tafel: camera op ooghoogte, kijkt licht omlaag naar het kleed. Ademt een beetje. */
function CameraRig({ reduced }: { reduced: boolean }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    cam.fov = fovFor(size.width / size.height);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const sway = reduced ? 0 : Math.sin(t * 0.6) * 0.006;
    camera.position.set(sway, 1.42 + (reduced ? 0 : Math.sin(t * 0.9) * 0.004), 1.3);
    camera.lookAt(0, TABLE_TOP + 0.2, -0.3);
  });
  return null;
}

function Room() {
  return (
    <>
      <color attach="background" args={['#24180f']} />
      <fog attach="fog" args={['#24180f', 4, 9]} />
      <hemisphereLight args={['#ffe8c4', '#4a3426', 1.4]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 1.6, 1.6]} intensity={2.5} color="#ffe2b8" />
      <spotLight
        position={[0, 2.6, 0]}
        angle={0.95}
        penumbra={0.7}
        decay={1.2}
        intensity={30}
        color="#ffd9a0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />
      {/* Hanglamp */}
      <mesh position={[0, 2.25, 0]}>
        <coneGeometry args={[0.28, 0.22, 24, 1, true]} />
        <meshStandardMaterial color="#2f4a3a" side={2} />
      </mesh>
      <mesh position={[0, 2.18, 0]}>
        <sphereGeometry args={[0.06, 12, 10]} />
        <meshStandardMaterial emissive="#ffdca0" emissiveIntensity={3} color="#fff" />
      </mesh>
      <mesh position={[0, 2.7, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.9]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Vloer en muren */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#5a3d28" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2, -3.5]}>
        <planeGeometry args={[14, 4]} />
        <meshStandardMaterial color="#6b5040" roughness={1} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 3.5, 2, 0]} rotation-y={-s * (Math.PI / 2)}>
          <planeGeometry args={[14, 4]} />
          <meshStandardMaterial color="#62493a" roughness={1} />
        </mesh>
      ))}
    </>
  );
}

function Table() {
  return (
    <group>
      <mesh position={[0, TABLE_TOP - 0.02, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[TABLE_RADIUS - 0.04, TABLE_RADIUS - 0.04, 0.04, 64]} />
        <meshStandardMaterial color="#1f6a40" roughness={1} />
      </mesh>
      <mesh position={[0, TABLE_TOP - 0.01, 0]} rotation-x={Math.PI / 2} castShadow>
        <torusGeometry args={[TABLE_RADIUS - 0.02, 0.035, 12, 64]} />
        <meshStandardMaterial color="#5b3a22" roughness={0.5} />
      </mesh>
      <mesh position={[0, TABLE_TOP / 2 - 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, TABLE_TOP - 0.04, 16]} />
        <meshStandardMaterial color="#4a2f1c" />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.4, 0.45, 0.04, 32]} />
        <meshStandardMaterial color="#4a2f1c" />
      </mesh>
    </group>
  );
}

/** De 3D-tafel. Je eigen hand en de knoppen blijven HTML erbovenop. */
export default function Scene3D(props: Scene3DProps) {
  const reduced = useMemo(
    () =>
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const tags = useRef<(HTMLDivElement | null)[]>([]);
  return (
    <div className="scene3d" role="region" aria-label={props.label}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 1.36, 1.42], fov: 52, near: 0.05, far: 30 }}
      >
        <CameraRig reduced={reduced} />
        <Room />
        <Table />
        <TrickCards trick={props.trick} winner={props.winner} />
        {BOTS.map((seat) => (
          <Character3D
            key={seat}
            seat={seat}
            cards={props.handCounts[seat - 1]!}
            thinking={props.thinking === seat}
            gesture={props.gesture?.seat === seat ? props.gesture.gesture : null}
            nod={props.nodSeat === seat}
            reduced={reduced}
          />
        ))}
        <TagProjector tags={tags} />
      </Canvas>

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
              {nl.players[seat]}
              {props.dealer === seat && ` (${nl.dealer})`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
