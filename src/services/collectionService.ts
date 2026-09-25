import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import type {
  BinderPocketDto,
  LooseCopyDto,
  NotebookDetailDto,
  NotebookSlotDto,
  NotebookSummaryDto,
  PulledCopyDto,
  Rarity,
  UserBoosterDto,
} from '../types/index.js';
import { asBool, CARD_SELECT, mapCard, mapUserBooster } from './mappers.js';
import { getTemplate, rarityProbability, rollRarity } from './boosterService.js';
import { makeSerial } from './cardVisuals.js';

export async function listUserBoosters(userId: number, opened?: boolean): Promise<UserBoosterDto[]> {
  const filter = opened === true
    ? 'AND b.opened_at IS NOT NULL'
    : opened === false
      ? 'AND b.opened_at IS NULL'
      : '';
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT b.id, b.template_id, b.created_at, b.opened_at,
            t.name AS template_name, t.card_count, t.average_rarity, t.art_url,
            u.name AS universe_name, e.name AS edition_name
     FROM user_boosters b
     JOIN booster_templates t ON t.id = b.template_id
     LEFT JOIN universes u ON u.id = t.universe_id
     LEFT JOIN editions e ON e.id = t.edition_id
     WHERE b.user_id = ? ${filter}
     ORDER BY b.opened_at IS NOT NULL, b.created_at DESC`,
    [userId],
  );
  return rows.map(mapUserBooster);
}

export async function openBooster(userId: number, boosterId: number): Promise<PulledCopyDto[]> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [boosters] = await conn.execute<RowDataPacket[]>(
      `SELECT * FROM user_boosters WHERE id = ? AND user_id = ? FOR UPDATE`,
      [boosterId, userId],
    );
    if (!boosters.length) throw new AppError('Booster introuvable', 404);
    if (boosters[0].opened_at) throw new AppError('Ce booster est déjà ouvert', 409);

    const template = await getTemplate(Number(boosters[0].template_id));
    const weights = template.rarityWeights;

    const where: string[] = [];
    const params: Array<string | number> = [];
    if (template.universeId) {
      where.push('c.universe_id = ?');
      params.push(template.universeId);
    }
    if (template.editionId) {
      where.push('c.edition_id = ?');
      params.push(template.editionId);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [poolCards] = await conn.execute<RowDataPacket[]>(
      `SELECT ${CARD_SELECT}
       FROM cards c
       JOIN universes u ON u.id = c.universe_id
       JOIN editions e ON e.id = c.edition_id
       ${clause}`,
      params,
    );
    if (!poolCards.length) throw new AppError('Aucune carte disponible pour ce booster', 400);

    const cardsByRarity = new Map<string, RowDataPacket[]>();
    for (const row of poolCards) {
      const list = cardsByRarity.get(row.rarity as string) ?? [];
      list.push(row);
      cardsByRarity.set(row.rarity as string, list);
    }

    const pulledIds: number[] = [];
    const pulls: PulledCopyDto[] = [];

    for (let slot = 0; slot < template.cardCount; slot += 1) {
      const isLast = slot === template.cardCount - 1;
      const floor = isLast ? template.guaranteedRarity : undefined;
      const rarity = rollRarity(weights, floor);
      const candidates = (cardsByRarity.get(rarity) ?? poolCards)
        .filter((row) => template.allowDuplicates || !pulledIds.includes(row.id as number));
      const fallback = poolCards.filter((row) => template.allowDuplicates || !pulledIds.includes(row.id as number));
      const pickFrom = candidates.length ? candidates : fallback;
      if (!pickFrom.length) throw new AppError('Pas assez de cartes distinctes dans ce booster', 400);
      const picked = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      const dropChance = rarityProbability(weights, picked.rarity as Rarity, floor) * 100;
      pulledIds.push(picked.id as number);

      const foil = Math.random() * 100 < template.foilChance;
      const animated = Boolean(picked.animated) || Math.random() * 100 < template.animatedChance;
      const serial = makeSerial(picked.edition_code as string, picked.collector_number as number);

      const [owned] = await conn.execute<RowDataPacket[]>(
        'SELECT id FROM collection_copies WHERE user_id = ? AND card_id = ? LIMIT 1',
        [userId, picked.id],
      );

      const [insert] = await conn.execute<ResultSetHeader>(
        `INSERT INTO collection_copies (user_id, card_id, booster_id, foil, animated, serial)
         VALUES (?,?,?,?,?,?)`,
        [userId, picked.id, boosterId, foil ? 1 : 0, animated ? 1 : 0, serial],
      );

      const [countRows] = await conn.execute<RowDataPacket[]>(
        'SELECT COUNT(*) AS n FROM collection_copies WHERE user_id = ? AND card_id = ?',
        [userId, picked.id],
      );

      const card = mapCard(picked);
      pulls.push({
        id: insert.insertId,
        serial,
        foil,
        animated,
        isNew: owned.length === 0,
        copies: Number(countRows[0].n),
        dropChance,
        card: { ...card, foil: false, animated },
      });
    }

    await conn.execute('UPDATE user_boosters SET opened_at = NOW() WHERE id = ?', [boosterId]);
    await conn.commit();
    return pulls;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

function mapSummary(row: RowDataPacket): NotebookSummaryDto {
  return {
    editionId: row.edition_id as number,
    editionName: row.edition_name as string,
    editionCode: row.edition_code as string,
    editionNumber: row.edition_number as number,
    universeName: row.universe_name as string,
    universeSlug: row.universe_slug as string,
    coverColor: row.cover_color as string,
    accentColor: row.accent_color as string,
    totalSlots: Number(row.total_slots),
    ownedSlots: Number(row.owned_slots),
    collectedSlots: Number(row.collected_slots),
    copies: Number(row.copies),
    unplaced: Number(row.unplaced),
  };
}

async function listEditionSummaries(userId: number, onlyOwned: boolean): Promise<NotebookSummaryDto[]> {
  const having = onlyOwned ? 'HAVING copies > 0' : 'HAVING total_slots > 0';
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
        e.id AS edition_id, e.name AS edition_name, e.code AS edition_code, e.number AS edition_number,
        e.cover_color, u.name AS universe_name, u.slug AS universe_slug, u.accent_color,
        COUNT(DISTINCT c.id) AS total_slots,
        COUNT(DISTINCT CASE WHEN cop.in_binder = 1 THEN cop.id END) AS owned_slots,
        COUNT(DISTINCT cop.card_id) AS collected_slots,
        COUNT(cop.id) AS copies,
        SUM(CASE WHEN cop.id IS NOT NULL AND cop.in_binder = 0 THEN 1 ELSE 0 END) AS unplaced
     FROM editions e
     JOIN universes u ON u.id = e.universe_id
     LEFT JOIN cards c ON c.edition_id = e.id
     LEFT JOIN collection_copies cop ON cop.card_id = c.id AND cop.user_id = ?
     GROUP BY e.id, e.name, e.code, e.number, e.cover_color, u.name, u.slug, u.accent_color
     ${having}
     ORDER BY u.name, e.number`,
    [userId],
  );
  return rows.map(mapSummary);
}

