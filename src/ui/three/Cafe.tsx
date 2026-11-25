import { Instance, Instances } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import {
  CanvasTexture,
  LatheGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  type Texture,
} from 'three';
import { createRng } from '../../engine';
import {
  BAR,
  BENCH_Z,
  FRONT_DOOR_X,
  ROOM,
  TABLE,
  TABLE_TOP,
  WALL_TABLE_X,
  WC_DOOR_X,
} from './layout';

/**
 * Het bruine café, naar jouw foto's (zie de plattegrond in layout.ts):
 * - achterin: spiegelwand met groene lambrisering en een bank; daar zit jij, links bij het raam
 * - links: hoge ramen met groene gordijnen, verderop tafeltjes langs de wand
 * - rechts: een lange bar met tapkranen en krukken, erachter kasten vol flessen en lichtjes
 * - voorin: ramen naar de straat en twee deuren, elk met een houten schot ervoor
 * Merknamen en portretten van echte mensen zijn vervangen door neutrale bordjes en schilderijen.
 */

const { minX, maxX, minZ, maxZ, height: H } = ROOM;
const W = maxX - minX;
const D = maxZ - minZ;
const WOOD = '#3a2617';
const WOOD_DARK = '#20140c';
const PANEL = '#2c3326';
const OCHRE = '#b36a2c';
const CURTAIN = '#25382b';
const BRASS = '#b8913a';

const BACKBAR = { x: 0.15, z0: -5.2, z1: 5.0 };
/** Achter de achterbar is het dicht; de wand daar loopt tot de linkermuur. */
const BEHIND_X = BACKBAR.x + 0.9;

function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Houtnerf (grijstinten, wordt met de kleur vermenigvuldigd). Eén keer gemaakt, overal gebruikt. */
let grainTex: Texture | null = null;
function grain(): Texture {
  if (grainTex) return grainTex;
  const rng = createRng(31);
  grainTex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#e2e2e2';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      const y = rng() * 256;
      const shade = 170 + Math.floor(rng() * 60);
      ctx.strokeStyle = `rgba(${shade},${shade},${shade},${0.35 + rng() * 0.4})`;
      ctx.lineWidth = 0.6 + rng() * 2.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, y + Math.sin(x / 40 + i) * (2 + rng() * 3));
      ctx.stroke();
    }
    // Een paar kwasten
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(140,140,140,0.35)';
      ctx.beginPath();
      ctx.ellipse(rng() * 256, rng() * 256, 6 + rng() * 6, 2 + rng() * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  grainTex.colorSpace = '';
  return grainTex;
}

/** Straat 's avonds aan de overkant: gevels met warme ramen, een lantaarn, natte stoep. */
let streetTex: Texture | null = null;
function street(): Texture {
  if (streetTex) return streetTex;
  const rng = createRng(77);
  streetTex = canvasTexture(512, 512, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 200);
    sky.addColorStop(0, '#070b16');
    sky.addColorStop(1, '#1b2640');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 512, 512);
    // Gevels met daklijn
    let x = 0;
    while (x < 512) {
      const w = 90 + rng() * 80;
      const top = 110 + rng() * 80;
      ctx.fillStyle = ['#2a1d16', '#231a17', '#2d221a', '#1e1714'][Math.floor(rng() * 4)]!;
      ctx.fillRect(x, top, w, 400 - top);
      for (let wy = top + 18; wy < 370; wy += 36)
        for (let wx = x + 10; wx < x + w - 16; wx += 22) {
          const lit = rng() < 0.45;
          ctx.fillStyle = lit ? `hsl(${32 + rng() * 14}, 80%, ${42 + rng() * 16}%)` : '#121624';
          ctx.fillRect(wx, wy, 10, 17);
        }
      x += w;
    }
    // Stoep en straat, nat
    const road = ctx.createLinearGradient(0, 400, 0, 512);
    road.addColorStop(0, '#191c24');
    road.addColorStop(1, '#0b0d12');
    ctx.fillStyle = road;
    ctx.fillRect(0, 400, 512, 112);
    // Lantaarn met gloed en weerspiegeling
    const lx = 120 + rng() * 280;
    const glow = ctx.createRadialGradient(lx, 170, 2, lx, 170, 90);
    glow.addColorStop(0, 'rgba(255,214,150,0.95)');
    glow.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(lx - 90, 80, 180, 180);
    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(lx - 3, 175, 6, 235);
    const refl = ctx.createLinearGradient(0, 410, 0, 512);
    refl.addColorStop(0, 'rgba(255,200,130,0.35)');
    refl.addColorStop(1, 'rgba(255,200,130,0)');
    ctx.fillStyle = refl;
    ctx.fillRect(lx - 14, 410, 28, 102);
  });
  return streetTex;
}

