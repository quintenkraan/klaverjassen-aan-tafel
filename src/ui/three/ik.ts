import { Quaternion, Vector3, type Object3D } from 'three';

const v1 = new Vector3();
const v2 = new Vector3();
const v3 = new Vector3();
const q1 = new Quaternion();
const q2 = new Quaternion();
const q3 = new Quaternion();

/** Draai `bone` zo dat zijn kind (`child`) richting `target` wijst. Werkt ongeacht de botassen. */
export function aim(bone: Object3D, child: Object3D, target: Vector3): void {
  bone.getWorldPosition(v1);
  child.getWorldPosition(v2);
  const cur = v2.sub(v1).normalize();
  const des = v3.copy(target).sub(v1).normalize();
  q1.setFromUnitVectors(cur, des);
  bone.getWorldQuaternion(q2).premultiply(q1);
  bone.parent!.getWorldQuaternion(q3).invert();
  bone.quaternion.copy(q3.multiply(q2));
  bone.updateMatrixWorld(true);
}

const S = new Vector3();
const E = new Vector3();
const W = new Vector3();
const dir = new Vector3();
const p = new Vector3();
const elbow = new Vector3();

/**
 * Twee-bots IK (schouder, elleboog, pols): legt de hand op `target`, met de elleboog
 * richting `pole`. Klassieke cosinusregel, geen iteraties nodig.
 */
export function twoBoneIK(
  arm: Object3D,
  fore: Object3D,
  hand: Object3D,
  target: Vector3,
  pole: Vector3,
): void {
  arm.getWorldPosition(S);
  fore.getWorldPosition(E);
  hand.getWorldPosition(W);
  const a = S.distanceTo(E);
  const b = E.distanceTo(W);
  dir.copy(target).sub(S);
  const d = Math.min(Math.max(dir.length(), 0.01), a + b - 0.001);
  dir.normalize();
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(a * a - x * x, 0));
  p.copy(pole).sub(S);
  p.sub(v1.copy(dir).multiplyScalar(p.dot(dir))).normalize();
  elbow.copy(S).addScaledVector(dir, x).addScaledVector(p, h);
  aim(arm, fore, elbow);
  aim(fore, hand, target);
}
