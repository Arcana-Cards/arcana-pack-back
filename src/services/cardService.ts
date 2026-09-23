import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import type { CardInput, CardDto, Rarity } from '../types/index.js';
import {
  ART_FILTERS,
  BORDER_FINISHES,
  CARD_KINDS,
  CARD_STYLES,
  FRAME_STYLES,
  HOLOFOIL_PATTERNS,
  MAGIC_TYPES,
  RARITIES,
  kindHasCombatStats,
} from '../types/index.js';
import { CARD_SELECT, mapCard } from './mappers.js';
import { defaultBackColor, defaultBorder, defaultGlow, DEFAULT_TEXT_COLOR, isHexColor, normalizeMediaUrl, originGiphyUrl, slugifySeed } from './cardVisuals.js';

const COLLECTOR_RARITY_ORDER: Rarity[] = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];

function assertEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new AppError(`${field} invalide`, 400);
  }
  return value as T;
}

export function normalizeCardInput(body: Partial<CardInput>, partial = false): CardInput {
  if (!partial) {
    if (!body.universeId || !body.editionId || !body.name?.trim()) {
      throw new AppError('Champs requis : universeId, editionId, name', 400);
    }
  }

  const rarity = body.rarity ? assertEnum(body.rarity, RARITIES, 'rarity') : 'common';
  const style = body.style ? assertEnum(body.style, CARD_STYLES, 'style') : 'painterly';
  const magicType = body.magicType ? assertEnum(body.magicType, MAGIC_TYPES, 'magicType') : 'none';
  const frameStyle = body.frameStyle ? assertEnum(body.frameStyle, FRAME_STYLES, 'frameStyle') : 'classic';
  const holofoilPattern = body.holofoilPattern
    ? assertEnum(body.holofoilPattern, HOLOFOIL_PATTERNS, 'holofoilPattern')
    : rarity === 'common' ? 'none' : 'linear';
  const kind = body.kind ? assertEnum(body.kind, CARD_KINDS, 'kind') : 'creature';
  const artFilter = body.artFilter ? assertEnum(body.artFilter, ART_FILTERS, 'artFilter') : 'none';
  const borderFinish = body.borderFinish ? assertEnum(body.borderFinish, BORDER_FINISHES, 'borderFinish') : 'matte';
  const hasStats = kindHasCombatStats(kind);
  const unlockRaw = body.animatedUnlockCopies != null ? Number(body.animatedUnlockCopies) : 5;
  if (!Number.isFinite(unlockRaw) || unlockRaw < 1 || unlockRaw > 99) {
    throw new AppError('animatedUnlockCopies invalide', 400);
  }

  if (body.backColor && !isHexColor(body.backColor)) throw new AppError('backColor invalide', 400);
  if (body.glowColor && !isHexColor(body.glowColor)) throw new AppError('glowColor invalide', 400);
  if (body.textColor && !isHexColor(body.textColor)) throw new AppError('textColor invalide', 400);

  return {
    universeId: Number(body.universeId),
    editionId: Number(body.editionId),
    collectorNumber: body.collectorNumber != null ? Number(body.collectorNumber) : undefined,
    name: body.name?.trim() ?? '',
    subtitle: body.subtitle?.trim() || null,
    description: body.description?.trim() || null,
    flavorText: body.flavorText?.trim() || null,
    style,
    magicType,
    kind,
    subtype: body.subtype?.trim() || null,
    rarity,
    foil: Boolean(body.foil),
    animated: Boolean(body.animated),
    borderColor: defaultBorder(rarity),
    backColor: body.backColor || defaultBackColor(style),
    glowColor: body.glowColor || defaultGlow(rarity),
    textColor: body.textColor || DEFAULT_TEXT_COLOR,
    frameStyle,
    holofoilPattern,
    power: hasStats && body.power != null && body.power !== ('' as unknown) ? Number(body.power) : null,
    toughness: hasStats && body.toughness != null && body.toughness !== ('' as unknown) ? Number(body.toughness) : null,
    artist: body.artist?.trim() || null,
    artSeed: body.artSeed?.trim() || slugifySeed(body.name || 'card'),
    artUrl: body.artUrl === undefined ? null : normalizeMediaUrl(body.artUrl),
    artFilter,
    borderFinish,
    artAnimatedUrl: body.artAnimatedUrl === undefined ? null : normalizeMediaUrl(body.artAnimatedUrl),
    giphyUrl: originGiphyUrl(body.artAnimatedUrl, body.artUrl, body.giphyUrl),
    animatedUnlockCopies: Math.round(unlockRaw),
  };
}