function useTextures() {
  return useMemo(() => {
    const floor = canvasTexture(512, 512, (ctx) => {
      ctx.fillStyle = '#25211e';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 3000; i++) {
        ctx.fillStyle = `rgba(${150 + Math.random() * 60},${140 + Math.random() * 50},${120 + Math.random() * 40},${Math.random() * 0.1})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 512; i += 128) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
    });
    floor.wrapS = floor.wrapT = RepeatWrapping;
    floor.repeat.set(W / 1.5, D / 1.5);

    const checker = canvasTexture(256, 32, (ctx) => {
      for (let x = 0; x < 16; x++)
        for (let y = 0; y < 2; y++) {
          ctx.fillStyle = (x + y) % 2 ? '#d8d2c4' : '#151515';
          ctx.fillRect(x * 16, y * 16, 16, 16);
        }
    });
    checker.wrapS = RepeatWrapping;
    checker.repeat.set(40, 1);

    const planks = canvasTexture(256, 256, (ctx) => {
      for (let i = 0; i < 8; i++) {
        const l = 30 + Math.random() * 10;
        ctx.fillStyle = `hsl(25, 45%, ${l}%)`;
        ctx.fillRect(0, i * 32, 256, 32);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, i * 32, 256, 2);
      }
    });
    planks.wrapS = planks.wrapT = RepeatWrapping;
    planks.repeat.set(2, D / 1.2);

    const neon = canvasTexture(512, 160, (ctx) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 512, 160);
      ctx.font = 'bold 110px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff2a2a';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#ff6a5a';
      ctx.fillText('Café', 256, 84);
    });

    const chalk = canvasTexture(256, 360, (ctx) => {
      ctx.fillStyle = '#1d2420';
      ctx.fillRect(0, 0, 256, 360);
      ctx.fillStyle = 'rgba(240,240,230,0.85)';
      ctx.font = 'italic 34px Georgia, serif';
      ctx.fillText('Vandaag', 40, 60);
      ctx.font = '24px Georgia, serif';
      ['Tripel', 'Dubbel', 'Blond', 'Kriek', 'Bitterballen'].forEach((t, i) =>
        ctx.fillText(`· ${t}`, 36, 120 + i * 44),
      );
    });

    const paintings = [30, 200, 95].map((hue) =>
      canvasTexture(256, 320, (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 0, 320);
        g.addColorStop(0, `hsl(${hue}, 25%, 62%)`);
        g.addColorStop(0.55, `hsl(${hue + 20}, 20%, 40%)`);
        g.addColorStop(1, `hsl(${hue + 40}, 25%, 22%)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 320);
        ctx.fillStyle = 'rgba(30,25,20,0.55)';
        ctx.beginPath();
        ctx.moveTo(0, 230);
        ctx.quadraticCurveTo(90, 170, 160, 215);
        ctx.quadraticCurveTo(210, 245, 256, 200);
        ctx.lineTo(256, 320);
        ctx.lineTo(0, 320);
        ctx.fill();
      }),
    );

    const posters = ['#c8a032', '#3f6fa0', '#a03a2c', '#e0d6c0'].map((c, i) =>
      canvasTexture(200, 280, (ctx) => {
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 200, 280);
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.font = 'bold 34px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(['BIER', 'TAP', 'KAART', 'PROOST'][i]!, 100, 150);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 6;
        ctx.strokeRect(12, 12, 176, 256);
      }),
    );
    const wc = canvasTexture(256, 128, (ctx) => {
      ctx.fillStyle = '#f2ead8';
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = '#1f2a3a';
      ctx.font = 'bold 84px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('WC', 128, 68);
    });
    return { floor, checker, planks, neon, chalk, paintings, posters, wc };
  }, []);
}

// ---------- kleine bouwstenen ----------

function Box({
  p,
  s,
  c,
  r = 0.7,
  m = 0,
  e,
}: {
  p: [number, number, number];
  s: [number, number, number];
  c: string;
  r?: number;
  m?: number;
  e?: string;
}) {
  return (
    <mesh position={p}>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={c}
        map={m < 0.5 && !e ? grain() : null}
        roughness={r}
        metalness={m}
        emissive={e ?? '#000000'}
        emissiveIntensity={e ? 1.5 : 0}
      />
    </mesh>
  );
}

function Sconce({
  p,
  rotY = 0,
  light = false,
}: {
  p: [number, number, number];
  rotY?: number;
  light?: boolean;
}) {
  return (
    <group position={p} rotation-y={rotY}>
      <Box p={[0, 0, 0.04]} s={[0.03, 0.12, 0.08]} c="#1c1c1c" m={0.6} r={0.4} />
      <mesh position={[0, 0.03, 0.11]}>
        <coneGeometry args={[0.05, 0.1, 16, 1, true]} />
        <meshStandardMaterial color="#fff3d6" emissive="#ffcf8a" emissiveIntensity={2.5} side={2} />
      </mesh>
      {light && (
        <pointLight
          position={[0, 0, 0.25]}
          intensity={1.4}
          distance={4}
          decay={2}
          color="#ffbf73"
        />
      )}
    </group>
  );
}

