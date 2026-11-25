/** Kan deze browser WebGL? Zo niet, dan valt de game terug op de eenvoudige tafel. */
let cached: boolean | null = null;

export function webglAvailable(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement('canvas');
    cached = !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    cached = false;
  }
  return cached;
}

/** Telefoon of tablet: lichtere effecten en minder pixels, zodat het soepel blijft. */
export function isLite(): boolean {
  if (typeof location !== 'undefined' && /[?&]lite\b/.test(location.search)) return true;
  if (typeof matchMedia === 'undefined') return true;
  return matchMedia('(pointer: coarse)').matches || matchMedia('(max-width: 900px)').matches;
}
