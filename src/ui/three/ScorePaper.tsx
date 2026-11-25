import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { nl } from '../../i18n/nl';
import { TABLE, TABLE_TOP } from './layout';

export interface ScoreRows {
  /** Per gespeeld spel: wat er op het blok kwam voor wij en zij, en of iemand nat ging. */
  rows: { total: [number, number]; nat: 0 | 1 | null }[];
  sum: [number, number];
}

const W = 384;
const H = 532;

function draw(ctx: CanvasRenderingContext2D, s: ScoreRows) {
  ctx.fillStyle = '#f3ecd9';
  ctx.fillRect(0, 0, W, H);
  // Lichte lijntjes van een blocnote, rode kantlijn
  ctx.strokeStyle = 'rgba(90,120,170,0.35)';
  ctx.lineWidth = 2;
  for (let y = 70; y < H; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(200,60,60,0.5)';
  ctx.beginPath();
  ctx.moveTo(W / 2, 20);
  ctx.lineTo(W / 2, H - 20);
  ctx.stroke();

  const hand = '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
  ctx.fillStyle = '#1d2a55';
  ctx.textAlign = 'center';
  ctx.font = `bold 38px ${hand}`;
  ctx.fillText(nl.teams[0], W / 4, 56);
  ctx.fillText(nl.teams[1], (3 * W) / 4, 56);

  ctx.font = `30px ${hand}`;
  const shown = s.rows.slice(-11);
  shown.forEach((r, i) => {
    const y = 98 + i * 34;
    ([0, 1] as const).forEach((t) => {
      const text = r.nat === t ? `${r.total[t]} nat` : String(r.total[t]);
      ctx.fillText(text, ((2 * t + 1) * W) / 4, y);
    });
  });
  // Streep en totaal
  const yLine = 98 + shown.length * 34 - 18;
  ctx.strokeStyle = '#1d2a55';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(30, yLine);
  ctx.lineTo(W - 30, yLine);
  ctx.stroke();
  ctx.font = `bold 40px ${hand}`;
  ctx.fillText(String(s.sum[0]), W / 4, yLine + 44);
  ctx.fillText(String(s.sum[1]), (3 * W) / 4, yLine + 44);
}

/** Het scorebriefje op tafel (tussen Sjaak en Henk), met een pen: zo schrijf je in een café de stand op. */
export function ScorePaper({ score }: { score: ScoreRows }) {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  }, []);
  const tex = useMemo(() => {
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [canvas]);
  const key = JSON.stringify(score);
  useEffect(() => {
    draw(canvas.getContext('2d')!, score);
    tex.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, canvas, tex]);

  return (
    <group
      position={[TABLE.x - 0.34, TABLE_TOP + 0.002, TABLE.z - 0.01]}
      rotation-y={Math.PI - 0.35}
    >
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[0.15, 0.21]} />
        <meshStandardMaterial map={tex} roughness={0.95} />
      </mesh>
      {/* Balpen */}
      <group position={[0.095, 0.005, 0.01]} rotation-y={0.15}>
        <mesh rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.0045, 0.0045, 0.13, 10]} />
          <meshStandardMaterial color="#1f3d8a" roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.07]} rotation-x={Math.PI / 2}>
          <coneGeometry args={[0.0045, 0.012, 10]} />
          <meshStandardMaterial color="#c9c9c9" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}
