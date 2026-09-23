import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { FAR_FAR_AWAY_CARDS, type FarFarAwayCardSeed } from './farFarAwayCatalog.js';

const require = createRequire(import.meta.url);
const { GIFEncoder, quantize, applyPalette } = require('gifenc') as {
  GIFEncoder: (options?: { auto?: boolean }) => {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: number[][]; delay?: number; repeat?: number },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  quantize: (rgba: Uint8Array | Uint8ClampedArray, maxColors: number) => number[][];
  applyPalette: (rgba: Uint8Array | Uint8ClampedArray, palette: number[][]) => Uint8Array;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 240;
const H = 176;
const FRAMES = 10;
const DELAY = 80;

type RGB = [number, number, number];

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed: number) {
  let a = seed || 1;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function setPx(buf: Uint8ClampedArray, x: number, y: number, rgb: RGB, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = rgb[0];
  buf[i + 1] = rgb[1];
  buf[i + 2] = rgb[2];
  buf[i + 3] = a;
}

function fillRect(buf: Uint8ClampedArray, x: number, y: number, w: number, h: number, rgb: RGB) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) setPx(buf, px, py, rgb);
  }
}

function fillCircle(buf: Uint8ClampedArray, cx: number, cy: number, r: number, rgb: RGB) {
  const rr = r * r;
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(W, Math.ceil(cx + r));
  const y1 = Math.min(H, Math.ceil(cy + r));
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= rr) setPx(buf, x, y, rgb);
    }
  }
}

function fillEllipse(buf: Uint8ClampedArray, cx: number, cy: number, rx: number, ry: number, rgb: RGB) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const x1 = Math.min(W, Math.ceil(cx + rx));
  const y1 = Math.min(H, Math.ceil(cy + ry));
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) setPx(buf, x, y, rgb);
    }
  }
}

function skyFor(magic: FarFarAwayCardSeed['magicType']): [RGB, RGB] {
  const map: Record<string, [RGB, RGB]> = {
    swamp: [[18, 42, 24], [72, 110, 48]],
    nature: [[28, 62, 88], [110, 168, 92]],
    fire: [[48, 18, 22], [186, 72, 42]],
    water: [[16, 42, 78], [72, 150, 186]],
    shadow: [[12, 10, 28], [72, 48, 110]],
    holy: [[48, 42, 72], [232, 196, 120]],
    arcane: [[32, 18, 64], [168, 92, 196]],
    chaos: [[64, 18, 48], [232, 120, 72]],
    tech: [[8, 28, 42], [42, 186, 196]],
    none: [[28, 32, 48], [110, 96, 72]],
  };
  return map[magic] ?? map.none;
}

function drawBackground(buf: Uint8ClampedArray, card: FarFarAwayCardSeed, t: number, rnd: () => number) {
  const [top, bot] = skyFor(card.magicType);
  for (let y = 0; y < H; y += 1) {
    const sky = mix(top, bot, y / H);
    for (let x = 0; x < W; x += 1) setPx(buf, x, y, sky);
  }
  const groundY = 118 + Math.round(Math.sin(t * 0.4) * 2);
  fillRect(buf, 0, groundY, W, H - groundY, mix(bot, [36, 48, 28], 0.5));
  fillEllipse(buf, 40, groundY + 18, 70, 16, [48, 72, 36]);
  fillEllipse(buf, 190, groundY + 22, 80, 18, [32, 58, 30]);
  for (let i = 0; i < 7; i += 1) {
    const x = 12 + i * 34;
    const sway = Math.sin(t * 0.8 + i) * 3;
    fillRect(buf, x + sway, groundY - 18 - (i % 3) * 6, 3, 22, [70, 110, 52]);
  }
  for (let i = 0; i < 8; i += 1) {
    const x = (rnd() * W + t * 4 + i * 29) % W;
    const y = 18 + ((rnd() * 70 + Math.sin(t + i) * 8 + 70) % 70);
    fillCircle(buf, x, y, 1 + (i % 2), [240, 250, 160]);
  }
}