async function nextCollectorNumber(editionId: number): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT COALESCE(MAX(collector_number), 0) + 1 AS next_n FROM cards WHERE edition_id = ?',
    [editionId],
  );
  return Number(rows[0].next_n);
}

export async function renumberEdition(editionId: number): Promise<void> {
  if (!editionId) return;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT id, rarity, name FROM cards WHERE edition_id = ? FOR UPDATE',
      [editionId],
    );
    const sorted = [...rows].sort((a, b) => {
      const ra = COLLECTOR_RARITY_ORDER.indexOf(a.rarity as Rarity);
      const rb = COLLECTOR_RARITY_ORDER.indexOf(b.rarity as Rarity);
      const byRarity = (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
      if (byRarity) return byRarity;
      const byName = String(a.name).localeCompare(String(b.name), 'fr', { sensitivity: 'base' });
      return byName || Number(a.id) - Number(b.id);
    });
    await conn.execute(
      'UPDATE cards SET collector_number = collector_number + 100000 WHERE edition_id = ?',
      [editionId],
    );
    for (let i = 0; i < sorted.length; i += 1) {
      await conn.execute('UPDATE cards SET collector_number = ? WHERE id = ?', [i + 1, sorted[i].id]);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function assertEditionMatchesUniverse(editionId: number, universeId: number): Promise<void> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, universe_id FROM editions WHERE id = ?',
    [editionId],
  );
  if (!rows.length) throw new AppError('Édition introuvable', 404);
  if (Number(rows[0].universe_id) !== Number(universeId)) {
    throw new AppError('Cette édition n’appartient pas à cet univers', 400);
  }
}

export async function listCards(filters: {
  universeId?: number;
  editionId?: number;
  rarity?: Rarity;
}): Promise<CardDto[]> {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (filters.universeId) {
    where.push('c.universe_id = ?');
    params.push(filters.universeId);
  }
  if (filters.editionId) {
    where.push('c.edition_id = ?');
    params.push(filters.editionId);
  }
  if (filters.rarity) {
    where.push('c.rarity = ?');
    params.push(filters.rarity);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${CARD_SELECT}
     FROM cards c
     JOIN universes u ON u.id = c.universe_id
     JOIN editions e ON e.id = c.edition_id
     ${clause}
     ORDER BY u.name, e.number, c.collector_number`,
    params,
  );
  return rows.map(mapCard);
}

export async function getCard(id: number): Promise<CardDto> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${CARD_SELECT}
     FROM cards c
     JOIN universes u ON u.id = c.universe_id
     JOIN editions e ON e.id = c.edition_id
     WHERE c.id = ?`,
    [id],
  );
  if (!rows.length) throw new AppError('Carte introuvable', 404);
  return mapCard(rows[0]);
}

export async function createCard(input: CardInput, createdBy: number): Promise<CardDto> {
  const created = await insertCard(input, createdBy);
  await renumberEdition(input.editionId);
  return getCard(created.id);
}

export async function createCards(inputs: CardInput[], createdBy: number): Promise<CardDto[]> {
  const created: Array<{ id: number; editionId: number }> = [];
  for (const input of inputs) {
    created.push(await insertCard(input, createdBy));
  }
  const editions = [...new Set(created.map((card) => card.editionId))];
  for (const editionId of editions) await renumberEdition(editionId);
  return Promise.all(created.map((card) => getCard(card.id)));
}

