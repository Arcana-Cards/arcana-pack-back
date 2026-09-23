import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import type { EditionDto, UniverseDto } from '../types/index.js';
import { mapEdition, mapUniverse } from './mappers.js';
import { isHexColor, slugifySeed } from './cardVisuals.js';

export async function listUniverses(): Promise<UniverseDto[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM universes ORDER BY name',
  );
  return rows.map(mapUniverse);
}

export async function createUniverse(body: {
  name: string;
  tagline?: string | null;
  description?: string | null;
  accentColor?: string;
  backdropColor?: string;
}): Promise<UniverseDto> {
  const name = body.name?.trim();
  if (!name) throw new AppError('Champ requis : name', 400);
  const accent = body.accentColor || '#7c3aed';
  const backdrop = body.backdropColor || '#0b0614';
  if (!isHexColor(accent) || !isHexColor(backdrop)) throw new AppError('Couleur invalide', 400);
  const slug = await uniqueUniverseSlug(slugifySeed(name));

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO universes (slug, name, tagline, description, accent_color, backdrop_color)
     VALUES (?,?,?,?,?,?)`,
    [slug, name, body.tagline?.trim() || null, body.description?.trim() || null, accent, backdrop],
  );
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM universes WHERE id = ?', [result.insertId]);
  return mapUniverse(rows[0]);
}

async function uniqueUniverseSlug(base: string): Promise<string> {
  const root = (base || 'univers').slice(0, 56);
  for (let n = 1; n < 100; n += 1) {
    const slug = n === 1 ? root : `${root.slice(0, 52)}-${n}`;
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT id FROM universes WHERE slug = ?', [slug]);
    if (!rows.length) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function getUniverse(id: number): Promise<UniverseDto> {
  if (!Number.isInteger(id) || id < 1) throw new AppError('Univers invalide', 400);
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM universes WHERE id = ?', [id]);
  if (!rows.length) throw new AppError('Univers introuvable', 404);
  return mapUniverse(rows[0]);
}

export async function updateUniverse(id: number, body: {
  name?: string;
  tagline?: string | null;
  description?: string | null;
  accentColor?: string;
  backdropColor?: string;
}): Promise<UniverseDto> {
  const current = await getUniverse(id);
  const name = (body.name ?? current.name).trim();
  if (!name) throw new AppError('Champ requis : name', 400);
  const tagline = body.tagline !== undefined ? (body.tagline?.trim() || null) : current.tagline;
  const description = body.description !== undefined ? (body.description?.trim() || null) : current.description;
  const accentColor = body.accentColor || current.accentColor;
  const backdropColor = body.backdropColor || current.backdropColor;
  if (!isHexColor(accentColor) || !isHexColor(backdropColor)) throw new AppError('Couleur invalide', 400);

  await pool.execute(
    `UPDATE universes SET name=?, tagline=?, description=?, accent_color=?, backdrop_color=? WHERE id=?`,
    [name, tagline, description, accentColor, backdropColor, id],
  );
  return getUniverse(id);
}

export async function listEditions(universeId?: number): Promise<EditionDto[]> {
  const params: number[] = [];
  const where = universeId ? 'WHERE e.universe_id = ?' : '';
  if (universeId) params.push(universeId);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT e.*, u.name AS universe_name, COUNT(c.id) AS card_count
     FROM editions e
     JOIN universes u ON u.id = e.universe_id
     LEFT JOIN cards c ON c.edition_id = e.id
     ${where}
     GROUP BY e.id
     ORDER BY u.name, e.number`,
    params,
  );
  return rows.map(mapEdition);
}