function ogre(buf: Uint8ClampedArray, cx: number, cy: number, s: number, t: number, body: RGB, accent: RGB) {
  const bob = Math.sin(t) * 2;
  fillEllipse(buf, cx, cy + 18 + bob, 28 * s, 32 * s, body);
  fillEllipse(buf, cx, cy - 10 + bob, 20 * s, 18 * s, body);
  fillCircle(buf, cx - 16 * s, cy - 18 + bob, 7 * s, body);
  fillCircle(buf, cx + 16 * s, cy - 18 + bob, 7 * s, body);
  fillEllipse(buf, cx, cy + 6 + bob, 16 * s, 10 * s, accent);
  fillCircle(buf, cx - 6 * s, cy - 12 + bob, 3, [20, 24, 16]);
  fillCircle(buf, cx + 6 * s, cy - 12 + bob, 3, [20, 24, 16]);
}

function quadruped(buf: Uint8ClampedArray, cx: number, cy: number, t: number, body: RGB, ears: number) {
  const bob = Math.sin(t * 1.4) * 2;
  fillEllipse(buf, cx, cy + 8 + bob, 30, 16, body);
  fillEllipse(buf, cx + 22, cy - 2 + bob, 14, 12, body);
  fillEllipse(buf, cx + 22, cy - 16 + bob, 4, ears, body);
  fillEllipse(buf, cx + 28, cy - 16 + bob, 4, ears, body);
  fillRect(buf, cx - 18, cy + 18 + bob, 5, 16, mix(body, [20, 20, 20], 0.3));
  fillRect(buf, cx - 6, cy + 18 + bob, 5, 16, mix(body, [20, 20, 20], 0.3));
  fillRect(buf, cx + 10, cy + 16 + Math.sin(t * 1.4 + 1) * 3, 5, 16, mix(body, [20, 20, 20], 0.3));
  fillRect(buf, cx + 20, cy + 16 + Math.sin(t * 1.4 + 2) * 3, 5, 16, mix(body, [20, 20, 20], 0.3));
}

function winged(buf: Uint8ClampedArray, cx: number, cy: number, t: number, body: RGB, wing: RGB) {
  const flap = 18 + Math.sin(t * 2) * 10;
  fillEllipse(buf, cx - 28, cy, 26, flap, wing);
  fillEllipse(buf, cx + 28, cy, 26, flap, wing);
  fillEllipse(buf, cx, cy + 8, 22, 28, body);
  fillEllipse(buf, cx + 18, cy - 10, 16, 12, body);
  fillCircle(buf, cx + 26, cy - 14, 4, [240, 80, 40]);
}

function figure(buf: Uint8ClampedArray, cx: number, cy: number, t: number, dress: RGB, skin: RGB, hat?: RGB) {
  const bob = Math.sin(t) * 1.5;
  fillEllipse(buf, cx, cy + 20 + bob, 18, 26, dress);
  fillCircle(buf, cx, cy - 6 + bob, 10, skin);
  if (hat) fillEllipse(buf, cx, cy - 16 + bob, 12, 8, hat);
}

