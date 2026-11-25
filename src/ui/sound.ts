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

/** Kaart op vilt: een korte "snap" van karton en een zachte plof op het kleed. */
function cardOnFelt(): void {
  rustle(0.035, 4200, 0.25);
  rustle(0.12, 700, 0.18, 0.02);
}

// ---------- Café-achtergrond: geroezemoes, glazen, zachte muziek ----------

let ambWanted = false;
let amb: { stop: () => void } | null = null;

function noiseBuffer(a: AudioContext, seconds: number): AudioBuffer {
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * seconds), a.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    // Bruine ruis: zachter en warmer dan witte ruis.
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

function startAmbience(a: AudioContext): { stop: () => void } {
  const out = a.createGain();
  out.gain.value = 0;
  out.gain.linearRampToValueAtTime(1, a.currentTime + 2);
  out.connect(a.destination);
  const nodes: AudioScheduledSourceNode[] = [];
  const timers: number[] = [];

  // Geroezemoes: ruis door "stem"-filters, elk met een eigen, langzaam golvend volume.
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, 6);
  src.loop = true;
  for (const [freq, speed] of [
    [320, 0.31],
    [620, 0.53],
    [1150, 0.77],
    [2100, 0.41],
  ] as const) {
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.6;
    const g = a.createGain();
    g.gain.value = 0.05;
    const lfo = a.createOscillator();
    lfo.frequency.value = speed;
    const depth = a.createGain();
    depth.gain.value = 0.035;
    lfo.connect(depth).connect(g.gain);
    src.connect(f).connect(g).connect(out);
    lfo.start();
    nodes.push(lfo);
  }
  src.start();
  nodes.push(src);

  // Af en toe tikken er glazen tegen elkaar.
  const clink = () => {
    const t0 = a.currentTime;
    for (const [i, f] of [2600 + Math.random() * 900, 3400 + Math.random() * 700].entries()) {
      const o = a.createOscillator();
      o.frequency.value = f;
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t0 + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.025, t0 + i * 0.05 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.05 + 0.5);
      o.connect(g).connect(out);
      o.start(t0 + i * 0.05);
      o.stop(t0 + i * 0.05 + 0.55);
    }
    timers.push(window.setTimeout(clink, 3000 + Math.random() * 9000));
  };
  timers.push(window.setTimeout(clink, 4000));

  // Zachte muziek uit de boxen: rustige akkoorden met een baslijn.
  const chords = [
    [57, 60, 64, 67],
    [62, 65, 69, 72],
    [55, 59, 62, 65],
    [60, 64, 67, 71],
  ];
  const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  const music = a.createBiquadFilter();
  music.type = 'lowpass';
  music.frequency.value = 1400;
  const musicGain = a.createGain();
  musicGain.gain.value = 0.02;
  music.connect(musicGain).connect(out);
  let n = 0;
  const bar = () => {
    const t0 = a.currentTime + 0.05;
    const chord = chords[n++ % chords.length]!;
    chord.forEach((m, i) => {
      const o = a.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz(m);
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.25 + i * 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
      o.connect(g).connect(music);
      o.start(t0);
      o.stop(t0 + 2.7);
    });
    const bass = a.createOscillator();
    bass.frequency.value = hz(chord[0]! - 12);
    const bg = a.createGain();
    bg.gain.setValueAtTime(0.0001, t0);
    bg.gain.exponentialRampToValueAtTime(0.9, t0 + 0.03);
    bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
    bass.connect(bg).connect(music);
    bass.start(t0);
    bass.stop(t0 + 1.3);
    timers.push(window.setTimeout(bar, 2400));
  };
  bar();

  return {
    stop: () => {
      timers.forEach((t) => clearTimeout(t));
      out.gain.cancelScheduledValues(a.currentTime);
      out.gain.setValueAtTime(out.gain.value, a.currentTime);
      out.gain.linearRampToValueAtTime(0, a.currentTime + 0.4);
      setTimeout(() => {
        nodes.forEach((x) => {
          try {
            x.stop();
          } catch {
            /* al gestopt */
          }
        });
        out.disconnect();
      }, 500);
    },
  };
}

function setAmbience(on: boolean): void {
  ambWanted = on;
  if (!on || muted) {
    amb?.stop();
    amb = null;
    return;
  }
  const a = audio();
  if (a && !amb) amb = startAmbience(a);
}

export const sound = {
  card: cardOnFelt,
  /** Café-geluid aan (aan tafel) of uit (in het menu). */
  ambience: setAmbience,
  collect: () => rustle(0.3, 1100, 0.2),
  deal: () => {
    for (let i = 0; i < 6; i++) rustle(0.06, 3000, 0.2, i * 0.09);
  },
  knock,
  isMuted: () => muted,
  setMuted(value: boolean) {
    muted = value;
    setAmbience(ambWanted);
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      /* opslag niet beschikbaar: alleen voor deze sessie */
    }
  },
};