export async function listNotebooks(userId: number): Promise<NotebookSummaryDto[]> {
  return listEditionSummaries(userId, true);
}

export async function listCarnets(userId: number): Promise<NotebookSummaryDto[]> {
  return listEditionSummaries(userId, false);
}

type CopyRow = {
  id: number;
  cardId: number;
  foil: boolean;
  animated: boolean;
  inBinder: boolean;
  binderSlot: number | null;
  serial: string;
  card: ReturnType<typeof mapCard>;
};

async function loadEditionCopies(userId: number, editionId: number): Promise<CopyRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT cop.id AS copy_id, cop.serial, cop.foil AS copy_foil, cop.animated AS copy_animated,
            cop.in_binder, cop.binder_slot, ${CARD_SELECT}
     FROM collection_copies cop
     JOIN cards c ON c.id = cop.card_id
     JOIN universes u ON u.id = c.universe_id
     JOIN editions e ON e.id = c.edition_id
     WHERE cop.user_id = ? AND c.edition_id = ?
     ORDER BY c.collector_number, cop.collected_at, cop.id`,
    [userId, editionId],
  );
  return rows.map((row) => ({
    id: row.copy_id as number,
    cardId: row.id as number,
    foil: asBool(row.copy_foil),
    animated: asBool(row.copy_animated),
    inBinder: asBool(row.in_binder),
    binderSlot: row.binder_slot == null ? null : Number(row.binder_slot),
    serial: row.serial as string,
    card: mapCard(row),
  }));
}

function binderSize(maxSlot: number): number {
  if (maxSlot < 0) return 18;
  const used = maxSlot + 1;
  const pages = Math.ceil(used / 9);
  const extra = used % 9 === 0 ? 1 : 0;
  return Math.max(2, pages + extra) * 9;
}

async function assignMissingSlots(copies: CopyRow[]): Promise<void> {
  const used = new Set(copies.filter((copy) => copy.inBinder && copy.binderSlot != null).map((copy) => copy.binderSlot as number));
  let next = 0;
  for (const copy of copies) {
    if (!copy.inBinder || copy.binderSlot != null) continue;
    while (used.has(next)) next += 1;
    copy.binderSlot = next;
    used.add(next);
    await pool.execute('UPDATE collection_copies SET binder_slot = ? WHERE id = ?', [next, copy.id]);
    next += 1;
  }
}

async function keepOnePerCard(copies: CopyRow[]): Promise<void> {
  const seen = new Set<number>();
  for (const copy of copies) {
    if (!copy.inBinder) continue;
    if (seen.has(copy.cardId)) {
      copy.inBinder = false;
      copy.binderSlot = null;
      await pool.execute(
        'UPDATE collection_copies SET in_binder = 0, binder_slot = NULL WHERE id = ?',
        [copy.id],
      );
    } else {
      seen.add(copy.cardId);
    }
  }
}

function mapLoose(copy: CopyRow): LooseCopyDto {
  return {
    id: copy.id,
    serial: copy.serial,
    foil: copy.foil,
    animated: copy.animated,
    card: copy.card,
  };
}

export async function getNotebook(userId: number, editionId: number): Promise<NotebookDetailDto> {
  const summaries = await listEditionSummaries(userId, false);
  const summary = summaries.find((item) => item.editionId === editionId);
  if (!summary) throw new AppError('Carnet introuvable pour cette édition', 404);

  const [cards] = await pool.execute<RowDataPacket[]>(
    `SELECT ${CARD_SELECT}
     FROM cards c
     JOIN universes u ON u.id = c.universe_id
     JOIN editions e ON e.id = c.edition_id
     WHERE c.edition_id = ?
     ORDER BY c.collector_number`,
    [editionId],
  );

  const copies = await loadEditionCopies(userId, editionId);
  await assignMissingSlots(copies);
  await keepOnePerCard(copies);
  const byCard = new Map<number, CopyRow[]>();
  for (const copy of copies) {
    const list = byCard.get(copy.cardId) ?? [];
    list.push(copy);
    byCard.set(copy.cardId, list);
  }

  const slots: NotebookSlotDto[] = cards.map((row) => {
    const card = mapCard(row);
    const owned = byCard.get(card.id) ?? [];
    const placed = owned.find((copy) => copy.inBinder) ?? null;
    return {
      collectorNumber: card.collectorNumber,
      card,
      owned: owned.length > 0,
      placed: Boolean(placed),
      copies: owned.length,
      placedCopies: owned.filter((copy) => copy.inBinder).length,
      foilCopies: owned.filter((copy) => copy.foil).length,
      animatedCopies: owned.filter((copy) => copy.animated).length,
      placedCopyId: placed?.id ?? null,
      placedFoil: placed?.foil ?? false,
      placedAnimated: placed?.animated ?? false,
    };
  });

  const placed = copies.filter((copy) => copy.inBinder && copy.binderSlot != null);
  const maxSlot = placed.reduce((max, copy) => Math.max(max, copy.binderSlot as number), -1);
  const size = binderSize(maxSlot);
  const bySlot = new Map(placed.map((copy) => [copy.binderSlot as number, copy]));
  const pockets: BinderPocketDto[] = Array.from({ length: size }, (_, slotIndex) => {
    const copy = bySlot.get(slotIndex) ?? null;
    return { slotIndex, copy: copy ? mapLoose(copy) : null };
  });

  return {
    summary: { ...summary, ownedSlots: placed.length },
    slots,
    pockets,
    pile: copies.filter((copy) => !copy.inBinder).map(mapLoose),
  };
}

async function occupantAt(userId: number, editionId: number, slotIndex: number, exceptId: number): Promise<number | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT cop.id
     FROM collection_copies cop
     JOIN cards c ON c.id = cop.card_id
     WHERE cop.user_id = ? AND c.edition_id = ? AND cop.in_binder = 1 AND cop.binder_slot = ? AND cop.id <> ?
     LIMIT 1`,
    [userId, editionId, slotIndex, exceptId],
  );
  return rows.length ? Number(rows[0].id) : null;
}