export function Candle({ p, light = false }: { p: [number, number, number]; light?: boolean }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.035, 0.028, 0.09, 16]} />
        <meshStandardMaterial
          color="#c4141c"
          emissive="#ff2a1a"
          emissiveIntensity={1.4}
          transparent
          opacity={0.85}
          roughness={0.2}
        />
      </mesh>
      {light && (
        <pointLight
          position={[0, 0.12, 0]}
          intensity={0.08}
          distance={1}
          decay={2}
          color="#ff4a2a"
        />
      )}
    </group>
  );
}

export function Chair({ p, rotY }: { p: [number, number, number]; rotY: number }) {
  return (
    <group position={p} rotation-y={rotY}>
      <Box p={[0, 0.44, 0.02]} s={[0.44, 0.05, 0.42]} c={WOOD} r={0.6} />
      <Box p={[0, 0.48, 0.03]} s={[0.4, 0.04, 0.38]} c="#7a1418" />
      <Box p={[0, 0.84, -0.18]} s={[0.42, 0.6, 0.04]} c={WOOD} r={0.6} />
      {[
        [-0.19, -0.16],
        [0.19, -0.16],
        [-0.19, 0.2],
        [0.19, 0.2],
      ].map(([x, z], i) => (
        <Box key={i} p={[x!, 0.21, z!]} s={[0.035, 0.42, 0.035]} c={WOOD_DARK} />
      ))}
    </group>
  );
}

function SmallTable({ p, chairs = true }: { p: [number, number, number]; chairs?: boolean }) {
  return (
    <group position={p}>
      <Box p={[0, 0.74, 0]} s={[0.7, 0.04, 0.7]} c={WOOD} r={0.45} />
      <Box p={[0, 0.36, 0]} s={[0.08, 0.72, 0.08]} c={WOOD_DARK} />
      <Box p={[0, 0.02, 0]} s={[0.45, 0.04, 0.45]} c={WOOD_DARK} />
      <Candle p={[0.12, 0.76, 0.08]} />
      {chairs && (
        <>
          <Chair p={[0, 0, 0.55]} rotY={Math.PI} />
          <Chair p={[0, 0, -0.55]} rotY={0} />
        </>
      )}
    </group>
  );
}

function Barrel({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 1, 28]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.8} />
      </mesh>
      {[0.12, 0.88].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.392, 0.392, 0.05, 28]} />
          <meshStandardMaterial color="#6b6b6b" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      <Candle p={[0.05, 1, 0]} />
    </group>
  );
}