function drawMotif(buf: Uint8ClampedArray, card: FarFarAwayCardSeed, t: number) {
  const cx = 120;
  const cy = 96;
  const m = card.motif;
  if (m.startsWith('ogre')) ogre(buf, cx, cy, m.includes('child') ? 0.7 : 1, t, [92, 148, 48], [96, 64, 36]);
  else if (m === 'donkey' || m === 'foal') quadruped(buf, cx - 8, cy + 8, t, [140, 124, 108], m === 'foal' ? 10 : 16);
  else if (m === 'cat' || m === 'kitten' || m === 'musketeer') {
    const bob = Math.sin(t) * 2;
    fillEllipse(buf, cx, cy + 10 + bob, 16, 20, [212, 132, 48]);
    fillCircle(buf, cx, cy - 10 + bob, 12, [212, 132, 48]);
    fillEllipse(buf, cx - 10, cy - 20 + bob, 4, 8, [40, 28, 20]);
    fillEllipse(buf, cx + 10, cy - 20 + bob, 4, 8, [40, 28, 20]);
    fillEllipse(buf, cx, cy - 22 + bob, 14, 6, [28, 80, 48]);
    fillRect(buf, cx + 10, cy - 28 + bob, 3, 14, [180, 40, 40]);
    fillRect(buf, cx - 8, cy + 28 + bob, 7, 10, [40, 28, 20]);
    fillRect(buf, cx + 4, cy + 28 + bob, 7, 10, [40, 28, 20]);
  } else if (m.includes('dragon') || m === 'hatchling') {
    winged(buf, cx, cy, t, m === 'hatchling' || m === 'baby-dragon' ? [186, 92, 64] : [148, 48, 92], [88, 28, 64]);
  } else if (m.startsWith('cookie')) {
    const bob = Math.abs(Math.sin(t * 2)) * 8;
    fillEllipse(buf, cx, cy + 8 - bob, 16, 22, [196, 140, 72]);
    fillCircle(buf, cx, cy - 12 - bob, 10, [196, 140, 72]);
    fillCircle(buf, cx - 4, cy - 14 - bob, 2, [40, 24, 16]);
    fillCircle(buf, cx + 4, cy - 14 - bob, 2, [40, 24, 16]);
    fillRect(buf, cx - 6, cy - 6 - bob, 12, 3, [250, 240, 230]);
  } else if (m === 'princess' || m === 'lady' || m === 'queen') {
    figure(buf, cx, cy, t, m === 'queen' ? [180, 210, 230] : [196, 72, 120], [232, 196, 164], [232, 196, 80]);
  } else if (m.includes('fairy') || m === 'rebel') {
    const flap = 8 + Math.sin(t * 3) * 6;
    fillEllipse(buf, cx - 16, cy, 14, flap, [180, 230, 255]);
    fillEllipse(buf, cx + 16, cy, 14, flap, [180, 230, 255]);
    figure(buf, cx, cy, t, [240, 180, 220], [255, 230, 210], [250, 250, 180]);
    fillRect(buf, cx + 12, cy - 4, 3, 22, [250, 220, 120]);
  } else if (m.startsWith('wolf')) {
    quadruped(buf, cx, cy + 6, t, [110, 110, 118], 12);
    fillEllipse(buf, cx + 8, cy - 4, 10, 6, [230, 230, 236]);
  } else if (m.startsWith('pig')) {
    quadruped(buf, cx, cy + 10, t, [232, 160, 168], 6);
    fillEllipse(buf, cx + 28, cy + 6, 8, 6, [220, 120, 128]);
    if (m === 'pig-brick') fillRect(buf, 20, 70, 40, 50, [168, 72, 56]);
    if (m === 'pig-wood') fillRect(buf, 20, 78, 36, 42, [128, 84, 48]);
  } else if (m === 'frog' || m === 'toad') {
    const bob = Math.sin(t * 2) * 6;
    fillEllipse(buf, cx, cy + 16 - bob, 22, 14, [64, 148, 72]);
    fillCircle(buf, cx - 8, cy + 4 - bob, 8, [64, 148, 72]);
    fillCircle(buf, cx + 8, cy + 4 - bob, 8, [64, 148, 72]);
    if (m === 'frog') fillEllipse(buf, cx, cy - 6 - bob, 8, 4, [232, 196, 72]);
  } else if (m === 'giant' || m === 'troll') {
    ogre(buf, cx, cy - 8, 1.35, t, m === 'troll' ? [72, 120, 88] : [148, 120, 88], [80, 56, 40]);
  } else if (m === 'dwarf' || m === 'smith') {
    figure(buf, cx, cy + 8, t, [96, 72, 48], [210, 160, 120], [180, 48, 48]);
    fillRect(buf, cx + 14, cy + 8, 6, 20, [80, 80, 88]);
  } else if (m === 'witch') {
    figure(buf, cx, cy, t, [48, 28, 72], [210, 180, 160], [24, 16, 32]);
    fillRect(buf, cx - 2, cy - 28, 4, 16, [24, 16, 32]);
  } else if (m === 'knight' || m === 'guard') {
    figure(buf, cx, cy, t, [160, 160, 168], [210, 180, 150], [196, 160, 72]);
    fillRect(buf, cx + 16, cy - 8, 4, 28, [200, 180, 80]);
  } else if (m === 'rat') {
    quadruped(buf, cx, cy + 18, t, [128, 112, 104], 4);
  } else if (m === 'bird' || m === 'owl') {
    const flap = 10 + Math.sin(t * 2.2) * 7;
    fillEllipse(buf, cx, cy + 8, 14, 18, m === 'owl' ? [160, 124, 72] : [72, 140, 196]);
    fillEllipse(buf, cx - 16, cy + 4, 12, flap, [40, 80, 120]);
    fillEllipse(buf, cx + 16, cy + 4, 12, flap, [40, 80, 120]);
    fillCircle(buf, cx, cy - 6, 8, m === 'owl' ? [160, 124, 72] : [72, 140, 196]);
  } else if (m === 'tree') {
    const sway = Math.sin(t) * 4;
    fillRect(buf, cx - 6, cy + 10, 12, 40, [96, 64, 36]);
    fillCircle(buf, cx + sway, cy, 32, [48, 120, 56]);
    fillCircle(buf, cx - 8 + sway, cy + 8, 6, [210, 190, 140]);
  } else if (m === 'mud') {
    const blob = 26 + Math.sin(t) * 6;
    fillEllipse(buf, cx, cy + 16, blob, 20, [92, 72, 40]);
    fillEllipse(buf, cx, cy + 4, 18, 16, [110, 86, 48]);
  } else if (m === 'king') {
    figure(buf, cx, cy + 12, t, [180, 40, 60], [232, 196, 164], [240, 196, 64]);
  } else if (m === 'jester') {
    figure(buf, cx, cy, t, [196, 48, 72], [232, 196, 164], [48, 140, 72]);
  } else if (m === 'hunter' || m === 'shepherd') {
    figure(buf, cx, cy, t, [72, 88, 56], [210, 170, 130], [56, 40, 28]);
    fillRect(buf, cx + 16, cy - 10, 3, 36, [96, 72, 40]);
  } else if (m === 'sheep') {
    fillEllipse(buf, cx, cy + 10, 24, 16, [236, 236, 230]);
    fillCircle(buf, cx + 20, cy + 4, 8, [236, 236, 230]);
    fillCircle(buf, cx + 22, cy + 2, 5, [40, 36, 32]);
  } else if (m === 'boar') {
    quadruped(buf, cx, cy + 8, t, [96, 72, 56], 5);
    fillRect(buf, cx + 32, cy + 4, 8, 3, [230, 230, 220]);
  } else if (m === 'golem') {
    const bob = Math.sin(t) * 2;
    fillRect(buf, cx - 16, cy - 4 + bob, 32, 40, [232, 196, 160]);
    fillRect(buf, cx - 10, cy - 20 + bob, 20, 16, [232, 196, 160]);
    fillRect(buf, cx - 12, cy - 8 + bob, 24, 4, [250, 240, 230]);
  } else if (m === 'ghost') {
    fillEllipse(buf, cx, cy + 4, 18, 28, [210, 220, 230]);
    fillCircle(buf, cx, cy - 16, 12, [210, 220, 230]);
    fillCircle(buf, cx - 4, cy - 16, 2, [20, 20, 30]);
    fillCircle(buf, cx + 4, cy - 16, 2, [20, 20, 30]);
  } else if (m === 'horse') {
    quadruped(buf, cx, cy, t, [196, 160, 72], 10);
  } else if (m === 'nymph') {
    figure(buf, cx, cy, t, [64, 140, 120], [210, 230, 200]);
    fillEllipse(buf, cx - 18, cy + 20, 10, 16, [48, 120, 72]);
  } else if (m === 'onion') {
    fillEllipse(buf, cx, cy + 8, 22, 28, [232, 180, 72]);
    fillEllipse(buf, cx, cy + 8, 16, 22, [196, 120, 48]);
    fillRect(buf, cx - 2, cy - 22, 4, 12, [48, 120, 52]);
  } else if (m.includes('boot')) {
    fillEllipse(buf, cx - 16, cy + 16, 16, 22, [72, 48, 28]);
    fillEllipse(buf, cx + 18, cy + 18, 16, 22, [72, 48, 28]);
    if (m === 'hat-boots') fillEllipse(buf, cx, cy - 18, 22, 10, [28, 80, 48]);
  } else if (m === 'scroll' || m === 'decree') {
    fillRect(buf, cx - 24, cy - 16, 48, 40, [236, 220, 180]);
    fillRect(buf, cx - 18, cy - 8, 36, 3, [180, 80, 100]);
    fillRect(buf, cx - 18, cy, 28, 3, [180, 80, 100]);
  } else if (m === 'potion') {
    fillEllipse(buf, cx, cy + 8, 14, 20, [48, 160, 88]);
    fillRect(buf, cx - 6, cy - 16, 12, 12, [210, 180, 120]);
    fillCircle(buf, cx + 4, cy + 4, 4, [180, 255, 180]);
  } else if (m === 'crown') {
    fillRect(buf, cx - 22, cy + 4, 44, 12, [232, 188, 64]);
    fillCircle(buf, cx - 18, cy - 4, 6, [232, 188, 64]);
    fillCircle(buf, cx, cy - 10, 7, [232, 188, 64]);
    fillCircle(buf, cx + 18, cy - 4, 6, [232, 188, 64]);
  } else if (m === 'lantern') {
    fillRect(buf, cx - 10, cy - 4, 20, 28, [232, 196, 80]);
    fillRect(buf, cx - 6, cy - 14, 12, 8, [72, 56, 32]);
    fillCircle(buf, cx, cy + 8, 6 + Math.sin(t) * 2, [255, 240, 160]);
  } else if (m === 'mirror') {
    fillEllipse(buf, cx, cy, 22, 32, [180, 196, 210]);
    fillEllipse(buf, cx, cy, 16, 26, [80, 120, 160]);
  } else if (m === 'bag') {
    fillEllipse(buf, cx, cy + 8, 22, 20, [120, 84, 48]);
    fillRect(buf, cx - 8, cy - 10, 16, 12, [96, 64, 36]);
  } else if (m === 'key') {
    fillCircle(buf, cx - 10, cy, 10, [212, 172, 64]);
    fillRect(buf, cx - 2, cy - 3, 28, 6, [212, 172, 64]);
  } else if (m === 'swamp' || m === 'pond' || m === 'fields' || m === 'forest') {
    fillEllipse(buf, 120, 130, 90, 18, [36, 72, 48]);
    fillCircle(buf, 50, 90, 28, [32, 88, 40]);
    fillCircle(buf, 180, 80, 36, [28, 72, 36]);
  } else if (m === 'square') {
    fillRect(buf, 40, 70, 160, 70, [186, 150, 110]);
    fillRect(buf, 70, 40, 40, 50, [196, 80, 100]);
    fillRect(buf, 140, 30, 36, 60, [80, 96, 160]);
  } else if (m === 'keep') {
    fillRect(buf, 80, 40, 80, 90, [88, 72, 80]);
    fillRect(buf, 100, 18, 40, 30, [72, 56, 64]);
    fillEllipse(buf, 160, 36, 28, 16, [148, 48, 72]);
  } else if (m === 'bridge') {
    fillEllipse(buf, 120, 140, 100, 16, [40, 80, 90]);
    fillRect(buf, 30, 100, 180, 12, [120, 88, 56]);
  } else if (m === 'mill') {
    fillRect(buf, 70, 50, 100, 80, [140, 72, 64]);
    fillRect(buf, 90, 20, 18, 40, [80, 48, 40]);
    fillCircle(buf, 160, 40, 8 + Math.sin(t) * 2, [255, 160, 80]);
  } else if (m === 'sparkle' || m === 'aura' || m === 'quota') {
    for (let i = 0; i < 12; i += 1) {
      const a = t + i * 0.6;
      fillCircle(buf, cx + Math.cos(a) * 40, cy + Math.sin(a * 1.3) * 24, 3, [250, 210, 240]);
    }
    fillCircle(buf, cx, cy, 16, [232, 160, 210]);
  } else if (m === 'wind' || m === 'steam') {
    for (let i = 0; i < 6; i += 1) {
      fillEllipse(buf, 40 + i * 30 + Math.sin(t + i) * 8, 80, 24, 8, [210, 220, 230]);
    }
  } else if (m === 'curse') {
    fillEllipse(buf, cx, cy, 40, 30, [48, 24, 72]);
    fillCircle(buf, cx, cy, 10 + Math.sin(t) * 4, [120, 48, 160]);
  } else if (m === 'peace') {
    fillEllipse(buf, cx, cy + 10, 50, 16, [64, 120, 72]);
    fillCircle(buf, cx, cy - 10, 18, [250, 230, 140]);
  } else {
    ogre(buf, cx, cy, 0.9, t, [100, 140, 90], [80, 60, 40]);
  }
}

