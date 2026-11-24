import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';
import { cardId, type Card, type Suit } from '../../engine';

const SYMBOL: Record<Suit, string> = { klaveren: '♣', ruiten: '♦', harten: '♥', schoppen: '♠' };
const RED: Record<Suit, boolean> = { klaveren: false, ruiten: true, harten: true, schoppen: false };
const W = 256;
const H = 358;
const cache = new Map<string, Texture>();

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function draw(card: Card | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  if (!card) {
    roundRect(ctx, 0, 0, W, H, 22);
    ctx.fillStyle = '#8c1c13';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = '#e8b4a0';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    roundRect(ctx, 22, 22, W - 44, H - 44, 12);
    ctx.stroke();
    return canvas;
  }

  roundRect(ctx, 0, 0, W, H, 22);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = RED[card.suit] ? '#c62828' : '#1b1b1b';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(card.rank, 20, 16);
  ctx.font = '52px system-ui, sans-serif';
  ctx.fillText(SYMBOL[card.suit], 22, 84);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '150px system-ui, sans-serif';
  ctx.fillText(SYMBOL[card.suit], W / 2, H / 2 + 20);

  ctx.save();
  ctx.translate(W - 20, H - 16);
  ctx.rotate(Math.PI);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(card.rank, 0, 0);
  ctx.restore();
  return canvas;
}

/** Kaarttextuur, getekend met canvas en gecachet. null = achterkant. */
export function cardTexture(card: Card | null): Texture {
  const key = card ? cardId(card) : 'achterkant';
  let tex = cache.get(key);
  if (!tex) {
    tex = new CanvasTexture(draw(card));
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    cache.set(key, tex);
  }
  return tex;
}

/**
 * Voorkant van een kaart in andermans hand: wit met vage tekens, van een afstand niet te lezen.
 * Zo houdt iedereen zijn kaarten met de voorkant naar zich toe, zonder dat jij iets ziet.
 */
export function blurredFaceTexture(): Texture {
  let tex = cache.get('vaag');
  if (!tex) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 90;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f4f1ea';
    ctx.beginPath();
    ctx.roundRect(0, 0, 64, 90, 6);
    ctx.fill();
    ctx.filter = 'blur(3px)';
    ctx.fillStyle = 'rgba(120, 110, 110, 0.45)';
    ctx.fillRect(8, 8, 10, 16);
    ctx.fillRect(24, 34, 16, 22);
    ctx.fillRect(46, 66, 10, 16);
    tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    cache.set('vaag', tex);
  }
  return tex;
}