function Window({
  p,
  rotY,
  w,
  h,
}: {
  p: [number, number, number];
  rotY: number;
  w: number;
  h: number;
}) {
  const cols = 2;
  const rows = 3;
  // Elk ruitje toont zijn eigen stukje van de straat.
  const panes = useMemo(
    () =>
      Array.from({ length: cols * rows }, (_, i) => {
        const tex = street().clone();
        tex.repeat.set(1 / cols, 1 / rows);
        tex.offset.set((i % cols) / cols, Math.floor(i / cols) / rows);
        return tex;
      }),
    [],
  );
  return (
    <group position={p} rotation-y={rotY}>
      <Box p={[0, 0, 0]} s={[w + 0.12, h + 0.12, 0.06]} c={WOOD_DARK} />
      {Array.from({ length: cols * rows }, (_, i) => {
        const cx = (i % cols) - (cols - 1) / 2;
        const cy = Math.floor(i / cols) - (rows - 1) / 2;
        return (
          <mesh key={i} position={[(cx * w) / cols, (cy * h) / rows, 0.035]}>
            <planeGeometry args={[w / cols - 0.06, h / rows - 0.06]} />
            <meshStandardMaterial
              color="#0e1220"
              emissive="#ffffff"
              emissiveMap={panes[i]}
              emissiveIntensity={0.5}
              roughness={0.08}
              metalness={0.2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ---------- grote onderdelen ----------

/** Achterwand: lambrisering, bank, spiegels, oker erboven met schilderijen en lampjes. */
function MirrorWall({ t }: { t: ReturnType<typeof useTextures> }) {
  const benchX0 = minX + 0.05;
  const benchX1 = 0.6;
  const bw = benchX1 - benchX0;
  const bx = (benchX0 + benchX1) / 2;
  return (
    <group>
      <Box p={[0, 0.7, minZ + 0.03]} s={[W, 1.4, 0.06]} c={PANEL} />
      {/* Bank (zitting op 0,45 m) met de lambrisering als rugleuning */}
      <Box p={[bx, 0.22, BENCH_Z - 0.12]} s={[bw, 0.44, 0.5]} c="#24170e" />
      <Box p={[bx, 0.46, BENCH_Z - 0.1]} s={[bw, 0.06, 0.5]} c="#2f3a2e" r={0.85} />
      <Box p={[bx, 0.78, minZ + 0.12]} s={[bw, 0.55, 0.1]} c="#2f3a2e" r={0.85} />
      {/* Spiegels in houten lijst */}
      {[-2.85, -1.15].map((x) => (
        <group key={x} position={[x, 1.75, minZ + 0.07]}>
          <Box p={[0, 0, 0]} s={[1.6, 0.62, 0.05]} c={WOOD} />
          <mesh position={[0, 0, 0.03]}>
            <planeGeometry args={[1.48, 0.5]} />
            <meshStandardMaterial color="#3a3530" metalness={0.95} roughness={0.06} />
          </mesh>
        </group>
      ))}
      <Box p={[0, 2.0, minZ + 0.02]} s={[W, 0.2, 0.04]} c={PANEL} />
      <mesh position={[0, 2.65, minZ + 0.01]}>
        <planeGeometry args={[W, 1.1]} />
        <meshStandardMaterial color={OCHRE} roughness={0.95} />
      </mesh>
      {[-2.4, -1.6].map((x, i) => (
        <group key={x} position={[x, 2.62, minZ + 0.04]}>
          <Box p={[0, 0, 0]} s={[0.5, 0.6, 0.03]} c="#e8e2d4" />
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[0.38, 0.48]} />
            <meshStandardMaterial map={t.paintings[i]} roughness={0.9} />
          </mesh>
        </group>
      ))}
      <mesh position={[-3.4, 2.65, minZ + 0.05]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.16, 0.16, 0.03, 32]} />
        <meshStandardMaterial color="#efeae0" />
      </mesh>
      <Sconce p={[-3.5, 2.2, minZ]} light />
      <Sconce p={[-2.0, 2.2, minZ]} />
      <Sconce p={[-0.3, 2.2, minZ]} light />
      {/* Achter de bar: donkere kast */}
      <Box p={[2.4, 1.4, minZ + 0.25]} s={[3.2, 2.8, 0.5]} c="#1e140d" r={0.6} />
    </group>
  );
}

/** Linkerwand: hoge ramen met groene gordijnen achterin, verderop affiches en lampjes. */
function LeftWall({ t }: { t: ReturnType<typeof useTextures> }) {
  const x = minX;
  return (
    <group>
      <mesh position={[x, H / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial color={OCHRE} roughness={0.95} />
      </mesh>
      <Box p={[x + 0.03, 0.4, 0]} s={[0.06, 0.8, D]} c={PANEL} />
      {[-7.6, -5.6, -3.6].map((z) => (
        <group key={z}>
          <Window p={[x + 0.04, 1.85, z]} rotY={Math.PI / 2} w={1.3} h={1.9} />
          {[-0.8, 0.8].map((dz) => (
            <Box key={dz} p={[x + 0.16, 1.75, z + dz]} s={[0.12, 2.5, 0.3]} c={CURTAIN} r={1} />
          ))}
        </group>
      ))}
      <pointLight position={[x + 0.8, 2, -6]} intensity={0.5} distance={4} color="#7f95c9" />
      {[-2.6, 3.3, 7.2].map((z, i) => (
        <group key={z}>
          <mesh position={[x + 0.05, 1.7, z]} rotation-y={Math.PI / 2}>
            <planeGeometry args={[0.5, 0.7]} />
            <meshStandardMaterial map={t.posters[i % t.posters.length]} roughness={0.9} />
          </mesh>
          <Sconce p={[x, 2.25, z + 0.9]} rotY={Math.PI / 2} />
        </group>
      ))}
    </group>
  );
}

/** De bar: toog met tapkranen en krukken, achterbar met flessen, lichtjes en bollampen. */
function Bar({ t }: { t: ReturnType<typeof useTextures> }) {
  const len = BAR.z1 - BAR.z0;
  const cz = (BAR.z0 + BAR.z1) / 2;
  const bottles = useMemo(() => {
    const rng = createRng(7);
    const colors = ['#2f5a2a', '#5a3315', '#c9c2a0', '#7a1a14', '#1e3a5a', '#d0a040', '#3a2a1a'];
    const out: { p: [number, number, number]; c: string; h: number }[] = [];
    for (let shelf = 0; shelf < 4; shelf++)
      for (let z = BACKBAR.z0 + 0.15; z < BACKBAR.z1 - 0.1; z += 0.11) {
        if (rng() < 0.18) continue;
        const h = 0.22 + rng() * 0.12;
        out.push({
          p: [BACKBAR.x + 0.25, 1.32 + shelf * 0.42 + h / 2, z],
          c: colors[Math.floor(rng() * colors.length)]!,
          h,
        });
      }
    return out;
  }, []);
  // Flesvorm: buik, schouder, hals en een randje. Hoogte 1, wordt per fles geschaald.
  const bottleShape = useMemo(() => {
    const pts = [
      [0, 0],
      [0.034, 0],
      [0.036, 0.04],
      [0.036, 0.6],
      [0.03, 0.7],
      [0.014, 0.78],
      [0.012, 0.95],
      [0.015, 0.97],
      [0.013, 1],
      [0, 1],
    ].map(([x, y]) => new Vector2(x!, y! - 0.5));
    return new LatheGeometry(pts, 12);
  }, []);
  const lights = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let z = BACKBAR.z0; z < BACKBAR.z1; z += 0.12)
      out.push([BACKBAR.x - 0.05, 2.95 + Math.sin(z * 3) * 0.04, z]);
    return out;
  }, []);

  return (
    <group>
      {/* Toog */}
      <Box
        p={[BAR.x + BAR.depth / 2, BAR.top / 2, cz]}
        s={[BAR.depth, BAR.top, len]}
        c="#2a1a10"
        r={0.5}
      />
      {Array.from({ length: 12 }, (_, i) => (
        <Box
          key={i}
          p={[BAR.x - 0.01, 0.55, BAR.z0 + (i + 0.5) * (len / 12)]}
          s={[0.02, 0.8, len / 12 - 0.08]}
          c="#3a2416"
        />
      ))}
      <Box
        p={[BAR.x + BAR.depth / 2 - 0.05, BAR.top + 0.03, cz]}
        s={[BAR.depth + 0.2, 0.06, len + 0.1]}
        c="#6a3c1e"
        r={0.25}
      />
      <mesh position={[BAR.x - 0.15, 0.25, cz]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.02, 0.02, len, 12]} />
        <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.25} />
      </mesh>
      {/* Tapkranen */}
      {[-3.2, -1.4, 0.6, 2.6].map((z) => (
        <group key={z} position={[BAR.x + 0.4, BAR.top + 0.06, z]}>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.44, 16]} />
            <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.48, 0]}>
            <sphereGeometry args={[0.09, 16, 12]} />
            <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.2} />
          </mesh>
          {[-0.12, 0, 0.12].map((dz) => (
            <group key={dz} position={[-0.1, 0.36, dz]}>
              <Box p={[0, 0, 0]} s={[0.12, 0.03, 0.03]} c={BRASS} m={0.9} r={0.2} />
              <Box
                p={[-0.06, 0.08, 0]}
                s={[0.02, 0.16, 0.02]}
                c={['#c0392b', '#e0c070', '#2c3e50'][((dz * 100 + 12) % 3) | 0] ?? '#c0392b'}
              />
            </group>
          ))}
        </group>
      ))}
      {/* Krukken */}
      {Array.from({ length: 15 }, (_, i) => (
        <group key={i} position={[BAR.x - 0.38, 0, BAR.z0 + 0.4 + i * 0.66]}>
          <mesh position={[0, 0.76, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.07, 20]} />
            <meshStandardMaterial color="#1b120c" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <cylinderGeometry args={[0.025, 0.04, 0.76, 10]} />
            <meshStandardMaterial color="#111" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* Achterbar: onderkast, schappen, flessen, verlicht vak, lichtjes */}
      <Box p={[BACKBAR.x + 0.45, 0.5, cz]} s={[0.9, 1.0, len]} c="#1c120b" />
      <Box p={[BACKBAR.x + 0.6, 2.0, cz]} s={[0.6, 2.4, len]} c="#24170e" />
      {[0, 1, 2, 3].map((s) => (
        <Box key={s} p={[BACKBAR.x + 0.28, 1.3 + s * 0.42, cz]} s={[0.5, 0.025, len]} c="#3a2617" />
      ))}
      {/* Verlichte achterwand: de flessen staan er als silhouet voor */}
      <mesh position={[BACKBAR.x + 0.295, 2.1, cz]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[len, 1.6]} />
        <meshStandardMaterial color="#2a1a0e" emissive="#ffb067" emissiveIntensity={0.55} />
      </mesh>
      <Instances limit={bottles.length} geometry={bottleShape}>
        <meshStandardMaterial roughness={0.06} metalness={0.25} envMapIntensity={1.6} />
        {bottles.map((b, i) => (
          <Instance key={i} position={b.p} scale={[1, b.h, 1]} color={b.c} />
        ))}
      </Instances>
      <mesh position={[BACKBAR.x + 0.3, 1.12, 1.5]}>
        <boxGeometry args={[0.3, 0.2, 1.6]} />
        <meshStandardMaterial color="#f0d050" emissive="#ffd84a" emissiveIntensity={0.9} />
      </mesh>
      <Instances limit={lights.length}>
        <sphereGeometry args={[0.012, 6, 6]} />
        <meshStandardMaterial color="#fff2c0" emissive="#ffd27a" emissiveIntensity={4} />
        {lights.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      <mesh position={[BACKBAR.x - 0.02, 2.2, -2.3]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.45, 0.62]} />
        <meshStandardMaterial map={t.chalk} roughness={1} />
      </mesh>
      {/* Bollampen boven de bar (drie geven echt licht) */}
      {[-4, -2, 0, 2, 4].map((z, i) => (
        <group key={z} position={[BAR.x + 0.3, 2.35, z]}>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.9]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.16, 20, 16]} />
            <meshStandardMaterial color="#fff6e6" emissive="#ffe2b0" emissiveIntensity={1.6} />
          </mesh>
          {i % 2 === 0 && (
            <pointLight
              position={[0, -0.25, 0]}
              intensity={2.2}
              distance={5}
              decay={2}
              color="#ffd9a6"
            />
          )}
        </group>
      ))}
      {/* Houten pilaar aan het eind van de bar, met lampje en klok */}
      <group position={[BAR.x + 0.35, 0, BAR.z0 - 0.15]}>
        <Box p={[0, H / 2, 0]} s={[0.32, H, 0.32]} c="#2c2a22" r={0.6} />
        <mesh position={[0, 2.2, 0.2]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          <meshStandardMaterial color="#fff3d6" emissive="#ffcf8a" emissiveIntensity={2.5} />
        </mesh>
        <Box p={[0, 2.75, 0.18]} s={[0.24, 0.4, 0.06]} c="#4a2f1c" />
      </group>
    </group>
  );
}

