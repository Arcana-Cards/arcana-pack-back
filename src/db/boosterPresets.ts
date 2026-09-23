import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from './connection.js';
import { RARITIES, type Rarity, type RarityWeights } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_BOOSTER_ART = '/boosters/default.svg';

export type BoosterPresetKey = 'standard' | 'rare' | 'premium' | 'epique' | 'legendaire' | 'mythique';

export type BoosterPreset = {
  key: BoosterPresetKey;
  name: string;
  description: string;
  cardCount: number;
  guaranteedRarity: Rarity;
  foilChance: number;
  animatedChance: number;
  weights: RarityWeights;
  accent: string;
  accentLight: string;
};

export const BOOSTER_PRESETS: BoosterPreset[] = [
  {
    key: 'standard',
    name: 'Standard',
    description: 'Mix classique : beaucoup de communes, quelques rares.',
    cardCount: 5,
    guaranteedRarity: 'uncommon',
    foilChance: 8,
    animatedChance: 3,
    weights: { common: 62, uncommon: 22, rare: 10, epic: 4, legendary: 1, mythic: 1 },
    accent: '#c9a227',
    accentLight: '#3d2a12',
  },
  {
    key: 'rare',
    name: 'Rare',
    description: 'Les rares tombent nettement plus souvent.',
    cardCount: 5,
    guaranteedRarity: 'rare',
    foilChance: 12,
    animatedChance: 5,
    weights: { common: 20, uncommon: 25, rare: 35, epic: 12, legendary: 6, mythic: 2 },
    accent: '#60a5fa',
    accentLight: '#16324f',
  },
  {
    key: 'premium',
    name: 'Premium',
    description: 'Paquet haut de gamme, épiques et légendaires en vue.',
    cardCount: 5,
    guaranteedRarity: 'epic',
    foilChance: 20,
    animatedChance: 10,
    weights: { common: 8, uncommon: 15, rare: 30, epic: 28, legendary: 14, mythic: 5 },
    accent: '#e8c872',
    accentLight: '#3a2c10',
  },
  {
    key: 'epique',
    name: 'Épique',
    description: 'Tourné vers les épiques, avec une tension légendaire.',
    cardCount: 5,
    guaranteedRarity: 'epic',
    foilChance: 22,
    animatedChance: 12,
    weights: { common: 5, uncommon: 10, rare: 20, epic: 35, legendary: 20, mythic: 10 },
    accent: '#c084fc',
    accentLight: '#2a1644',
  },
  {
    key: 'legendaire',
    name: 'Légendaire',
    description: 'Très peu de communes, grosse tension.',
    cardCount: 5,
    guaranteedRarity: 'legendary',
    foilChance: 25,
    animatedChance: 14,
    weights: { common: 4, uncommon: 8, rare: 16, epic: 22, legendary: 32, mythic: 18 },
    accent: '#fbbf24',
    accentLight: '#3d2a08',
  },
  {
    key: 'mythique',
    name: 'Mythique',
    description: 'Petit paquet, chance mythique.',
    cardCount: 3,
    guaranteedRarity: 'rare',
    foilChance: 28,
    animatedChance: 15,
    weights: { common: 5, uncommon: 10, rare: 20, epic: 20, legendary: 20, mythic: 25 },
    accent: '#fb7185',
    accentLight: '#3a1218',
  },
];

function averageFromWeights(weights: RarityWeights): Rarity {
  return RARITIES.reduce((best, rarity) => (weights[rarity] > weights[best] ? rarity : best), RARITIES[0]);
}

export function presetArtUrl(key: string): string {
  return `/boosters/${key}.svg`;
}

export function boosterArtDir(): string {
  return path.resolve(__dirname, '../../public/boosters');
}

