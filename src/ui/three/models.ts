import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { AnimationClip, type Bone, type Object3D } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { isLite } from './support';

/** Mensen en animaties van Mixamo, omgezet naar GLB (zie scripts in README). */
const base = `${import.meta.env.BASE_URL}models/`;
export const PEOPLE = {
  ria: `${base}ria.glb`,
  henk: `${base}henk.glb`,
  sjaak: `${base}sjaak.glb`,
  // Cafégasten: een man in jas en een jonge vrouw.
  joe: `${base}joe.glb`,
  michelle: `${base}michelle.glb`,
} as const;
export type PersonKey = keyof typeof PEOPLE;

/** Op telefoons: lichtere versie (kleinere texturen, minder driehoeken). */
const LITE = isLite();
function personUrl(key: PersonKey): string {
  return LITE ? PEOPLE[key].replace(/\.glb$/, '-lite.glb') : PEOPLE[key];
}

export const ANIMS = [
  'idle',
  'hold',
  'talk',
  'laugh',
  'disapprove',
  'point',
  'nod',
  'think',
] as const;
export type AnimKey = (typeof ANIMS)[number];
const animUrl = (k: AnimKey) => `${base}anim-${k}.glb`;

const LOWER = /^(Hips|LeftUpLeg|LeftLeg|LeftFoot|LeftToe|RightUpLeg|RightLeg|RightFoot|RightToe)/;
const HEAD = /^(Neck|Head|LeftEye|RightEye)/;
const FINGER = /^(Left|Right)Hand(Thumb|Index|Middle|Ring|Pinky)/;

/** Vingers stil in de eerste stand: anders lijkt kaarten vasthouden op typen op een telefoon. */
function freezeFingers(clip: AnimationClip): AnimationClip {
  for (const t of clip.tracks) {
    if (!FINGER.test(boneOf(t.name))) continue;
    const n = t.getValueSize();
    const first = Array.from(t.values.slice(0, n));
    t.times = new Float32Array([0]);
    t.values = new Float32Array(first);
  }
  return clip;
}

/** Elk Mixamo-bestand heeft een eigen voorvoegsel (mixamorig, mixamorig8, ...). Weg ermee. */
const PREFIX = /^mixamorig\d*:?/;

/** "mixamorig9LeftArm.quaternion" -> "LeftArm" */
export function boneOf(trackName: string): string {
  return trackName.split('.')[0]!.replace(PREFIX, '');
}

export function findBone(root: Object3D, name: string): Bone | null {
  let found: Bone | null = null;
  root.traverse((o) => {
    if (!found && (o as Bone).isBone && o.name === name) found = o as Bone;
  });
  return found;
}

function part(clip: AnimationClip, name: string, keep: (bone: string, prop: string) => boolean) {
  const tracks = clip.tracks
    .filter((t) => {
      const [, prop = ''] = t.name.split('.');
      return keep(boneOf(t.name), prop);
    })
    .map((t) => {
      const copy = t.clone();
      copy.name = `${boneOf(t.name)}.${t.name.split('.')[1]}`;
      return copy;
    });
  return new AnimationClip(name, clip.duration, tracks);
}

export interface ClipSet {
  /** Benen en heupen (zittend), altijd aan. */
  lower: AnimationClip;
  /** Romp en armen per animatie. */
  body: Record<AnimKey, AnimationClip>;
  /** Nek en hoofd per animatie. */
  head: Record<AnimKey, AnimationClip>;
}

/**
 * Alle animaties, opgeknipt in onder (zitten), lijf (armen) en hoofd, zodat ze los te combineren
 * zijn: zittend kaarten vasthouden en tegelijk knikken, bijvoorbeeld.
 */
export function useClips(): ClipSet {
  const gltfs = useGLTF(ANIMS.map(animUrl), false, true);
  return useMemo(() => {
    const body = {} as Record<AnimKey, AnimationClip>;
    const head = {} as Record<AnimKey, AnimationClip>;
    let lower: AnimationClip | null = null;
    ANIMS.forEach((key, i) => {
      const clip = gltfs[i]!.animations[0]!;
      const rot = (prop: string) => prop === 'quaternion';
      body[key] = part(clip, `body-${key}`, (b, p) => rot(p) && !LOWER.test(b) && !HEAD.test(b));
      if (key === 'hold') freezeFingers(body[key]);
      head[key] = part(clip, `head-${key}`, (b, p) => rot(p) && HEAD.test(b));
      if (key === 'idle') {
        lower = part(
          clip,
          'lower',
          (b, p) => LOWER.test(b) && (rot(p) || (b === 'Hips' && p === 'position')),
        );
      }
    });
    return { lower: lower!, body, head };
  }, [gltfs]);
}