async function insertCard(input: CardInput, createdBy: number): Promise<{ id: number; editionId: number }> {
  await assertEditionMatchesUniverse(input.editionId, input.universeId);
  const collectorNumber = await nextCollectorNumber(input.editionId);

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO cards (
      universe_id, edition_id, collector_number, name, subtitle, description, flavor_text,
      style, magic_type, kind, subtype, rarity, foil, animated, border_color, back_color, glow_color, text_color,
      frame_style, holofoil_pattern, power, toughness, artist, art_seed, art_url,
      art_filter, border_finish, art_animated_url, giphy_url, animated_unlock_copies, created_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      input.universeId, input.editionId, collectorNumber, input.name, input.subtitle,
      input.description, input.flavorText, input.style, input.magicType, input.kind, input.subtype,
      input.rarity, input.foil ? 1 : 0, input.animated ? 1 : 0, input.borderColor,
      input.backColor, input.glowColor, input.textColor ?? DEFAULT_TEXT_COLOR, input.frameStyle, input.holofoilPattern,
      input.power, input.toughness, input.artist, input.artSeed, input.artUrl,
      input.artFilter ?? 'none', input.borderFinish ?? 'matte', input.artAnimatedUrl ?? null,
      input.giphyUrl ?? null, input.animatedUnlockCopies ?? 5, createdBy,
    ] as Array<string | number | null>,
  );
  return { id: result.insertId, editionId: input.editionId };
}

export async function updateCard(id: number, patch: Partial<CardInput>): Promise<CardDto> {
  const current = await getCard(id);
  const merged = normalizeCardInput({
    ...current,
    ...patch,
    universeId: patch.universeId ?? current.universeId,
    editionId: patch.editionId ?? current.editionId,
    name: patch.name ?? current.name,
  });
  await assertEditionMatchesUniverse(merged.editionId, merged.universeId);

  await pool.execute(
    `UPDATE cards SET
      universe_id=?, edition_id=?, name=?, subtitle=?, description=?, flavor_text=?,
      style=?, magic_type=?, kind=?, subtype=?, rarity=?, foil=?, animated=?, border_color=?, back_color=?, glow_color=?, text_color=?,
      frame_style=?, holofoil_pattern=?, power=?, toughness=?, artist=?, art_seed=?, art_url=?,
      art_filter=?, border_finish=?, art_animated_url=?, giphy_url=?, animated_unlock_copies=?
     WHERE id=?`,
    [
      merged.universeId, merged.editionId, merged.name, merged.subtitle,
      merged.description, merged.flavorText, merged.style, merged.magicType, merged.kind, merged.subtype,
      merged.rarity, merged.foil ? 1 : 0, merged.animated ? 1 : 0, merged.borderColor,
      merged.backColor, merged.glowColor, merged.textColor ?? DEFAULT_TEXT_COLOR, merged.frameStyle, merged.holofoilPattern,
      merged.power, merged.toughness, merged.artist, merged.artSeed, merged.artUrl,
      merged.artFilter ?? 'none', merged.borderFinish ?? 'matte', merged.artAnimatedUrl ?? null,
      merged.giphyUrl ?? null, merged.animatedUnlockCopies ?? 5, id,
    ] as Array<string | number | null>,
  );
  await renumberEdition(merged.editionId);
  if (current.editionId !== merged.editionId) await renumberEdition(current.editionId);
  return getCard(id);
}

export async function deleteCard(id: number): Promise<void> {
  const current = await getCard(id);
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM cards WHERE id = ?', [id]);
  if (!result.affectedRows) throw new AppError('Carte introuvable', 404);
  await renumberEdition(current.editionId);
}

let collectorOrderReady = false;

export async function ensureCollectorOrder(): Promise<void> {
  if (collectorOrderReady) return;
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT DISTINCT edition_id FROM cards');
  for (const row of rows) await renumberEdition(Number(row.edition_id));
  collectorOrderReady = true;
}
