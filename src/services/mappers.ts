import type { RowDataPacket } from 'mysql2';
import type {
  BoosterTemplateDto,
  CardDto,
  EditionDto,
  HolofoilPattern,
  Rarity,
  RarityWeights,
  UniverseDto,
  UserBoosterDto,
  UserDto,
} from '../types/index.js';
import { RARITIES } from '../types/index.js';

export function asBool(value: unknown): boolean {
  return value === 1 || value === true || value === '1';
}

function catalogArtFilter(value: CardDto['artFilter'] | null | undefined): CardDto['artFilter'] {
  if (!value || value === 'holo' || value === 'shiny') return 'none';
  return value;
}

export function parseWeights(raw: unknown): RarityWeights {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const weights = {} as RarityWeights;
  for (const rarity of RARITIES) {
    const n = Number((parsed as Record<string, unknown>)?.[rarity] ?? 0);
    weights[rarity] = Number.isFinite(n) ? n : 0;
  }
  return weights;
}

export function defaultWeights(): RarityWeights {
  return {
    common: 62,
    uncommon: 22,
    rare: 10,
    epic: 4,
    legendary: 1,
    mythic: 1,
  };
}

function clampWeight(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function normalizeWeights(raw?: Partial<RarityWeights> | null): RarityWeights {
  const merged = { ...defaultWeights(), ...(raw ?? {}) };
  const weights = {} as RarityWeights;
  let total = 0;
  for (const rarity of RARITIES) {
    weights[rarity] = clampWeight(merged[rarity]);
    total += weights[rarity];
  }
  if (total <= 0) return defaultWeights();
  return weights;
}

export function averageFromWeights(weights: RarityWeights): Rarity {
  return RARITIES.reduce((best, rarity) => (weights[rarity] > weights[best] ? rarity : best), RARITIES[0]);
}

export function mapUser(row: RowDataPacket): UserDto {
  return {
    id: row.id as number,
    email: row.email as string,
    username: row.username as string,
    role: row.role,
    createdAt: new Date(row.created_at as string).toISOString(),
    lastLogin: row.last_login ? new Date(row.last_login as string).toISOString() : null,
    unopenedBoosters: row.unopened_boosters != null ? Number(row.unopened_boosters) : undefined,
    collectedCopies: row.collected_copies != null ? Number(row.collected_copies) : undefined,
  };
}

export function mapUniverse(row: RowDataPacket): UniverseDto {
  return {
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    tagline: (row.tagline as string) ?? null,
    description: (row.description as string) ?? null,
    accentColor: row.accent_color as string,
    backdropColor: row.backdrop_color as string,
  };
}

export function mapEdition(row: RowDataPacket): EditionDto {
  return {
    id: row.id as number,
    universeId: row.universe_id as number,
    universeName: row.universe_name as string | undefined,
    name: row.name as string,
    code: row.code as string,
    number: row.number as number,
    description: (row.description as string) ?? null,
    releasedAt: row.released_at ? String(row.released_at).slice(0, 10) : null,
    coverColor: row.cover_color as string,
    cardCount: row.card_count != null ? Number(row.card_count) : undefined,
  };
}

export function mapCard(row: RowDataPacket): CardDto {
  return {
    id: row.id as number,
    universeId: row.universe_id as number,
    universeName: row.universe_name as string | undefined,
    universeSlug: row.universe_slug as string | undefined,
    editionId: row.edition_id as number,
    editionName: row.edition_name as string | undefined,
    editionCode: row.edition_code as string | undefined,
    editionNumber: row.edition_number as number | undefined,
    collectorNumber: row.collector_number as number,
    name: row.name as string,
    subtitle: (row.subtitle as string) ?? null,
    description: (row.description as string) ?? null,
    flavorText: (row.flavor_text as string) ?? null,
    style: row.style,
    magicType: row.magic_type,
    kind: (row.kind as CardDto['kind']) || 'creature',
    subtype: (row.subtype as string) ?? null,
    rarity: row.rarity as Rarity,
    foil: false,
    animated: asBool(row.animated),
    borderColor: row.border_color as string,
    backColor: row.back_color as string,
    glowColor: row.glow_color as string,
    textColor: (row.text_color as string) || '#f4efe6',
    frameStyle: row.frame_style,
    holofoilPattern: 'none' as HolofoilPattern,
    power: row.power != null ? Number(row.power) : null,
    toughness: row.toughness != null ? Number(row.toughness) : null,
    artist: (row.artist as string) ?? null,
    artSeed: row.art_seed as string,
    artUrl: (row.art_url as string) ?? null,
    artFilter: catalogArtFilter(row.art_filter as CardDto['artFilter']),
    borderFinish: (row.border_finish as CardDto['borderFinish']) || 'matte',
    artAnimatedUrl: (row.art_animated_url as string) ?? null,
    giphyUrl: (row.giphy_url as string) ?? null,
    animatedUnlockCopies: row.animated_unlock_copies != null ? Number(row.animated_unlock_copies) : 5,
  };
}

export function mapTemplate(row: RowDataPacket): BoosterTemplateDto {
  return {
    id: row.id as number,
    name: row.name as string,
    presetKey: (row.preset_key as string) || null,
    description: (row.description as string) ?? null,
    universeId: (row.universe_id as number) ?? null,
    universeName: (row.universe_name as string) ?? null,
    editionId: (row.edition_id as number) ?? null,
    editionName: (row.edition_name as string) ?? null,
    cardCount: row.card_count as number,
    rarityWeights: parseWeights(row.rarity_weights),
    averageRarity: row.average_rarity as Rarity,
    guaranteedRarity: row.guaranteed_rarity as Rarity,
    foilChance: Number(row.foil_chance),
    animatedChance: Number(row.animated_chance),
    allowDuplicates: asBool(row.allow_duplicates),
    artUrl: (row.art_url as string) || '/boosters/default.svg',
  };
}

export function mapUserBooster(row: RowDataPacket): UserBoosterDto {
  return {
    id: row.id as number,
    templateId: row.template_id as number,
    templateName: row.template_name as string,
    universeName: (row.universe_name as string) ?? null,
    editionName: (row.edition_name as string) ?? null,
    cardCount: row.card_count as number,
    averageRarity: row.average_rarity as Rarity,
    grantedAt: new Date(row.created_at as string).toISOString(),
    openedAt: row.opened_at ? new Date(row.opened_at as string).toISOString() : null,
    artUrl: (row.art_url as string) || '/boosters/default.svg',
  };
}

export const CARD_SELECT = `
  c.id, c.universe_id, c.edition_id, c.collector_number, c.name, c.subtitle,
  c.description, c.flavor_text, c.style, c.magic_type, c.kind, c.subtype, c.rarity,
  c.foil, c.animated, c.border_color, c.back_color, c.glow_color, c.text_color, c.frame_style,
  c.holofoil_pattern, c.power, c.toughness, c.artist, c.art_seed, c.art_url,
  c.art_filter, c.border_finish, c.art_animated_url, c.giphy_url, c.animated_unlock_copies,
  u.name AS universe_name, u.slug AS universe_slug,
  e.name AS edition_name, e.code AS edition_code, e.number AS edition_number
`;
