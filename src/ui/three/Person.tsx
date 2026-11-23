import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cardId, sameCard, type Card } from '../../engine';
import { twoBoneIK } from './ik';
import {
  AnimationMixer,
  DoubleSide,
  LoopRepeat,
  Quaternion,
  Vector3,
  type AnimationAction,
  type Group,
  type Mesh,
} from 'three';
import type { Gesture, Seat } from '../../engine';
import { HELD_H, HELD_W, seatPose, TABLE_TOP } from './layout';
import {
  findBone,
  lowerFor,
  usePerson,
  type AnimKey,
  type ClipSet,
  type PersonKey,
} from './models';
import { cardTexture } from './textures';

const FADE = 0.35;
const SKIN: Record<PersonKey, string> = { ria: '#e9c2a6', henk: '#e2b497', sjaak: '#e6bc9e' };

export interface PersonProps {
  who: PersonKey;
  seat: Seat;
  clips: ClipSet;
  body: AnimKey;
  head: AnimKey;
  /** Aantal kaarten in de hand (de achterkant is zichtbaar). */
  cards: number;
  gesture: Gesture | null;
  /** Jij: geen hoofd, en de camera zit op je ogen. */
  isPlayer?: boolean;
  /** Alleen voor jou: je eigen kaarten, welke je mag spelen, en wat er gebeurt bij klikken. */
  myCards?: Card[];
  playable?: Card[];
  onPlay?: (card: Card) => void;
}

const MY_W = 0.072;
const MY_H = 0.1;

function useLayer(
  mixer: AnimationMixer,
  clips: Record<AnimKey, import('three').AnimationClip>,
  key: AnimKey,
) {
  const current = useRef<AnimationAction | null>(null);
  useEffect(() => {
    const next = mixer.clipAction(clips[key]);
    next.setLoop(LoopRepeat, Infinity);
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (current.current && current.current !== next) {
      next.reset().play();
      current.current.crossFadeTo(next, FADE, false);
    } else next.play();
    current.current = next;
  }, [mixer, clips, key]);
}

