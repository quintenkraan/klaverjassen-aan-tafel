/** Geluiden, gesynthetiseerd met Web Audio (geen geluidsbestanden nodig). */

const STORAGE_KEY = 'klaverjas:muted';
let ctx: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function audio(): AudioContext | null {
  if (muted || typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Kort stukje gefilterde ruis: klinkt als karton op vilt. */
function rustle(duration: number, freq: number, volume: number, delay = 0): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * duration), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.8;
  const gain = a.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t0);
}

function knock(delay = 0): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.frequency.setValueAtTime(160, t0);
  osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.12);
  gain.gain.setValueAtTime(0.5, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + 0.16);
}

export const sound = {
  card: () => rustle(0.09, 2600, 0.35),
  collect: () => rustle(0.3, 1100, 0.2),
  deal: () => {
    for (let i = 0; i < 6; i++) rustle(0.06, 3000, 0.2, i * 0.09);
  },
  knock,
  isMuted: () => muted,
  setMuted(value: boolean) {
    muted = value;
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      /* opslag niet beschikbaar: alleen voor deze sessie */
    }
  },
};
