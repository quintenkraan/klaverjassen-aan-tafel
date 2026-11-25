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
  type Object3D,
} from 'three';
import { handOrigin, seatHands } from './handOrigin';
import type { Gesture, Seat } from '../../engine';
import { HELD_H, HELD_W, LOOK_AT, seatPose, TABLE_TOP, type Vec3 } from './layout';
import { look, lookStep } from './look';
import {
  findBone,
  lowerFor,
  usePerson,
  type AnimKey,
  type ClipSet,
  type PersonKey,
} from './models';
import { blurredFaceTexture, cardTexture } from './textures';

const FADE = 0.35;
/** Hoe ver de vingers krullen als iemand kaarten vasthoudt (radialen per kootje). */
const GRIP = 0.9;
const X_AXIS = new Vector3(1, 0, 0);

/**
 * Vingers met een vaste greep-stand (rusthouding + krul), één keer uitgerekend. Elk beeld zetten
 * we die stand opnieuw: niet "een stukje erbij", want dan draaien de vingers steeds verder door.
 */
function collectFingers(model: Object3D): { bone: Object3D; grip: Quaternion }[] {
  const out: { bone: Object3D; grip: Quaternion }[] = [];
  model.traverse((o) => {
    const m = /^(Left|Right)Hand(Index|Middle|Ring|Pinky)\d$/.exec(o.name);
    if (!m) return;
    const curl = new Quaternion().setFromAxisAngle(X_AXIS, GRIP * (m[1] === 'Left' ? 1 : -1));
    out.push({ bone: o, grip: o.quaternion.clone().multiply(curl) });
  });
  return out;
}
const SKIN: Record<PersonKey, string> = {
  ria: '#e9c2a6',
  henk: '#e2b497',
  sjaak: '#e6bc9e',
  joe: '#d9a98a',
  av1: '#e3b89c',
  av2: '#e3b89c',
  av3: '#e3b89c',
  michelle: '#e7bea2',
};

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
  /** Alleen voor jou: wie er praat; je kijkt dan even die kant op (als je zelf niet rondkijkt). */
  attention?: Seat | null;
  /** Reiken met de rechterhand naar een plek op tafel (kaart leggen, slag pakken). */
  reach?: { id: number; to: Vec3 } | null;
}

/** Hoe lang reiken duurt (heen en terug), in ms. */
const REACH_MS = 950;

const MY_W = 0.072;
const MY_H = 0.1;