function packSvg(id: string, name: string, accent: string, light: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 400" width="280" height="400">
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="42%" stop-color="#140c1c"/>
      <stop offset="100%" stop-color="#07040c"/>
    </linearGradient>
    <linearGradient id="foil-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.95"/>
      <stop offset="48%" stop-color="#fff6d8" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.7"/>
    </linearGradient>
    <radialGradient id="wax-${id}" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#fff8e8" stop-opacity="0.55"/>
      <stop offset="38%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="#4a3008"/>
    </radialGradient>
  </defs>
  <rect width="280" height="400" rx="14" fill="url(#bg-${id})"/>
  <path d="M0 0h92L48 400H0z" fill="url(#foil-${id})" opacity="0.28"/>
  <rect x="11" y="11" width="258" height="378" rx="9" fill="none" stroke="${accent}" stroke-width="1.7" opacity="0.9"/>
  <rect x="21" y="21" width="238" height="358" rx="5" fill="none" stroke="${accent}" stroke-width="0.7" opacity="0.38"/>
  <rect x="11" y="11" width="258" height="54" rx="9" fill="${accent}" opacity="0.2"/>
  <g fill="${accent}" opacity="0.7">
    <circle cx="36" cy="62" r="2.2"/>
    <circle cx="52" cy="62" r="2.2"/>
    <circle cx="68" cy="62" r="2.2"/>
    <circle cx="84" cy="62" r="2.2"/>
    <circle cx="100" cy="62" r="2.2"/>
    <circle cx="116" cy="62" r="2.2"/>
    <circle cx="132" cy="62" r="2.2"/>
    <circle cx="148" cy="62" r="2.2"/>
    <circle cx="164" cy="62" r="2.2"/>
    <circle cx="180" cy="62" r="2.2"/>
    <circle cx="196" cy="62" r="2.2"/>
    <circle cx="212" cy="62" r="2.2"/>
    <circle cx="228" cy="62" r="2.2"/>
    <circle cx="244" cy="62" r="2.2"/>
  </g>
  <circle cx="140" cy="168" r="40" fill="url(#wax-${id})"/>
  <circle cx="140" cy="168" r="32" fill="none" stroke="#fff6d8" stroke-width="1.2" opacity="0.45"/>
  <text x="140" y="180" text-anchor="middle" font-size="30" fill="#1a1204">✦</text>
  <text x="140" y="292" text-anchor="middle" font-family="Palatino, Georgia, serif" font-size="26" fill="#f4efe6">${name}</text>
  <text x="140" y="322" text-anchor="middle" font-size="11" letter-spacing="4" fill="${accent}">ARCANA PACK</text>
  <text x="140" y="360" text-anchor="middle" font-size="10" fill="#f4efe6" opacity="0.55">BOOSTER</text>
</svg>
`;
}

export function writeBoosterArtFiles(): void {
  const dir = boosterArtDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'default.svg'), packSvg('default', 'Arcana', '#c9a227', '#3d2a12'));
  for (const preset of BOOSTER_PRESETS) {
    fs.writeFileSync(path.join(dir, `${preset.key}.svg`), packSvg(preset.key, preset.name, preset.accent, preset.accentLight));
  }
}

let ready: Promise<void> | null = null;

async function addPresetKeyColumn(): Promise<void> {
  try {
    await pool.query('ALTER TABLE booster_templates ADD COLUMN preset_key VARCHAR(40) NULL AFTER name');
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'ER_DUP_FIELDNAME') throw error;
  }
  try {
    await pool.query('ALTER TABLE booster_templates ADD UNIQUE KEY uq_booster_preset_key (preset_key)');
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'ER_DUP_KEYNAME' && code !== 'ER_MULTIPLE_PRI_KEY') throw error;
  }
}

async function upsertPresets(): Promise<void> {
  for (const preset of BOOSTER_PRESETS) {
    const artUrl = presetArtUrl(preset.key);
    const average = averageFromWeights(preset.weights);
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, art_url FROM booster_templates WHERE preset_key = ? LIMIT 1',
      [preset.key],
    );
    if (rows.length) {
      const currentArt = String(rows[0].art_url || '');
      const keepArt = currentArt && !currentArt.startsWith('/boosters/') ? currentArt : artUrl;
      await pool.execute(
        `UPDATE booster_templates SET
          name=?, description=?, universe_id=NULL, edition_id=NULL, card_count=?, rarity_weights=?,
          average_rarity=?, guaranteed_rarity=?, foil_chance=?, animated_chance=?, allow_duplicates=1, art_url=?
         WHERE preset_key=?`,
        [
          preset.name,
          preset.description,
          preset.cardCount,
          JSON.stringify(preset.weights),
          average,
          preset.guaranteedRarity,
          preset.foilChance,
          preset.animatedChance,
          keepArt,
          preset.key,
        ],
      );
      continue;
    }
    await pool.execute<ResultSetHeader>(
      `INSERT INTO booster_templates (
        name, preset_key, description, universe_id, edition_id, card_count, rarity_weights,
        average_rarity, guaranteed_rarity, foil_chance, animated_chance, allow_duplicates, art_url
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        preset.name,
        preset.key,
        preset.description,
        null,
        null,
        preset.cardCount,
        JSON.stringify(preset.weights),
        average,
        preset.guaranteedRarity,
        preset.foilChance,
        preset.animatedChance,
        1,
        artUrl,
      ],
    );
  }
}

export async function ensureBoosterPresets(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      writeBoosterArtFiles();
      await addPresetKeyColumn();
      await upsertPresets();
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
