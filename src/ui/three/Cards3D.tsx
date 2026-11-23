import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Euler, Quaternion, Vector3, type Group } from 'three';
import { cardId, type Card, type PlayedCard, type Seat, type Trick } from '../../engine';
import { CARD_H, CARD_W, edgeFor, spotFor, tiltFor, type Vec3 } from './layout';
import { cardTexture } from './textures';

interface CardProps {
  card: Card;
  from: Vec3;
  to: Vec3;
  yaw: number;
  /** Bij weggaan: kleiner worden. */
  shrink?: boolean;
}

/** Kaart die plat op tafel ligt en soepel van `from` naar `to` glijdt. */
function FlatCard({ card, from, to, yaw, shrink }: CardProps) {
  const ref = useRef<Group>(null);
  const start = useMemo(() => from, []); // eslint-disable-line react-hooks/exhaustive-deps
  const target = useMemo(() => new Vector3(...to), [to[0], to[1], to[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const targetRot = useMemo(() => new Quaternion().setFromEuler(new Euler(0, yaw, 0)), [yaw]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.exp(-dt * 9);
    g.position.lerp(target, k);
    g.quaternion.slerp(targetRot, k);
    if (shrink) g.scale.setScalar(g.scale.x + (0.6 - g.scale.x) * k);
  });

  return (
    <group ref={ref} position={start}>
      <mesh rotation-x={-Math.PI / 2} castShadow receiveShadow>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial map={cardTexture(card)} roughness={0.6} />
      </mesh>
      <mesh rotation-x={Math.PI / 2}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial map={cardTexture(null)} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** De slag op het kleed. Na afloop schuiven de kaarten naar wie hem pakte. */
export function TrickCards({ trick, winner }: { trick: Trick | undefined; winner: Seat | null }) {
  const [leaving, setLeaving] = useState<{ cards: PlayedCard[]; to: Seat; id: number } | null>(
    null,
  );
  const prev = useRef<Trick | undefined>(undefined);

  useEffect(() => {
    const p = prev.current;
    prev.current = trick;
    if (p && p.cards.length > 0 && (!trick || trick.cards.length === 0) && winner !== null) {
      setLeaving({ cards: p.cards, to: winner, id: Date.now() });
    }
  }, [trick, winner]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(null), 700);
    return () => clearTimeout(t);
  }, [leaving]);

  return (
    <>
      {trick?.cards.map((pc, i) => (
        <FlatCard
          key={cardId(pc.card)}
          card={pc.card}
          from={edgeFor(pc.seat)}
          to={spotFor(pc.seat, i)}
          yaw={tiltFor(cardId(pc.card))}
        />
      ))}
      {leaving?.cards.map((pc, i) => (
        <FlatCard
          key={`${cardId(pc.card)}-${leaving.id}`}
          card={pc.card}
          from={spotFor(pc.seat, i)}
          to={edgeFor(leaving.to)}
          yaw={tiltFor(cardId(pc.card))}
          shrink
        />
      ))}
    </>
  );
}
