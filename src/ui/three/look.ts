import { clampLook } from './layout';

/**
 * Waar je naartoe kijkt, bovenop "naar de tafel kijken". Gedeelde, muteerbare toestand:
 * de sleep-handlers schrijven hem, de camera leest hem elk frame (zonder React-renders).
 */
export const look = { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 };

export function lookBy(dx: number, dy: number): void {
  [look.targetYaw, look.targetPitch] = clampLook(
    look.targetYaw - dx * 0.005,
    look.targetPitch - dy * 0.004,
  );
}

export function lookReset(): void {
  look.targetYaw = 0;
  look.targetPitch = 0;
}

/** Zacht meebewegen naar het doel (dt in seconden). */
export function lookStep(dt: number): void {
  const k = Math.min(1, dt * 8);
  look.yaw += (look.targetYaw - look.yaw) * k;
  look.pitch += (look.targetPitch - look.pitch) * k;
}

export function isLookingAway(): boolean {
  return Math.abs(look.targetYaw) > 0.15 || Math.abs(look.targetPitch) > 0.15;
}