function useLayer(
  mixer: AnimationMixer,
  clips: Record<AnimKey, import('three').AnimationClip>,
  key: AnimKey,
  /** Stil: de houding van het eerste beeld vasthouden (voor jou: geen wiebelende armen). */
  still = false,
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
    // Stil = tijd staat stil, maar de houding wordt wél elk beeld toegepast. (Met `paused`
    // past three.js hem niet meer toe en blijven armen en vingers in een tussenstand hangen.)
    next.paused = false;
    next.timeScale = still ? 0 : 1;
    current.current = next;
  }, [mixer, clips, key, still]);
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
  attention = null,
  reach = null,
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
      /** Vingers (zonder duim): die krullen om de kaarten als je ze vasthoudt. */
      fingers: collectFingers(model),
    }),
    [model],
  );
  const myMeshes = useRef<(Mesh | null)[]>([]);
  const ikWeight = useRef(0);
  const eyeSmooth = useRef<Vector3 | null>(null);
  const auto = useRef({ yaw: 0, pitch: 0 });
  const reachState = useRef<{ start: number; to: Vector3 } | null>(null);
  useEffect(() => {
    if (reach) reachState.current = { start: performance.now(), to: new Vector3(...reach.to) };
  }, [reach?.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
    // Aan tafel zit iedereen stil: heupen wiebelen niet, anders schuiven schouders en handen mee.
    lower.paused = false;
    lower.timeScale = 0;
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer, lowerClip]);
  // Kaarten vasthouden = armen stil (jij altijd; de anderen behalve bij een sein-gebaar).
  useLayer(mixer, clips.body, body, true);
  useLayer(mixer, clips.head, head, isPlayer);

  useEffect(() => {
    if (gesture) gestureStart.current = performance.now();
  }, [gesture]);

  useFrame((_, dt) => {
    mixer.update(Math.min(dt, 0.1));
    model.updateMatrixWorld(true);
    const { a, b, q, eye } = tmp;

    // Handen naar de borst, boven tafel, als je kaarten vasthoudt (IK, zacht in- en uitgeblend).
    const rs = reachState.current;
    const rp = rs ? (performance.now() - rs.start) / REACH_MS : 1;
    if (rs && rp >= 1) reachState.current = null;
    // Iedereen aan tafel houdt altijd zijn kaarten vast: handen alleen weg om een kaart te leggen.
    const wantIk = true;
    ikWeight.current += ((wantIk ? 1 : 0) - ikWeight.current) * Math.min(1, dt * 6);
    const w = ikWeight.current;
    const { armL, foreL, left, armR, foreR, right } = bones;
    if (w > 0.01 && armL && foreL && left && armR && foreR && right) {
      const fwd = tmp.fwd.set(Math.sin(rotationY), 0, Math.cos(rotationY));
      const side = tmp.side.set(-Math.cos(rotationY), 0, Math.sin(rotationY)); // jouw rechts
      const reach = isPlayer ? 0.32 : 0.32;
      const height = isPlayer ? 0.96 : 0.95;
      const chest = tmp.chest.set(position[0], height, position[2]).addScaledVector(fwd, reach);
      const saved = [armL, foreL, armR, foreR].map((bn) => bn.quaternion.clone());
      for (const [arm, fore, hand, s] of [
        [armR, foreR, right, 1],
        [armL, foreL, left, -1],
      ] as const) {
        // Jij houdt de waaier in je linkerhand; je rechterhand zit ernaast, iets lager en naar
        // voren, klaar om een kaart te pakken. De anderen houden hem tussen beide handen.
        const target = tmp.target.copy(chest);
        if (!isPlayer) target.addScaledVector(side, 0.055 * s);
        else if (s < 0) target.addScaledVector(side, -0.07);
        else target.addScaledVector(side, 0.11).addScaledVector(fwd, 0.03).y -= 0.035;
        // Reiken: de rechterhand gaat naar tafel en terug (zachte boog).
        if (s > 0 && rs && rp < 1) {
          const env = Math.sin(Math.PI * Math.min(1, rp));
          target.lerp(rs.to, env);
          target.y += Math.sin(Math.PI * rp) * 0.03;
        }
        arm.getWorldPosition(tmp.pole);
        tmp.pole.addScaledVector(side, 0.35 * s).addScaledVector(fwd, -0.1).y -= 0.5;
        twoBoneIK(arm, fore, hand, target, tmp.pole);
      }
      [armL, foreL, armR, foreR].forEach((bn, i) => {
        const ik = bn.quaternion.clone();
        bn.quaternion.copy(saved[i]!).slerp(ik, w);
      });
      // Echte greep: vingers om de kaarten heen gekruld, achter de waaier.
      // Echte greep: vaste vingerstand om de kaarten.
      for (const f of bones.fingers) f.bone.quaternion.copy(f.grip);
      model.updateMatrixWorld(true);
    }
    if (!isPlayer && bones.right) {
      const h = seatHands.get(seat) ?? new Vector3();
      bones.right.getWorldPosition(h);
      seatHands.set(seat, h);
    }
    const gp = (performance.now() - gestureStart.current) / 1300;
    const g = gesture && gp < 1 ? gesture : null;
    const env = g ? Math.sin(Math.PI * gp) : 0;

    // Kaarten in de hand: tussen beide handen, rechtop, voorkant naar de eigen ogen (iets
    // achterover). Vaste draaiing per stoel, zodat de waaier nooit kantelt of op de kop staat.
    if (held.current && bones.left && bones.right) {
      bones.left.getWorldPosition(a);
      bones.right.getWorldPosition(b);
      a.lerp(b, 0.5);
      // Hoger en iets van het lijf af: handen pakken de onderkant, niet vóór de waaier.
      a.y += 0.05;
      a.x += Math.sin(rotationY) * 0.025;
      a.z += Math.cos(rotationY) * 0.025;
      held.current.position.copy(a);
      held.current.rotation.set(-0.45, rotationY + Math.PI, 0, 'YXZ');
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
      // Jouw ogen: ~10 cm boven het hoofdbot en iets naar voren. Het hoofd zelf is verborgen.
      bones.head.getWorldPosition(a);
      eye.set(a.x + Math.sin(rotationY) * 0.08, a.y + 0.1, a.z + Math.cos(rotationY) * 0.08);
      // Rustig: het hoofdbot wiebelt mee met de animatie, je ogen volgen dat maar heel traag.
      if (!eyeSmooth.current) eyeSmooth.current = eye.clone();
      eyeSmooth.current.lerp(eye, 1 - Math.exp(-dt * 1.5));
      const t = performance.now() / 1000;
      camera.position.copy(eyeSmooth.current);
      camera.position.y += Math.sin(t * 1.3) * 0.0012; // heel licht ademhalen
      // Standaard kijk je naar de tafel; slepen draait je hoofd (look.ts).
      lookStep(dt);
      const dx = LOOK_AT[0] - camera.position.x;
      const dy = LOOK_AT[1] - camera.position.y;
      const dz = LOOK_AT[2] - camera.position.z;
      const baseYaw = Math.atan2(dx, dz);
      const basePitch = Math.atan2(dy, Math.hypot(dx, dz));
      // Praat iemand, en kijk je zelf niet rond? Dan kijk je even op, die kant op.
      let wantYaw = 0;
      let wantPitch = 0;
      if (attention !== null && attention !== 0 && Math.abs(look.targetYaw) < 0.05) {
        const sp = seatPose(attention).position;
        const sx = sp[0] - camera.position.x;
        const sz = sp[2] - camera.position.z;
        const sy = 1.15 - camera.position.y;
        let dyaw = Math.atan2(sx, sz) - baseYaw;
        dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
        wantYaw = dyaw * 0.3;
        wantPitch = (Math.atan2(sy, Math.hypot(sx, sz)) - basePitch) * 0.3;
      }
      const ka = 1 - Math.exp(-dt * 1.2);
      auto.current.yaw += (wantYaw - auto.current.yaw) * ka;
      auto.current.pitch += (wantPitch - auto.current.pitch) * ka;
      const yaw = baseYaw + look.yaw + auto.current.yaw;
      const pitch = basePitch + look.pitch + auto.current.pitch;
      b.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      camera.lookAt(b.add(camera.position));
      bones.head.scale.setScalar(0.001);
    }

    // Jouw kaarten: waaier vanuit je linkerhand, naar je ogen gericht.
    if (isPlayer && mine.current && bones.left && bones.right) {
      bones.left.getWorldPosition(a);
      bones.right.getWorldPosition(b);
      a.lerp(b, 0.25);
      a.y += 0.06;
      // Iets vóór je handen: je vingers zitten achter de waaier en steken er niet doorheen.
      tmp.target.subVectors(a, camera.position).normalize();
      a.addScaledVector(tmp.target, -0.04);
      mine.current.position.copy(a);
      mine.current.lookAt(camera.position);
      // Onthoud waar elke kaart zit, zodat een gespeelde kaart uit je waaier naar tafel gaat.
      mine.current.updateMatrixWorld(true);
      myMeshes.current.forEach((m, i) => {
        const card = myCards?.[i];
        if (!m || !card) return;
        const o = handOrigin.get(cardId(card)) ?? { pos: new Vector3(), quat: new Quaternion() };
        m.getWorldPosition(o.pos);
        m.getWorldQuaternion(o.quat);
        handOrigin.set(cardId(card), o);
      });
    }
  });

  const back = cardTexture(null);
  const face = blurredFaceTexture();
  const spread = Math.min(0.16, 0.9 / Math.max(cards, 1));

  return (
    <>
      <group position={position} rotation-y={rotationY}>
        <primitive object={model} />
      </group>

      {isPlayer && myCards && (
        <group ref={mine}>
          {/* De waaier gaat vanuit je linkerhand naar rechts open */}
          <group position-x={0.035} rotation-z={-0.22}>
            {myCards.map((card, i) => {
              const n = myCards.length;
              const ang = (i - (n - 1) / 2) * Math.min(0.2, 1.4 / Math.max(n, 1));
              const id = cardId(card);
              const can = !!playable?.some((c) => sameCard(c, card));
              const lift = hovered === id && can ? 0.025 : 0;
              return (
                <mesh
                  key={id}
                  ref={(m) => {
                    myMeshes.current[i] = m;
                  }}
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
                    color={playable && playable.length > 0 && !can ? '#5a5a5a' : '#ffffff'}
                  />
                </mesh>
              );
            })}
          </group>
        </group>
      )}

      {!isPlayer && cards > 0 && (
        <group ref={held}>
          {Array.from({ length: cards }, (_, i) => {
            const ang = (i - (cards - 1) / 2) * spread;
            return (
              <group
                key={i}
                position={[Math.sin(ang) * 0.06, Math.cos(ang) * 0.06 - 0.02, -0.02 - i * 0.0015]}
                rotation-z={-ang}
              >
                {/* Voorkant naar de speler zelf (onleesbaar), rug naar de rest van de tafel */}
                <mesh>
                  <planeGeometry args={[HELD_W, HELD_H]} />
                  <meshStandardMaterial map={face} roughness={0.7} />
                </mesh>
                <mesh rotation-y={Math.PI} position-z={-0.0004}>
                  <planeGeometry args={[HELD_W, HELD_H]} />
                  <meshStandardMaterial map={back} roughness={0.7} />
                </mesh>
              </group>
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