function writePng(file: string, buf: Uint8ClampedArray) {
  const png = new PNG({ width: W, height: H });
  png.data = Buffer.from(buf);
  fs.writeFileSync(file, PNG.sync.write(png));
}

function writeGif(file: string, frames: Uint8ClampedArray[]) {
  const gif = GIFEncoder();
  frames.forEach((frame) => {
    const palette = quantize(frame, 256);
    const index = applyPalette(frame, palette);
    gif.writeFrame(index, W, H, { palette, delay: DELAY });
  });
  gif.finish();
  fs.writeFileSync(file, Buffer.from(gif.bytes()));
}

function proceduralFrames(card: FarFarAwayCardSeed): Uint8ClampedArray[] {
  const frames: Uint8ClampedArray[] = [];
  for (let f = 0; f < FRAMES; f += 1) {
    const buf = new Uint8ClampedArray(W * H * 4);
    const t = f * 0.55;
    const rnd = mulberry(hash(card.slug) + f * 17);
    drawBackground(buf, card, t, rnd);
    drawMotif(buf, card, t);
    frames.push(buf);
  }
  return frames;
}

function resizeRgba(src: Buffer, sw: number, sh: number, dw: number, dh: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const sx = Math.min(sw - 1, Math.floor((x / dw) * sw));
      const sy = Math.min(sh - 1, Math.floor((y / dh) * sh));
      const si = (sy * sw + sx) * 4;
      const di = (y * dw + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3] ?? 255;
    }
  }
  return out;
}