/** Een echt mens aan tafel: zit, houdt kaarten vast, praat, lacht, knikt en seint. */
export function Person({
  who,
  seat,
  clips,
  body,
  head,
  cards,
  gesture,
  isPlayer,
  myCards,
  playable,
  onPlay,
}: PersonProps) {
  const { scene: model, hipsRatio } = usePerson(who);
  const { position, rotationY } = seatPose(seat);
  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  const lowerClip = useMemo(() => lowerFor(clips.lower, hipsRatio), [clips.lower, hipsRatio]);
  const bones = useMemo(
    () => ({
      head: findBone(model, 'Head'),
      left: findBone(model, 'LeftHand'),
      right: findBone(model, 'RightHand'),
      armL: findBone(model, 'LeftArm'),
      foreL: findBone(model, 'LeftForeArm'),
      armR: findBone(model, 'RightArm'),
      foreR: findBone(model, 'RightForeArm'),
    }),
    [model],
  );
  const ikWeight = useRef(0);
  const held = useRef<Group>(null);
  const mine = useRef<Group>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const lidL = useRef<Mesh>(null);
  const lidR = useRef<Mesh>(null);
  const brows = useRef<Group>(null);
  const flip = useRef<Mesh>(null);
  const gestureStart = useRef(0);
  const { camera } = useThree();
  const tmp = useMemo(
    () => ({
      a: new Vector3(),
      b: new Vector3(),
      q: new Quaternion(),
      eye: new Vector3(),
      fwd: new Vector3(),
      side: new Vector3(),
      chest: new Vector3(),
      target: new Vector3(),
      pole: new Vector3(),
    }),
    [],
  );

  useEffect(() => {
    const lower = mixer.clipAction(lowerClip);
    lower.setLoop(LoopRepeat, Infinity).play();
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer, lowerClip]);
  useLayer(mixer, clips.body, body);
  useLayer(mixer, clips.head, head);

  useEffect(() => {
    if (gesture) gestureStart.current = performance.now();
  }, [gesture]);

  useFrame((_, dt) => {
    mixer.update(Math.min(dt, 0.1));
    model.updateMatrixWorld(true);
    const { a, b, q, eye } = tmp;

    // Handen naar de borst, boven tafel, als je kaarten vasthoudt (IK, zacht in- en uitgeblend).
    ikWeight.current += ((body === 'hold' ? 1 : 0) - ikWeight.current) * Math.min(1, dt * 6);
    const w = ikWeight.current;
    const { armL, foreL, left, armR, foreR, right } = bones;
    if (w > 0.01 && armL && foreL && left && armR && foreR && right) {
      const fwd = tmp.fwd.set(Math.sin(rotationY), 0, Math.cos(rotationY));
      const side = tmp.side.set(-Math.cos(rotationY), 0, Math.sin(rotationY)); // jouw rechts
      const reach = isPlayer ? 0.27 : 0.3;
      const height = isPlayer ? 0.97 : 0.95;
      const chest = tmp.chest.set(position[0], height, position[2]).addScaledVector(fwd, reach);
      const saved = [armL, foreL, armR, foreR].map((bn) => bn.quaternion.clone());
      for (const [arm, fore, hand, s] of [
        [armR, foreR, right, 1],
        [armL, foreL, left, -1],
      ] as const) {
        const target = tmp.target.copy(chest).addScaledVector(side, 0.055 * s);
        arm.getWorldPosition(tmp.pole);
        tmp.pole.addScaledVector(side, 0.35 * s).addScaledVector(fwd, -0.1).y -= 0.5;
        twoBoneIK(arm, fore, hand, target, tmp.pole);
      }
      [armL, foreL, armR, foreR].forEach((bn, i) => {
        const ik = bn.quaternion.clone();
        bn.quaternion.copy(saved[i]!).slerp(ik, w);
      });
      model.updateMatrixWorld(true);
    }
    const gp = (performance.now() - gestureStart.current) / 1300;
    const g = gesture && gp < 1 ? gesture : null;
    const env = g ? Math.sin(Math.PI * gp) : 0;

    // Kaarten in de hand: tussen beide handen, naar het eigen gezicht gericht.
    if (held.current && bones.left && bones.right && bones.head) {
      bones.left.getWorldPosition(a);
      bones.right.getWorldPosition(b);
      a.lerp(b, 0.5);
      held.current.position.copy(a);
      bones.head.getWorldPosition(b);
      held.current.lookAt(b);
    }

    // Ooglid en wenkbrauwen voor knipoog en wenkbrauw-sein.
    if (bones.head) {
      bones.head.getWorldPosition(a);
      bones.head.getWorldQuaternion(q);
      const place = (m: Mesh | Group | null, x: number, y: number, z: number) => {
        if (!m) return;
        eye.set(x, y, z).applyQuaternion(q).add(a);
        m.position.copy(eye);
        m.quaternion.copy(q);
      };
      place(lidR.current, -0.031, 0.075, 0.088);
      place(lidL.current, 0.031, 0.075, 0.088);
      place(brows.current, 0, 0.098 + (g === 'wenkbrauw' ? 0.01 * env : 0), 0.09);
      if (lidR.current) lidR.current.visible = g === 'knipoog' && env > 0.25;
      if (lidL.current) lidL.current.visible = false;
      if (brows.current) brows.current.visible = g === 'wenkbrauw';
    }
    if (flip.current && bones.right) {
      flip.current.visible = g === 'rugkaart';
      bones.right.getWorldPosition(a);
      flip.current.position.set(a.x, Math.max(a.y, TABLE_TOP + 0.06), a.z);
      flip.current.rotation.set(-Math.PI / 2 + gp * Math.PI * 2, 0, rotationY);
    }

    if (isPlayer && bones.head) {
      // Jouw ogen: net voor en boven het hoofdbot. Het hoofd zelf is verborgen.
      // Ogen: ~10 cm boven het hoofdbot en iets naar voren (jij kijkt richting -z).
      bones.head.getWorldPosition(a);
      eye.set(a.x, a.y + 0.1, a.z - 0.08);
      camera.position.lerp(eye, 0.5);
      camera.lookAt(0, TABLE_TOP - 0.05, -0.05);
      bones.head.scale.setScalar(0.001);
    }

    // Jouw kaarten: tussen je handen, naar je ogen gericht.
    if (isPlayer && mine.current && bones.left && bones.right) {
      bones.left.getWorldPosition(a);
      bones.right.getWorldPosition(b);
      a.lerp(b, 0.5);
      a.y += 0.05;
      mine.current.position.copy(a);
      mine.current.lookAt(camera.position);
    }
  });

  const back = cardTexture(null);
  const spread = Math.min(0.16, 0.9 / Math.max(cards, 1));

  return (
    <>
      <group position={position} rotation-y={rotationY}>
        <primitive object={model} />
      </group>

      {isPlayer && myCards && (
        <group ref={mine}>
          {myCards.map((card, i) => {
            const n = myCards.length;
            const ang = (i - (n - 1) / 2) * Math.min(0.2, 1.4 / Math.max(n, 1));
            const id = cardId(card);
            const can = !!playable?.some((c) => sameCard(c, card));
            const lift = hovered === id && can ? 0.025 : 0;
            return (
              <mesh
                key={id}
                position={[Math.sin(ang) * 0.13, Math.cos(ang) * 0.13 - 0.1 + lift, i * 0.0012]}
                rotation-z={-ang}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHovered(id);
                  document.body.style.cursor = can ? 'pointer' : '';
                }}
                onPointerOut={() => {
                  setHovered(null);
                  document.body.style.cursor = '';
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (can) onPlay?.(card);
                }}
              >
                <planeGeometry args={[MY_W, MY_H]} />
                <meshStandardMaterial
                  map={cardTexture(card)}
                  side={DoubleSide}
                  roughness={0.6}
                  emissive={can ? '#5a4100' : '#000000'}
                  emissiveIntensity={can ? 0.6 : 0}
                  color={playable && playable.length > 0 && !can ? '#9a9a9a' : '#ffffff'}
                />
              </mesh>
            );
          })}
        </group>
      )}

      {!isPlayer && cards > 0 && (
        <group ref={held}>
          {Array.from({ length: cards }, (_, i) => {
            const ang = (i - (cards - 1) / 2) * spread;
            return (
              <mesh
                key={i}
                position={[Math.sin(ang) * 0.06, Math.cos(ang) * 0.06 - 0.02, -0.02 - i * 0.0015]}
                rotation-z={-ang}
              >
                <planeGeometry args={[HELD_W, HELD_H]} />
                <meshStandardMaterial map={back} side={DoubleSide} roughness={0.7} />
              </mesh>
            );
          })}
        </group>
      )}

      {!isPlayer && (
        <>
          <mesh ref={lidL} visible={false} scale={[1, 0.55, 0.4]}>
            <sphereGeometry args={[0.013, 10, 8]} />
            <meshStandardMaterial color={SKIN[who]} roughness={0.8} />
          </mesh>
          <mesh ref={lidR} visible={false} scale={[1, 0.55, 0.4]}>
            <sphereGeometry args={[0.013, 10, 8]} />
            <meshStandardMaterial color={SKIN[who]} roughness={0.8} />
          </mesh>
          <group ref={brows} visible={false}>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.032, 0, 0]}>
                <boxGeometry args={[0.03, 0.005, 0.004]} />
                <meshStandardMaterial color="#3b2a1e" />
              </mesh>
            ))}
          </group>
          <mesh ref={flip} visible={false}>
            <planeGeometry args={[HELD_W, HELD_H]} />
            <meshStandardMaterial map={back} side={DoubleSide} />
          </mesh>
        </>
      )}
    </>
  );
}
