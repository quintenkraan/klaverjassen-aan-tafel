import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AnimationMixer,
  Color,
  LoopRepeat,
  Quaternion,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
} from 'three';
import { createRng } from '../../engine';
import { twoBoneIK } from './ik';
import { BAR } from './layout';
import { findBone, movesFor, usePerson, type ClipSet, type MoveClips } from './models';

/** Achter de bar: tussen toog (binnenrand) en achterbar. */
const X = BAR.x + 0.7 + 0.28;
/** Tapkranen (zelfde plek als in Cafe.tsx). */
const TAPS = [-3.2, -1.4, 0.6, 2.6];
const FACE_GUESTS = -Math.PI / 2;
const SPEED = 0.8;

type Phase = 'leunen' | 'lopen' | 'tappen';

/**
 * De barvrouw: staat achter de bar, leunt op de toog, loopt af en toe naar een tapkraan en tapt
 * een biertje. Ze staat (de zit-animatie stil op het staande begin) en kijkt rond.
 */
export function Bartender({ clips, moves }: { clips: ClipSet; moves: MoveClips }) {
  const { scene: model, hipsRatio } = usePerson('michelle');
  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  const own = useMemo(() => movesFor(moves, hipsRatio, 0), [moves, hipsRatio]);
  const root = useRef<Group>(null);
  const rng = useRef(createRng(0xba12));
  const st = useRef({ phase: 'leunen' as Phase, t: 0, until: 6, z: TAPS[1]!, to: TAPS[1]! });
  const bones = useMemo(
    () => ({
      armL: findBone(model, 'LeftArm'),
      foreL: findBone(model, 'LeftForeArm'),
      handL: findBone(model, 'LeftHand'),
      armR: findBone(model, 'RightArm'),
      foreR: findBone(model, 'RightForeArm'),
      handR: findBone(model, 'RightHand'),
    }),
    [model],
  );
  const v = useMemo(() => ({ a: new Vector3(), pole: new Vector3(), q: new Quaternion() }), []);
  const weights = useRef({ lean: 1, tap: 0 });

  useEffect(() => {
    const tint = new Color('#f4ddd6');
    model.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = false;
      m.userData.base ??= m.material;
      const base = m.userData.base as Material | Material[];
      const tinted = (mat: Material) => {
        const copy = mat.clone() as MeshStandardMaterial;
        copy.color?.multiply(tint);
        return copy;
      };
      m.material = Array.isArray(base) ? base.map(tinted) : tinted(base);
    });
    // Staan: de zit-animatie stilgezet op het begin (dan staat ze nog).
    const stand = mixer.clipAction(own.sit);
    stand.play();
    stand.paused = true;
    stand.time = 0;
    const head = mixer.clipAction(clips.head.idle).setLoop(LoopRepeat, Infinity);
    head.play();
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer, model, own, clips.head.idle]);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    const s = st.current;
    const grp = root.current;
    s.t += step;
    const walkAction = mixer.clipAction(own.walk);
    const standAction = mixer.clipAction(own.sit);

    if (s.phase === 'leunen' && s.t > s.until) {
      // Naar een (andere) tapkraan.
      const r = rng.current;
      const options = TAPS.filter((z) => z !== s.z);
      s.to = options[Math.floor(r() * options.length)]!;
      s.phase = 'lopen';
      s.t = 0;
      walkAction.reset().setLoop(LoopRepeat, Infinity).fadeIn(0.3).play();
      standAction.fadeOut(0.3);
    } else if (s.phase === 'lopen' && grp) {
      const dz = s.to - s.z;
      const move = SPEED * step;
      const want = dz > 0 ? 0 : Math.PI;
      grp.rotation.y +=
        Math.atan2(Math.sin(want - grp.rotation.y), Math.cos(want - grp.rotation.y)) *
        Math.min(1, step * 6);
      if (Math.abs(dz) <= move) {
        s.z = s.to;
        s.phase = 'tappen';
        s.t = 0;
        standAction.reset().fadeIn(0.3).play();
        standAction.paused = true;
        standAction.time = 0;
        walkAction.fadeOut(0.3);
      } else s.z += Math.sign(dz) * move;
    } else if (s.phase === 'tappen' && grp) {
      grp.rotation.y +=
        Math.atan2(Math.sin(FACE_GUESTS - grp.rotation.y), Math.cos(FACE_GUESTS - grp.rotation.y)) *
        Math.min(1, step * 5);
      if (s.t > 3.6) {
        s.phase = 'leunen';
        s.t = 0;
        s.until = 8 + rng.current() * 12;
      }
    } else if (grp) {
      grp.rotation.y +=
        Math.atan2(Math.sin(FACE_GUESTS - grp.rotation.y), Math.cos(FACE_GUESTS - grp.rotation.y)) *
        Math.min(1, step * 5);
    }
    if (grp) grp.position.set(X, 0, s.z);

    mixer.update(step);
    model.updateMatrixWorld(true);

    // Handen: leunen op de toog, of de rechterhand aan de tapkraan (op en neer trekken).
    const w = weights.current;
    const k = Math.min(1, step * 4);
    w.lean += ((s.phase === 'leunen' ? 1 : s.phase === 'tappen' ? 0.5 : 0) - w.lean) * k;
    w.tap += ((s.phase === 'tappen' ? 1 : 0) - w.tap) * k;
    const { armL, foreL, handL, armR, foreR, handR } = bones;
    if (!armL || !foreL || !handL || !armR || !foreR || !handR) return;
    const edgeX = BAR.x + 0.66;
    const pull = s.phase === 'tappen' ? Math.sin(Math.min(1, s.t / 3) * Math.PI) * 0.08 : 0;
    const arms: [typeof armL, typeof foreL, typeof handL, Vector3, number][] = [
      [armL, foreL, handL, new Vector3(edgeX, 1.18, s.z + 0.22), w.lean],
      [
        armR,
        foreR,
        handR,
        w.tap > 0.05
          ? new Vector3(BAR.x + 0.5, 1.52 - pull, s.z - 0.05)
          : new Vector3(edgeX, 1.18, s.z - 0.22),
        Math.max(w.lean, w.tap),
      ],
    ];
    for (const [up, fore, hand, target, weight] of arms) {
      if (weight < 0.02) continue;
      const saved = [up.quaternion.clone(), fore.quaternion.clone()];
      up.getWorldPosition(v.pole);
      v.pole.y -= 0.5;
      v.pole.x += 0.15;
      twoBoneIK(up, fore, hand, target, v.pole);
      [up, fore].forEach((b, i) => {
        v.q.copy(b.quaternion);
        b.quaternion.copy(saved[i]!).slerp(v.q, weight);
      });
      model.updateMatrixWorld(true);
    }
  });

  return (
    <group ref={root} position={[X, 0, TAPS[1]!]} rotation-y={FACE_GUESTS}>
      <primitive object={model} />
    </group>
  );
}
