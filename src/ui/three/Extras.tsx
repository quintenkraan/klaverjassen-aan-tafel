import { useProgress } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { DepthOfField } from '@react-three/postprocessing';
import { useEffect, useRef, useState } from 'react';
import { Vector3 } from 'three';
import type { DepthOfFieldEffect } from 'postprocessing';
import { nl } from '../../i18n/nl';
import { clampLook } from './layout';
import { isLookingAway, look } from './look';

/**
 * Scherptediepte zoals je ogen: kijk je naar de tafel, dan is die scherp en de zaak erachter
 * zacht. Kijk je rond, dan stellen je ogen verder weg scherp.
 */
export function FocusDepth() {
  const ref = useRef<DepthOfFieldEffect>(null);
  const { camera } = useThree();
  const dist = useRef(0.9);
  const dir = useRef(new Vector3());
  const target = useRef(new Vector3());
  useFrame((_, dt) => {
    const want = isLookingAway() ? 4.5 : 0.9;
    dist.current += (want - dist.current) * Math.min(1, dt * 2.5);
    camera.getWorldDirection(dir.current);
    target.current.copy(camera.position).addScaledVector(dir.current, dist.current);
    if (ref.current) ref.current.target = target.current;
  });
  return <DepthOfField ref={ref} worldFocusRange={1.8} bokehScale={2.2} resolutionScale={0.5} />;
}

/** Laadscherm: het cafÃ© en de mensen worden ingeladen. */
export function LoadingCurtain() {
  const { active, progress } = useProgress();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active && progress >= 100) {
      const t = setTimeout(() => setDone(true), 400);
      return () => clearTimeout(t);
    }
    setDone(false);
  }, [active, progress]);
  if (done) return null;
  return (
    <div className="curtain" role="status" aria-live="polite">
      <p>{nl.loadingCafe}</p>
      <div className="curtain__bar">
        <div style={{ width: `${Math.round(progress)}%` }} />
      </div>
      <small>{Math.round(progress)}%</small>
    </div>
  );
}

type OrientationCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/** Op een telefoon: rondkijken door het toestel te draaien (na een tik, iOS vraagt toestemming). */
export function GyroButton() {
  const [on, setOn] = useState(false);
  const base = useRef<{ a: number; b: number; g: number } | null>(null);
  const supported =
    typeof window !== 'undefined' &&
    'DeviceOrientationEvent' in window &&
    matchMedia('(pointer: coarse)').matches;

  useEffect(() => {
    if (!on) return;
    base.current = null;
    const handler = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      base.current ??= { a: e.alpha, b: e.beta, g: e.gamma };
      const b0 = base.current;
      const deg = Math.PI / 180;
      let da = e.alpha - b0.a;
      if (da > 180) da -= 360;
      if (da < -180) da += 360;
      const angle = screen.orientation?.angle ?? 0;
      const tilt =
        angle === 90
          ? -(e.gamma - b0.g)
          : angle === 270 || angle === -90
            ? e.gamma - b0.g
            : e.beta - b0.b;
      [look.targetYaw, look.targetPitch] = clampLook(da * deg, tilt * deg);
    };
    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, [on]);

  if (!supported) return null;
  return (
    <button
      type="button"
      className="gyro"
      aria-pressed={on}
      onClick={async () => {
        if (on) {
          setOn(false);
          return;
        }
        const ctor = DeviceOrientationEvent as OrientationCtor;
        if (ctor.requestPermission) {
          try {
            if ((await ctor.requestPermission()) !== 'granted') return;
          } catch {
            return;
          }
        }
        setOn(true);
      }}
    >
      {on ? nl.gyroOff : nl.gyroOn}
    </button>
  );
}