/** Voorgevel: ramen naar de straat, twee deuren, elk met een houten schot erachter. */
/** Panelen met verticale latten, onderaan een portaalwand. */
function PanelWall({ w, rot = 0, p }: { w: number; rot?: number; p: [number, number, number] }) {
  const n = Math.max(2, Math.round(w / 0.16));
  return (
    <group position={p} rotation-y={rot}>
      <Box p={[0, 0.85, 0]} s={[w, 1.7, 0.06]} c="#1e130b" r={0.5} />
      {Array.from({ length: n }, (_, i) => (
        <Box
          key={i}
          p={[-w / 2 + (w / n) * (i + 0.5), 0.85, 0.035]}
          s={[w / n - 0.03, 1.5, 0.012]}
          c="#2b1a0f"
          r={0.45}
        />
      ))}
      {/* Glas bovenin met stijlen, daarboven een kroonlijst */}
      <mesh position={[0, 2.08, 0]}>
        <boxGeometry args={[w - 0.06, 0.72, 0.02]} />
        <meshStandardMaterial color="#2a2a24" transparent opacity={0.35} roughness={0.05} />
      </mesh>
      {[-w / 2, -w / 6, w / 6, w / 2].map((dx) => (
        <Box key={dx} p={[dx, 2.08, 0]} s={[0.05, 0.76, 0.07]} c="#1e130b" />
      ))}
      <Box p={[0, 1.72, 0]} s={[w, 0.05, 0.08]} c="#1e130b" />
      <Box p={[0, 2.5, 0]} s={[w + 0.08, 0.1, 0.12]} c={WOOD_DARK} />
    </group>
  );
}

