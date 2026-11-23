import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { AnimationClip, type Bone, type Object3D } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Mensen en animaties van Mixamo, omgezet naar GLB (zie scripts in README). */
const base = `${import.meta.env.BASE_URL}models/`;
export const PEOPLE = {
  ria: `${base}ria.glb`,
  henk: `${base}henk.glb`,
  sjaak: `${base}sjaak.glb`,
} as const;
export type PersonKey = keyof typeof PEOPLE;

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
  const { scene } = useGLTF(PEOPLE[key], false, true);
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

export function preloadModels() {
  Object.values(PEOPLE).forEach((u) => useGLTF.preload(u, false, true));
  ANIMS.forEach((k) => useGLTF.preload(animUrl(k), false, true));
}