function animateStill(base: Uint8ClampedArray): Uint8ClampedArray[] {
  const frames: Uint8ClampedArray[] = [];
  for (let f = 0; f < FRAMES; f += 1) {
    const buf = new Uint8ClampedArray(base);
    const band = Math.floor((f / FRAMES) * W);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = (y * W + x) * 4;
        const shine = Math.max(0, 18 - Math.abs(x - band));
        buf[i] = Math.min(255, buf[i] + shine);
        buf[i + 1] = Math.min(255, buf[i + 1] + shine);
        buf[i + 2] = Math.min(255, buf[i + 2] + shine * 0.8);
      }
    }
    const sparkX = Math.floor((f * 37) % W);
    const sparkY = Math.floor((f * 23) % H);
    fillCircle(buf, sparkX, sparkY, 2, [255, 255, 220]);
    fillCircle(buf, (sparkX + 80) % W, (sparkY + 40) % H, 2, [255, 240, 180]);
    frames.push(buf);
  }
  return frames;
}

function decodeStill(file: string): { data: Buffer; width: number; height: number } {
  const raw = fs.readFileSync(file);
  if (raw[0] === 0xff && raw[1] === 0xd8) {
    const decoded = jpeg.decode(raw, { useTArray: true });
    return { data: Buffer.from(decoded.data), width: decoded.width, height: decoded.height };
  }
  const png = PNG.sync.read(raw);
  return { data: png.data as Buffer, width: png.width, height: png.height };
}