export async function placeCopy(userId: number, editionId: number, copyId: number, slotIndex: number): Promise<NotebookDetailDto> {
  if (!Number.isFinite(copyId) || copyId <= 0) throw new AppError('Exemplaire invalide', 400);
  if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex > 199) {
    throw new AppError('Pochette invalide', 400);
  }
  const target = Math.floor(slotIndex);

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT cop.id, cop.in_binder, cop.binder_slot, cop.card_id, c.edition_id
     FROM collection_copies cop
     JOIN cards c ON c.id = cop.card_id
     WHERE cop.id = ? AND cop.user_id = ?`,
    [copyId, userId],
  );
  if (!rows.length) throw new AppError('Exemplaire introuvable', 404);
  const copy = rows[0];
  if (Number(copy.edition_id) !== editionId) {
    throw new AppError('Cette carte n’appartient pas à ce cahier', 400);
  }

  const currentSlot = asBool(copy.in_binder) && copy.binder_slot != null ? Number(copy.binder_slot) : null;
  if (currentSlot === target) return getNotebook(userId, editionId);

  if (currentSlot == null) {
    const [already] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM collection_copies
       WHERE user_id = ? AND card_id = ? AND in_binder = 1 AND id <> ?
       LIMIT 1`,
      [userId, copy.card_id, copyId],
    );
    if (already.length) throw new AppError('Cette carte est déjà dans le cahier', 409);
  }

  const occupantId = await occupantAt(userId, editionId, target, copyId);
  if (occupantId) {
    if (currentSlot == null) {
      await pool.execute(
        'UPDATE collection_copies SET in_binder = 0, binder_slot = NULL WHERE id = ? AND user_id = ?',
        [occupantId, userId],
      );
    } else {
      await pool.execute(
        'UPDATE collection_copies SET in_binder = 1, binder_slot = ? WHERE id = ? AND user_id = ?',
        [currentSlot, occupantId, userId],
      );
    }
  }

  await pool.execute(
    'UPDATE collection_copies SET in_binder = 1, binder_slot = ? WHERE id = ? AND user_id = ?',
    [target, copyId, userId],
  );
  await pool.execute(
    'INSERT IGNORE INTO notebooks (user_id, edition_id) VALUES (?, ?)',
    [userId, editionId],
  );

  return getNotebook(userId, editionId);
}

export async function unplaceCopy(userId: number, editionId: number, copyId: number): Promise<NotebookDetailDto> {
  if (!Number.isFinite(copyId) || copyId <= 0) throw new AppError('Exemplaire invalide', 400);

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT cop.id, c.edition_id
     FROM collection_copies cop
     JOIN cards c ON c.id = cop.card_id
     WHERE cop.id = ? AND cop.user_id = ?`,
    [copyId, userId],
  );
  if (!rows.length) throw new AppError('Exemplaire introuvable', 404);
  if (Number(rows[0].edition_id) !== editionId) {
    throw new AppError('Cette carte n’appartient pas à ce cahier', 400);
  }

  await pool.execute(
    'UPDATE collection_copies SET in_binder = 0, binder_slot = NULL WHERE id = ? AND user_id = ?',
    [copyId, userId],
  );
  return getNotebook(userId, editionId);
}
