import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import type { BoosterTemplateDto, BoosterTemplateInput, Rarity, RarityWeights } from '../types/index.js';
import { RARITIES } from '../types/index.js';
import { averageFromWeights, mapTemplate, normalizeWeights } from './mappers.js';
import { DEFAULT_BOOSTER_ART, ensureBoosterPresets } from '../db/boosterPresets.js';
import { normalizeMediaUrl } from './cardVisuals.js';

const TEMPLATE_SELECT = `
  t.*, u.name AS universe_name, e.name AS edition_name
`;

export function rarityProbability(weights: RarityWeights, rarity: Rarity, floor?: Rarity): number {
  const floorIdx = floor ? RARITIES.indexOf(floor) : 0;
  const entries = RARITIES
    .map((item, idx) => ({ rarity: item, weight: idx < floorIdx ? 0 : weights[item] }))
    .filter((entry) => entry.weight > 0);
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!total) return 0;
  const match = entries.find((entry) => entry.rarity === rarity);
  return match ? match.weight / total : 0;
}

export function slotDropChance(
  weights: RarityWeights,
  floor: Rarity | undefined,
  pool: Array<{ id: number; rarity: string }>,
  pulledIds: number[],
  allowDuplicates: boolean,
  cardId: number,
): number {
  const available = (rows: Array<{ id: number; rarity: string }>) => (
    rows.filter((row) => allowDuplicates || !pulledIds.includes(row.id))
  );
  const fallback = available(pool);
  if (!fallback.length) return 0;
  let chance = 0;
  for (const rarity of RARITIES) {
    const pRarity = rarityProbability(weights, rarity, floor);
    if (pRarity <= 0) continue;
    const ofRarity = available(pool.filter((row) => row.rarity === rarity));
    const pickFrom = ofRarity.length ? ofRarity : fallback;
    const hits = pickFrom.filter((row) => row.id === cardId).length;
    chance += pRarity * (hits / pickFrom.length);
  }
  return chance * 100;
}

export function rollRarity(weights: RarityWeights, floor?: Rarity): Rarity {
  const floorIdx = floor ? RARITIES.indexOf(floor) : 0;
  const entries = RARITIES
    .map((rarity, idx) => ({ rarity, weight: idx < floorIdx ? 0 : weights[rarity] }))
    .filter((e) => e.weight > 0);
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let cursor = Math.random() * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.rarity;
  }
  return entries[entries.length - 1]?.rarity ?? 'common';
}

export async function listTemplates(): Promise<BoosterTemplateDto[]> {
  await ensureBoosterPresets();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${TEMPLATE_SELECT}
     FROM booster_templates t
     LEFT JOIN universes u ON u.id = t.universe_id
     LEFT JOIN editions e ON e.id = t.edition_id
     ORDER BY (t.preset_key IS NULL) ASC,
       CASE t.preset_key
         WHEN 'standard' THEN 1
         WHEN 'rare' THEN 2
         WHEN 'premium' THEN 3
         WHEN 'epique' THEN 4
         WHEN 'legendaire' THEN 5
         WHEN 'mythique' THEN 6
         ELSE 9
       END,
       t.name`,
  );
  return rows.map(mapTemplate);
}

export async function getTemplate(id: number): Promise<BoosterTemplateDto> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${TEMPLATE_SELECT}
     FROM booster_templates t
     LEFT JOIN universes u ON u.id = t.universe_id
     LEFT JOIN editions e ON e.id = t.edition_id
     WHERE t.id = ?`,
    [id],
  );
  if (!rows.length) throw new AppError('Modèle de booster introuvable', 404);
  return mapTemplate(rows[0]);
}

