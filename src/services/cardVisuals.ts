import { randomBytes } from 'crypto';
import { AppError } from '../middleware/errorHandler.js';
import type { CardStyle, Rarity } from '../types/index.js';

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#94a3b8',
  uncommon: '#34d399',
  rare: '#60a5fa',
  epic: '#c084fc',
  legendary: '#fbbf24',
  mythic: '#fb7185',
};

export function slugifySeed(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || `card-${randomBytes(3).toString('hex')}`;
}

export function defaultGlow(rarity: Rarity): string {
  return RARITY_COLOR[rarity];
}

export function defaultBorder(rarity: Rarity): string {
  return RARITY_COLOR[rarity];
}

export function defaultBackColor(style: CardStyle): string {
  const map: Record<CardStyle, string> = {
    painterly: '#1a1028',
    pixel: '#111827',
    comic: '#1e1b4b',
    gothic: '#0f0a12',
    neon: '#050816',
    stained_glass: '#14081f',
    watercolor: '#1b1530',
    holographic: '#101018',
  };
  return map[style];
}

export const DEFAULT_TEXT_COLOR = '#f4efe6';

export function makeSerial(editionCode: string, collectorNumber: number): string {
  const n = String(collectorNumber).padStart(3, '0');
  return `AP-${editionCode}-${n}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value);
}

export function giphyIdFromUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== 'giphy.com' && !host.endsWith('.giphy.com')) return null;
  const media = url.pathname.match(/\/media\/([A-Za-z0-9]+)/i);
  if (media) return media[1];
  const file = url.pathname.match(/\/([A-Za-z0-9]{4,32})\.(?:gif|webp|mp4)$/i);
  if (file) return file[1];
  const last = (url.pathname.split('/').filter(Boolean).at(-1) || '').replace(/\.(gif|webp|mp4)$/i, '');
  if (/^[A-Za-z0-9]{4,32}$/.test(last)) return last;
  const token = last.split('-').at(-1) || '';
  return /^[A-Za-z0-9]{4,32}$/.test(token) ? token : null;
}

export function giphyGifUrl(id: string): string {
  return `https://i.giphy.com/${id}.gif`;
}

export function giphyStillUrl(id: string): string {
  return `https://media.giphy.com/media/${id}/giphy_s.gif`;
}

export function originGiphyUrl(...urls: Array<string | null | undefined>): string | null {
  for (const url of urls) {
    const id = giphyIdFromUrl(url);
    if (id) return giphyGifUrl(id);
  }
  return null;
}

export function normalizeMediaUrl(value: unknown, field = 'illustration'): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new AppError(`${field} invalide`, 400);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^(https?:\/\/|\/uploads\/|\/boosters\/)/i.test(trimmed) || /[\s<>]/.test(trimmed)) {
    throw new AppError(`L’${field} doit être un fichier uploadé, un visuel de booster ou une URL http(s)`, 400);
  }
  return rewriteGiphyUrl(trimmed).slice(0, 500);
}

function rewriteGiphyUrl(raw: string): string {
  const id = giphyIdFromUrl(raw);
  if (!id) return raw;
  if (/giphy_s|_s\.gif|\.webp$/i.test(raw)) return giphyStillUrl(id);
  return giphyGifUrl(id);
}
