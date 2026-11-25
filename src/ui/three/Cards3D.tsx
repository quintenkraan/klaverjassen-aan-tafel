import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Euler, PlaneGeometry, Quaternion, Vector3, type Group } from 'three';
import { cardId, type Card, type PlayedCard, type Seat, type Trick } from '../../engine';
import { CARD_H, CARD_W, edgeFor, spotFor, tiltFor, type Vec3 } from './layout';
import { handOrigin, seatHands } from './handOrigin';
import { cardTexture } from './textures';

/** Kaart in je hand kijkt naar je toe (+z); een kaart op tafel ligt plat (voorkant +y). */
const FACE_UP_FIX = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);

interface CardProps {
  card: Card;
  from: Vec3;
  to: Vec3;
  yaw: number;
  /** Bij weggaan: kleiner worden. */
  shrink?: boolean;
  /** Begindraaiing (jouw kaart: zoals hij in je hand zat). */
  fromQuat?: Quaternion;
}

/** Een echte speelkaart is nooit helemaal plat: de lange randen staan iets omhoog. */
function bentCard(sign: 1 | -1) {
  const g = new PlaneGeometry(CARD_W, CARD_H, 8, 2);
  const pos = g.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (CARD_W / 2);
    pos.setZ(i, sign * 0.0016 * x * x);
  }
  g.computeVertexNormals();
  return g;
}
const FRONT = bentCard(1);
const BACK = bentCard(-1);

/** Kaart die plat op tafel ligt en soepel van `from` naar `to` glijdt. */
function FlatCard({ card, from, to, yaw, shrink, fromQuat }: CardProps) {
  const ref = useRef<Group>(null);
  const start = useMemo(() => from, []); // eslint-disable-line react-hooks/exhaustive-deps
  const target = useMemo(() => new Vector3(...to), [to[0], to[1], to[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const targetRot = useMemo(() => new Quaternion().setFromEuler(new Euler(0, yaw, 0)), [yaw]);
  const startRot = useMemo(() => fromQuat?.clone(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (startRot && ref.current) ref.current.quaternion.copy(startRot);
  }, [startRot]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    // Jouw kaart (uit je hand) iets rustiger, zodat je hem ziet gaan.
    const k = 1 - Math.exp(-dt * (startRot ? 5 : 9));
    g.position.lerp(target, k);
    g.quaternion.slerp(targetRot, k);
    if (shrink) g.scale.setScalar(g.scale.x + (0.6 - g.scale.x) * k);
  });

  return (
    <group ref={ref} position={start}>
      <mesh rotation-x={-Math.PI / 2} geometry={FRONT} castShadow receiveShadow>
        <meshStandardMaterial map={cardTexture(card)} roughness={0.45} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} geometry={BACK} castShadow>
        <meshStandardMaterial map={cardTexture(null)} roughness={0.45} />
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
      {trick?.cards.map((pc, i) => {
        // Jouw kaart komt uit je waaier: zelfde plek en stand als in je hand.
        const hand = pc.seat === 0 ? handOrigin.get(cardId(pc.card)) : undefined;
        return (
          <FlatCard
            key={cardId(pc.card)}
            card={pc.card}
            from={
              hand
                ? (hand.pos.toArray() as Vec3)
                : ((seatHands.get(pc.seat)?.toArray() as Vec3 | undefined) ?? edgeFor(pc.seat))
            }
            fromQuat={hand ? hand.quat.clone().multiply(FACE_UP_FIX) : undefined}
            to={spotFor(pc.seat, i)}
            yaw={tiltFor(cardId(pc.card))}
          />
        );
      })}
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
