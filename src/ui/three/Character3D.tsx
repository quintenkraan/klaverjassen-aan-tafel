import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group, Mesh } from 'three';
import type { Gesture, Seat } from '../../engine';
import { HeldCards } from './Cards3D';
import { seatPose, TABLE_TOP } from './layout';
import { cardTexture } from './textures';

type Look = { skin: string; hair: string; shirt: string; style: 'curls' | 'bald' | 'cap' };

const LOOKS: Record<Exclude<Seat, 0>, Look> = {
  1: { skin: '#f1c7a5', hair: '#8a4f2a', shirt: '#7b3fa0', style: 'curls' },
  2: { skin: '#e8b996', hair: '#a8a8a8', shirt: '#2f6db3', style: 'bald' },
  3: { skin: '#d39b74', hair: '#262626', shirt: '#b8392b', style: 'cap' },
};

const GESTURE_MS = 1300;
export const HEAD_Y = 1.44;

interface Props {
  seat: Exclude<Seat, 0>;
  cards: number;
  thinking: boolean;
  gesture: Gesture | null;
  nod: boolean;
  reduced: boolean;
}

function Hair({ look }: { look: Look }) {
  const m = <meshStandardMaterial color={look.hair} roughness={0.9} />;
  if (look.style === 'curls') {
    return (
      <>
        {[-0.08, -0.04, 0, 0.04, 0.08].map((x, i) => (
          <mesh key={x} position={[x, 0.1 + (i % 2) * 0.02, -0.02]}>
            <sphereGeometry args={[0.055, 12, 10]} />
            {m}
          </mesh>
        ))}
      </>
    );
  }
  if (look.style === 'bald') {
    return (
      <>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.125, 0, -0.01]} scale={[0.4, 0.8, 0.8]}>
            <sphereGeometry args={[0.05, 10, 8]} />
            {m}
          </mesh>
        ))}
        {/* Snor */}
        <mesh position={[0, -0.04, 0.125]} scale={[1.6, 0.45, 0.6]}>
          <sphereGeometry args={[0.03, 10, 8]} />
          {m}
        </mesh>
      </>
    );
  }
  return (
    <>
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.138, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {m}
      </mesh>
      <mesh position={[0, 0.03, 0.15]}>
        <boxGeometry args={[0.16, 0.012, 0.09]} />
        {m}
      </mesh>
    </>
  );
}

/** Tafelgenoot in 3D: knippert, denkt na, maakt gebaren. Naam en ballon zijn HTML (Scene3D). */
export function Character3D({ seat, cards, thinking, gesture, nod, reduced }: Props) {
  const look = LOOKS[seat];
  const { position, rotationY } = seatPose(seat);
  const head = useRef<Group>(null);
  const eyeL = useRef<Mesh>(null);
  const eyeR = useRef<Mesh>(null);
  const brows = useRef<Group>(null);
  const hand = useRef<Mesh>(null);
  const flip = useRef<Mesh>(null);
  const gestureStart = useRef(0);
  const nodStart = useRef(0);

  useEffect(() => {
    if (gesture) gestureStart.current = performance.now();
  }, [gesture]);
  useEffect(() => {
    if (nod) nodStart.current = performance.now();
  }, [nod]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const now = performance.now();
    const gp = (now - gestureStart.current) / GESTURE_MS;
    const g = gesture && gp < 1 ? gesture : null;
    const env = g ? Math.sin(Math.PI * gp) : 0;

    const blink = !reduced && (t + seat * 1.3) % 4.2 < 0.12;
    if (eyeL.current) eyeL.current.scale.y = blink ? 0.1 : 1;
    if (eyeR.current) eyeR.current.scale.y = blink || (g === 'knipoog' && env > 0.3) ? 0.1 : 1;
    if (brows.current) brows.current.position.y = 0.065 + (g === 'wenkbrauw' ? 0.025 * env : 0);

    if (head.current) {
      const np = (now - nodStart.current) / 900;
      const nodding = np < 1 ? Math.sin(np * Math.PI * 4) * 0.18 : 0;
      head.current.rotation.x = nodding + (thinking ? 0.18 : 0.05);
      head.current.rotation.z = thinking && !reduced ? Math.sin(t * 2) * 0.08 : 0;
    }

    if (hand.current) {
      const h = hand.current;
      h.visible = g === 'tikken' || g === 'oorkrabben' || g === 'keelschrapen';
      // Handposities in het assenstelsel van de speler (kijkt naar +z).
      if (g === 'tikken')
        h.position.set(0.12, TABLE_TOP + 0.03 + Math.abs(Math.sin(gp * Math.PI * 6)) * 0.07, 0.38);
      if (g === 'oorkrabben') h.position.set(0.15, HEAD_Y + Math.sin(t * 25) * 0.015, 0);
      if (g === 'keelschrapen') h.position.set(0.02, HEAD_Y - 0.12, 0.13);
    }
    if (flip.current) {
      flip.current.visible = g === 'rugkaart';
      flip.current.rotation.y = gp * Math.PI * 2;
    }
  });

  return (
    <group position={position} rotation-y={rotationY}>
      {/* Stoel */}
      <mesh position={[0, 0.45, -0.12]} castShadow>
        <boxGeometry args={[0.45, 0.06, 0.45]} />
        <meshStandardMaterial color="#4a2f1c" />
      </mesh>
      <mesh position={[0, 0.85, -0.33]} castShadow>
        <boxGeometry args={[0.45, 0.8, 0.05]} />
        <meshStandardMaterial color="#4a2f1c" />
      </mesh>
      {/* Lijf */}
      <mesh position={[0, 1.02, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.32, 6, 16]} />
        <meshStandardMaterial color={look.shirt} roughness={0.85} />
      </mesh>
      {/* Hoofd */}
      <group ref={head} position={[0, HEAD_Y - 0.12, 0]}>
        <group position={[0, 0.12, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.13, 24, 20]} />
            <meshStandardMaterial color={look.skin} roughness={0.7} />
          </mesh>
          <Hair look={look} />
          <group ref={brows} position={[0, 0.065, 0.118]}>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.045, 0, 0]} rotation-z={s * -0.12}>
                <boxGeometry args={[0.04, 0.008, 0.01]} />
                <meshStandardMaterial color="#4a3020" />
              </mesh>
            ))}
          </group>
          <mesh ref={eyeL} position={[-0.045, 0.02, 0.118]}>
            <sphereGeometry args={[0.014, 10, 8]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh ref={eyeR} position={[0.045, 0.02, 0.118]}>
            <sphereGeometry args={[0.014, 10, 8]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[0, -0.06, 0.12]}>
            <boxGeometry args={[0.05, 0.008, 0.01]} />
            <meshStandardMaterial color="#6b3b2a" />
          </mesh>
        </group>
      </group>

      <HeldCards count={cards} />

      {/* Hand voor gebaren, en de kaart die met de rug van de hand wordt omgedraaid */}
      <mesh ref={hand} visible={false}>
        <sphereGeometry args={[0.04, 12, 10]} />
        <meshStandardMaterial color={look.skin} />
      </mesh>
      <mesh ref={flip} visible={false} position={[0.22, TABLE_TOP + 0.08, 0.35]}>
        <planeGeometry args={[0.07, 0.1]} />
        <meshStandardMaterial map={cardTexture(null)} side={2} />
      </mesh>
    </group>
  );
}