export async function createEdition(body: {
  universeId: number;
  name: string;
  code: string;
  number?: number;
  description?: string | null;
  releasedAt?: string | null;
  coverColor?: string;
}): Promise<EditionDto> {
  const name = body.name?.trim();
  const code = body.code?.trim().toUpperCase();
  if (!body.universeId || !name || !code) throw new AppError('Champs requis : universeId, name, code', 400);
  const cover = body.coverColor || '#1e1b4b';
  if (!isHexColor(cover)) throw new AppError('coverColor invalide', 400);

  let number = body.number;
  if (!number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(number), 0) + 1 AS next_n FROM editions WHERE universe_id = ?',
      [body.universeId],
    );
    number = Number(rows[0].next_n);
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO editions (universe_id, name, code, number, description, released_at, cover_color)
     VALUES (?,?,?,?,?,?,?)`,
    [body.universeId, name, code, number, body.description?.trim() || null, body.releasedAt || null, cover],
  );
  const [created] = await pool.execute<RowDataPacket[]>(
    `SELECT e.*, u.name AS universe_name FROM editions e
     JOIN universes u ON u.id = e.universe_id WHERE e.id = ?`,
    [result.insertId],
  );
  return mapEdition(created[0]);
}

export async function getEdition(id: number): Promise<EditionDto> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT e.*, u.name AS universe_name, COUNT(c.id) AS card_count
     FROM editions e
     JOIN universes u ON u.id = e.universe_id
     LEFT JOIN cards c ON c.edition_id = e.id
     WHERE e.id = ?
     GROUP BY e.id`,
    [id],
  );
  if (!rows.length) throw new AppError('Édition introuvable', 404);
  return mapEdition(rows[0]);
}

export async function updateEdition(id: number, body: {
  universeId?: number;
  name?: string;
  code?: string;
  number?: number;
  description?: string | null;
  releasedAt?: string | null;
  coverColor?: string;
}): Promise<EditionDto> {
  const current = await getEdition(id);
  const name = (body.name ?? current.name).trim();
  const code = (body.code ?? current.code).trim().toUpperCase();
  const universeId = body.universeId != null ? Number(body.universeId) : current.universeId;
  const number = body.number != null && Number(body.number) > 0 ? Number(body.number) : current.number;
  const description = body.description !== undefined ? (body.description?.trim() || null) : current.description;
  const releasedAt = body.releasedAt !== undefined ? (body.releasedAt || null) : current.releasedAt;
  const coverColor = body.coverColor || current.coverColor;
  if (!name || !code) throw new AppError('Champs requis : name, code', 400);
  if (!Number.isFinite(universeId) || universeId < 1) throw new AppError('Univers invalide', 400);
  if (!isHexColor(coverColor)) throw new AppError('coverColor invalide', 400);

  const [unis] = await pool.execute<RowDataPacket[]>('SELECT id FROM universes WHERE id = ?', [universeId]);
  if (!unis.length) throw new AppError('Univers introuvable', 404);

  await pool.execute(
    `UPDATE editions
     SET universe_id=?, name=?, code=?, number=?, description=?, released_at=?, cover_color=?
     WHERE id=?`,
    [universeId, name, code, number, description, releasedAt, coverColor, id],
  );
  if (universeId !== current.universeId) {
    await pool.execute('UPDATE cards SET universe_id = ? WHERE edition_id = ?', [universeId, id]);
  }
  return getEdition(id);
}

export async function deleteEdition(id: number): Promise<void> {
  if (!Number.isInteger(id) || id < 1) throw new AppError('Édition invalide', 400);
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT id FROM editions WHERE id = ?', [id]);
  if (!rows.length) throw new AppError('Édition introuvable', 404);
  await pool.execute('DELETE FROM booster_templates WHERE edition_id = ?', [id]);
  await pool.execute('DELETE FROM editions WHERE id = ?', [id]);
}

export async function deleteUniverse(id: number): Promise<void> {
  if (!Number.isInteger(id) || id < 1) throw new AppError('Univers invalide', 400);
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT id FROM universes WHERE id = ?', [id]);
  if (!rows.length) throw new AppError('Univers introuvable', 404);
  await pool.execute('DELETE FROM booster_templates WHERE universe_id = ?', [id]);
  await pool.execute('DELETE FROM universes WHERE id = ?', [id]);
}