/** Heuphoogte (staand) in het skelet waarop de animaties gemaakt zijn. */
const ANIM_HIPS = 0.959;
/** Gewenste heuphoogte staand, in meters (zo'n 1,75 m lang). */
const HIPS_HEIGHT = 0.96;

export interface PersonModel {
  scene: Object3D;
  /** Factor waarmee de heup-positie uit de animaties naar dit skelet omgerekend moet worden. */
  hipsRatio: number;
}

/**
 * Eigen kopie van een persoon (met eigen skelet). Sommige modellen zijn in andere eenheden
 * gemaakt (Remy is twee keer zo groot), dus schalen we op heuphoogte.
 */
export function usePerson(key: PersonKey): PersonModel {
  const { scene } = useGLTF(personUrl(key), false, true);
  return useMemo(() => {
    const copy = cloneSkinned(scene);
    copy.traverse((o) => {
      o.name = o.name.replace(PREFIX, '');
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
    });
    const hips = findBone(copy, 'Hips');
    const restY = hips?.position.y ?? ANIM_HIPS;
    copy.scale.setScalar(HIPS_HEIGHT / restY);
    return { scene: copy, hipsRatio: restY / ANIM_HIPS };
  }, [scene]);
}

/** Zit-animatie (benen en heup) omgerekend naar dit skelet. */
export function lowerFor(lower: AnimationClip, hipsRatio: number): AnimationClip {
  const clip = lower.clone();
  for (const t of clip.tracks) {
    if (t.name === 'Hips.position') {
      t.values = t.values.map((v) => v * hipsRatio) as typeof t.values;
    }
  }
  return clip;
}

/** Hele-lijf-clips om rond te lopen: gaan zitten (achterstevoren = opstaan) en lopen. */
const MOVES = ['sitdown', 'walk'] as const;
export interface MoveClips {
  sit: AnimationClip;
  walk: AnimationClip;
}

export function useMoveClips(): MoveClips {
  const gltfs = useGLTF(
    MOVES.map((k) => `${base}anim-${k}.glb`),
    false,
    true,
  );
  return useMemo(() => {
    const [sit, walk] = gltfs.map((g, i) =>
      part(
        g.animations[0]!,
        MOVES[i]!,
        (b, p) => p === 'quaternion' || (b === 'Hips' && p === 'position'),
      ),
    );
    return { sit: sit!, walk: walk! };
  }, [gltfs]);
}

/**
 * Hele-lijf-clips omgerekend naar dit skelet. Lopen: alleen op en neer (wij verplaatsen de
 * persoon zelf). Zitten: eindigt precies in de zithouding, en komt maar `forward` meter naar
 * voren (anders stap je bij een tafeltje door het tafelblad).
 */
export function movesFor(m: MoveClips, hipsRatio: number, forward: number): MoveClips {
  const fix = (clip: AnimationClip, walk: boolean) => {
    const out = clip.clone();
    for (const t of out.tracks) {
      if (t.name !== 'Hips.position') continue;
      const v = Array.from(t.values);
      const n = v.length / 3;
      const lastX = v[(n - 1) * 3]!;
      const lastZ = v[(n - 1) * 3 + 2]!;
      const travel = Math.abs(v[2]! - lastZ) || 1;
      for (let i = 0; i < n; i++) {
        v[i * 3] = walk ? 0 : v[i * 3]! - lastX;
        v[i * 3 + 2] = walk ? 0 : ((v[i * 3 + 2]! - lastZ) * forward) / travel;
        v[i * 3]! *= hipsRatio;
        v[i * 3 + 1]! *= hipsRatio;
        v[i * 3 + 2]! *= hipsRatio;
      }
      t.values = Float32Array.from(v) as typeof t.values;
    }
    return out;
  };
  return { sit: fix(m.sit, false), walk: fix(m.walk, true) };
}

/** Alleen wat aan jullie tafel nodig is; de andere gasten laden daarna. */
export function preloadModels() {
  (['ria', 'henk', 'sjaak'] as const).forEach((k) => useGLTF.preload(personUrl(k), false, true));
  ANIMS.forEach((k) => useGLTF.preload(animUrl(k), false, true));
}