function normalizeTemplate(body: BoosterTemplateInput, partial = false): Required<BoosterTemplateInput> {
  if (!partial && !body.name?.trim()) throw new AppError('Le nom du booster est requis', 400);
  const rarityWeights = normalizeWeights(body.rarityWeights);
  const averageRarity = averageFromWeights(rarityWeights);
  const guaranteedRarity = body.guaranteedRarity && RARITIES.includes(body.guaranteedRarity)
    ? body.guaranteedRarity : 'rare';
  const cardCount = body.cardCount ?? 5;
  if (cardCount < 1 || cardCount > 15) throw new AppError('Un booster contient 1 à 15 cartes', 400);
  const foilChance = body.foilChance ?? 8;
  const animatedChance = body.animatedChance ?? 3;
  if (foilChance < 0 || foilChance > 100 || animatedChance < 0 || animatedChance > 100) {
    throw new AppError('Les chances brillantes / animées doivent être entre 0 et 100', 400);
  }
  return {
    name: body.name?.trim() ?? '',
    description: body.description?.trim() || null,
    universeId: body.universeId ?? null,
    editionId: body.editionId ?? null,
    cardCount,
    rarityWeights,
    averageRarity,
    guaranteedRarity,
    foilChance,
    animatedChance,
    allowDuplicates: body.allowDuplicates ?? true,
    artUrl: body.artUrl === undefined ? null : normalizeMediaUrl(body.artUrl, 'image de booster'),
  };
}

export async function createTemplate(body: BoosterTemplateInput): Promise<BoosterTemplateDto> {
  const input = normalizeTemplate(body);
  const artUrl = input.artUrl || DEFAULT_BOOSTER_ART;
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO booster_templates (
      name, description, universe_id, edition_id, card_count, rarity_weights,
      average_rarity, guaranteed_rarity, foil_chance, animated_chance, allow_duplicates, art_url
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      input.name, input.description, input.universeId, input.editionId, input.cardCount,
      JSON.stringify(input.rarityWeights), input.averageRarity, input.guaranteedRarity,
      input.foilChance, input.animatedChance, input.allowDuplicates ? 1 : 0, artUrl,
    ],
  );
  return getTemplate(result.insertId);
}

export async function updateTemplate(id: number, body: BoosterTemplateInput): Promise<BoosterTemplateDto> {
  const current = await getTemplate(id);
  const input = normalizeTemplate({ ...current, ...body, name: body.name ?? current.name }, true);
  await pool.execute(
    `UPDATE booster_templates SET
      name=?, description=?, universe_id=?, edition_id=?, card_count=?, rarity_weights=?,
      average_rarity=?, guaranteed_rarity=?, foil_chance=?, animated_chance=?, allow_duplicates=?, art_url=?
     WHERE id=?`,
    [
      input.name, input.description, input.universeId, input.editionId, input.cardCount,
      JSON.stringify(input.rarityWeights), input.averageRarity, input.guaranteedRarity,
      input.foilChance, input.animatedChance, input.allowDuplicates ? 1 : 0, input.artUrl, id,
    ],
  );
  return getTemplate(id);
}

export async function deleteTemplate(id: number): Promise<void> {
  const current = await getTemplate(id);
  if (current.presetKey) {
    throw new AppError('Ce preset ne peut pas être supprimé. Crée un modèle à partir de lui pour le personnaliser.', 400);
  }
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM booster_templates WHERE id = ?', [id]);
  if (!result.affectedRows) throw new AppError('Modèle de booster introuvable', 404);
}

export async function grantBoosters(userId: number, templateId: number, quantity: number, grantedBy: number): Promise<number[]> {
  await getTemplate(templateId);
  const [users] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE id = ?', [userId]);
  if (!users.length) throw new AppError('Utilisateur introuvable', 404);
  const qty = Math.max(1, Math.min(50, Math.floor(quantity || 1)));
  const ids: number[] = [];
  for (let i = 0; i < qty; i += 1) {
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO user_boosters (user_id, template_id, granted_by) VALUES (?,?,?)',
      [userId, templateId, grantedBy],
    );
    ids.push(result.insertId);
  }
  return ids;
}