function findStill(filename: string): string | null {
  const candidates = [
    path.resolve(__dirname, '../../assets/far-far-away', filename),
    path.resolve('/home/villaroya/.cursor/projects/home-villaroya-Documents-personal-arcana-pack-back/assets', filename),
  ];
  return candidates.find((file) => fs.existsSync(file)) ?? null;
}

export function publicArtUrls(slug: string): { artUrl: string; artAnimatedUrl: string | null } {
  const uploads = path.resolve(__dirname, '../../uploads/cards');
  const gifPath = path.join(uploads, `${slug}.gif`);
  return {
    artUrl: `/uploads/cards/${slug}.png`,
    artAnimatedUrl: fs.existsSync(gifPath) ? `/uploads/cards/${slug}.gif` : null,
  };
}

export function generateFarFarAwayArt(): { png: number; gif: number } {
  const uploads = path.resolve(__dirname, '../../uploads/cards');
  fs.mkdirSync(uploads, { recursive: true });
  let png = 0;
  let gif = 0;
  for (const card of FAR_FAR_AWAY_CARDS) {
    const pngPath = path.join(uploads, `${card.slug}.png`);
    const gifPath = path.join(uploads, `${card.slug}.gif`);
    if (fs.existsSync(gifPath)) gif += 1;
    if (fs.existsSync(pngPath)) {
      png += 1;
      continue;
    }
    if (card.stillFile) {
      const stillPath = findStill(card.stillFile);
      if (stillPath) {
        const decoded = decodeStill(stillPath);
        const resized = resizeRgba(decoded.data, decoded.width, decoded.height, W, H);
        writePng(pngPath, resized);
        png += 1;
        continue;
      }
    }
    const frames = proceduralFrames(card);
    writePng(pngPath, frames[0]);
    png += 1;
  }
  return { png, gif };
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  const stats = generateFarFarAwayArt();
  console.log(`✅ Art Extrêmement Loin : ${stats.png} PNG, ${stats.gif} GIF`);
}