/** Een deur in een muur. Lokaal: muur op z = 0, de zaal aan de +z-kant. */
function Door({ p, rotY, sign }: { p: [number, number, number]; rotY: number; sign?: Texture }) {
  return (
    <group position={p} rotation-y={rotY}>
      <Box p={[0, 1.1, 0.04]} s={[1.0, 2.2, 0.08]} c={WOOD_DARK} />
      <Box p={[0, 1.1, 0.03]} s={[1.12, 2.3, 0.05]} c={WOOD} />
      <mesh position={[0, 1.45, 0.09]}>
        <planeGeometry args={[0.6, 0.9]} />
        <meshStandardMaterial color="#1a2438" emissive="#31456e" emissiveIntensity={0.4} />
      </mesh>
      <Box p={[0.35, 1.05, 0.12]} s={[0.04, 0.2, 0.04]} c={BRASS} m={0.9} r={0.3} />
      {sign && (
        <mesh position={[0, 2.42, 0.07]}>
          <planeGeometry args={[0.36, 0.18]} />
          <meshStandardMaterial map={sign} emissive="#ffffff" emissiveIntensity={0.25} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Het hutje achter de voordeur (herkenningspunt van dit café): een donkerhouten portaal van
 * ruim een meter breed met glas bovenin. Voor je is het dicht, je loopt er links of rechts uit.
 */
function Portal({ x, z }: { x: number; z: number }) {
  const w = 1.1;
  const d = 1.2;
  const inner = z - d;
  const mid = z - d / 2;
  return (
    <group>
      <PanelWall p={[x, 0, inner]} w={w} rot={Math.PI} />
      {[-1, 1].map((side) => {
        const sx = x + (side * w) / 2;
        return (
          <group key={side}>
            {/* Open zijkant: hoekstijlen, een glazen bovenlicht en een kroonlijst */}
            <Box p={[sx, 1.28, inner + 0.04]} s={[0.09, 2.56, 0.09]} c={WOOD_DARK} />
            <Box p={[sx, 1.28, z - 0.06]} s={[0.09, 2.56, 0.09]} c={WOOD_DARK} />
            <mesh position={[sx, 2.27, mid]} rotation-y={Math.PI / 2}>
              <boxGeometry args={[d, 0.42, 0.02]} />
              <meshStandardMaterial color="#2a2a24" transparent opacity={0.35} roughness={0.05} />
            </mesh>
            {[-d / 4, 0, d / 4].map((dz) => (
              <Box key={dz} p={[sx, 2.27, mid + dz]} s={[0.06, 0.44, 0.04]} c="#1e130b" />
            ))}
            <Box p={[sx, 2.04, mid]} s={[0.08, 0.06, d]} c="#1e130b" />
            <Box p={[sx, 2.5, mid]} s={[0.14, 0.1, d + 0.08]} c={WOOD_DARK} />
          </group>
        );
      })}
      {/* De zijdeur zelf, in de muur achter het hutje */}
      <Door p={[x, 0, z]} rotY={Math.PI} />
      {/* Plafondje, de rode mat en een warm lampje */}
      <Box p={[x, 2.56, mid]} s={[w + 0.12, 0.03, d + 0.05]} c="#160e08" />
      <Box p={[x, 0.006, mid + 0.05]} s={[w + 1.2, 0.01, d - 0.35]} c="#7d1a16" r={1} />
      <pointLight position={[x, 2.3, mid]} intensity={0.25} distance={2} color="#ffb060" />
    </group>
  );
}

/**
 * Ingelijst portret aan de muur naast Sjaak (zonder naam). Laadt public/portret.png; ontbreekt
 * dat bestand, dan blijft het een donker schilderijtje.
 */
function Portrait() {
  const [tex, setTex] = useState<Texture | null>(null);
  useEffect(() => {
    let live = true;
    new TextureLoader().load(`${import.meta.env.BASE_URL}portret.png`, (t) => {
      t.colorSpace = SRGBColorSpace;
      if (live) setTex(t);
    });
    return () => {
      live = false;
    };
  }, []);
  return (
    <group position={[minX + 0.04, 1.55, -8.7]} rotation-y={Math.PI / 2}>
      <Box p={[0, 0, 0]} s={[0.4, 0.4, 0.04]} c="#5a3a1a" r={0.4} m={0.3} />
      <Box p={[0, 0, 0.021]} s={[0.34, 0.34, 0.005]} c="#e9dcc0" />
      <mesh position={[0, 0, 0.026]}>
        <planeGeometry args={[0.28, 0.28]} />
        <meshStandardMaterial map={tex} color={tex ? '#ffffff' : '#3a2c1e'} roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Tafel tegen de rechtermuur voorin: bank langs de muur, stoelen aan de overkant. */
function WallTable({ z }: { z: number }) {
  const x = minX + 0.6;
  return (
    <group>
      <Box p={[x, 0.74, z]} s={[0.7, 0.04, 1.6]} c={WOOD} r={0.45} />
      {[-0.65, 0.65].map((dz) => (
        <Box key={dz} p={[x, 0.36, z + dz]} s={[0.06, 0.72, 0.06]} c={WOOD_DARK} />
      ))}
      <Candle p={[x + 0.1, 0.76, z + 0.2]} />
      {/* Bank tegen de muur */}
      <Box p={[minX + 0.2, 0.22, z]} s={[0.4, 0.44, 1.8]} c={WOOD_DARK} />
      <Box p={[minX + 0.21, 0.47, z]} s={[0.38, 0.06, 1.76]} c="#7a1418" />
      <Box p={[minX + 0.06, 0.8, z]} s={[0.08, 0.6, 1.8]} c="#5c1012" />
      {[-0.4, 0.4].map((dz) => (
        <Chair key={dz} p={[x + 0.6, 0, z + dz]} rotY={-Math.PI / 2} />
      ))}
    </group>
  );
}

function Front({ t }: { t: ReturnType<typeof useTextures> }) {
  const z = maxZ;
  return (
    <group>
      <mesh position={[0, H / 2, z]} rotation-y={Math.PI}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color={OCHRE} roughness={0.95} />
      </mesh>
      <Box p={[0, 0.4, z - 0.03]} s={[W, 0.8, 0.06]} c={PANEL} />
      {[-3.25, -1.1, 0.65].map((x) => (
        <Window key={x} p={[x, 1.75, z - 0.04]} rotY={Math.PI} w={1.3} h={1.8} />
      ))}
      <mesh position={[0.65, 2.85, z - 0.08]} rotation-y={Math.PI}>
        <planeGeometry args={[0.9, 0.28]} />
        <meshBasicMaterial map={t.neon} transparent />
      </mesh>
      <pointLight position={[0.65, 2.7, z - 0.5]} intensity={0.6} distance={3} color="#ff3a2a" />
      {/* Hoofdingang: helemaal links in de voorgevel (vanaf jouw plek gezien) */}
      <Door p={[FRONT_DOOR_X, 0, z]} rotY={Math.PI} />
    </group>
  );
}

/**
 * Zijingang halverwege de rechtermuur (ramenkant) met het houten hutje ervoor: je loopt er
 * links of rechts omheen het café in.
 */
function SideEntrance() {
  return (
    <group position={[minX, 0, 0]} rotation-y={-Math.PI / 2}>
      <Portal x={0} z={0} />
    </group>
  );
}

/** Dicht achter de achterbar, met de WC-deur net voorbij het eind van de bar. */
function BehindBar({ t }: { t: ReturnType<typeof useTextures> }) {
  const w = maxX - BEHIND_X;
  const cx = (maxX + BEHIND_X) / 2;
  return (
    <group>
      {[BAR.z0, BAR.z1].map((z) => (
        <Box key={z} p={[cx, H / 2, z]} s={[w, H, 0.12]} c="#2a1c12" r={0.9} />
      ))}
      <Door p={[WC_DOOR_X, 0, BAR.z1 + 0.06]} rotY={0} sign={t.wc} />
    </group>
  );
}

/** De speeltafel: rechthoekig houten café-tafeltje met een groen kaartkleedje. */
/** De speeltafel (met groen kleedje), of een van de gelijke tafels ernaast langs de bank. */
export function GameTable({ x = TABLE.x, mat = true }: { x?: number; mat?: boolean }) {
  return (
    <group position={[x, 0, TABLE.z]}>
      <mesh position={[0, TABLE_TOP - 0.022, 0]} receiveShadow castShadow>
        <boxGeometry args={[TABLE.w, 0.04, TABLE.d]} />
        <meshStandardMaterial color={WOOD} roughness={0.45} />
      </mesh>
      {mat && (
        <mesh position={[0, TABLE_TOP - 0.001, 0]} receiveShadow>
          <boxGeometry args={[TABLE.w - 0.16, 0.004, TABLE.d - 0.14]} />
          <meshStandardMaterial color="#1d5a37" roughness={1} />
        </mesh>
      )}
      <Box p={[0, TABLE_TOP / 2, 0]} s={[0.08, TABLE_TOP - 0.05, 0.08]} c={WOOD_DARK} />
      <Box p={[0, 0.02, 0]} s={[0.5, 0.04, 0.45]} c={WOOD_DARK} />
      {/* Kaarsje aan de verre rand, tussen Ria en Henk in: los van de glazen (anders flikkert het). */}
      <Candle p={[0, TABLE_TOP, TABLE.d / 2 - 0.07]} light={mat} />
    </group>
  );
}

export function Cafe() {
  const t = useTextures();
  return (
    <group>
      <color attach="background" args={['#0d0907']} />
      <fog attach="fog" args={['#120c08', 9, 22]} />
      <hemisphereLight args={['#ffcf9a', '#2a1c12', 0.6]} />
      {/* Zacht licht boven jullie tafel, zodat de kaarten leesbaar blijven */}
      <spotLight
        position={[TABLE.x + 0.2, 2.8, TABLE.z + 0.4]}
        target-position={[TABLE.x, TABLE_TOP, TABLE.z]}
        angle={0.7}
        penumbra={0.9}
        intensity={18}
        decay={1.5}
        color="#ffd7a0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />

      {/* Vloer, geblokte strook langs de bar, houten plafond */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={t.floor} roughness={0.85} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} rotation-z={Math.PI / 2} position={[BAR.x - 1.1, 0.002, 0]}>
        <planeGeometry args={[D - 1, 0.07]} />
        <meshStandardMaterial map={t.checker} roughness={0.8} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, H, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={t.planks} roughness={0.7} />
      </mesh>
      {[-6, -3, 0, 3, 6].map((z) => (
        <Box key={z} p={[0, H - 0.08, z]} s={[W, 0.16, 0.14]} c="#2a1a10" />
      ))}

      <MirrorWall t={t} />
      <LeftWall t={t} />
      <mesh position={[maxX, H / 2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial color="#2a1c12" roughness={0.95} />
      </mesh>
      <Bar t={t} />
      <Front t={t} />

      <GameTable />
      {/* Langs de spiegelbank, links van jullie: nog twee precies zulke tafels */}
      {[TABLE.x, TABLE.x + 1.25, TABLE.x + 2.5].map((x, i) => (
        <group key={x}>
          {i > 0 && <GameTable x={x} mat={false} />}
          <Chair p={[x + 0.3, 0, TABLE.z + 0.73]} rotY={Math.PI} />
          <Chair p={[x - 0.3, 0, TABLE.z + 0.73]} rotY={Math.PI} />
        </group>
      ))}

      <Barrel p={[1.7, 0, -6.9]} />
      {/* Ramenkant: één rij tafeltjes, dan het gangpad, dan de krukken van de bar. */}
      <SmallTable p={[WALL_TABLE_X, 0, -5.5]} />
      <SmallTable p={[WALL_TABLE_X, 0, -3.6]} />
      <SmallTable p={[WALL_TABLE_X, 0, -1.8]} />
      <SideEntrance />
      <WallTable z={1.9} />
      <SmallTable p={[WALL_TABLE_X, 0, 4.0]} />
      <SmallTable p={[WALL_TABLE_X, 0, 6.4]} />
      <BehindBar t={t} />
      <Portrait />
    </group>
  );
}
