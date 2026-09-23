import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from './connection.js';
import { CURRENT_CATALOG_SNAPSHOT } from './currentCatalogSnapshot.js';
import { ensureBoosterPresets } from './boosterPresets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FLAG = CURRENT_CATALOG_SNAPSHOT.flag;

async function ensureFlagsTable(): Promise<void> {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS app_flags (
      name VARCHAR(64) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function catalogSnapshotAlreadyApplied(): Promise<boolean> {
  await ensureFlagsTable();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT name FROM app_flags WHERE name = ?',
    [FLAG],
  );
  return rows.length > 0;
}

function copySnapshotArt(): void {
  const srcDir = path.resolve(__dirname, 'snapshot-art');
  const destDir = path.resolve(__dirname, '../../uploads/cards');
  fs.mkdirSync(destDir, { recursive: true });
  for (const card of CURRENT_CATALOG_SNAPSHOT.cards) {
    if (!card.stillFile) continue;
    const src = path.join(srcDir, card.stillFile);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(destDir, card.stillFile));
  }
}

async function replaceCatalog(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM collection_copies');
    await conn.query('DELETE FROM notebooks');
    await conn.query('DELETE FROM user_boosters');
    await conn.query('DELETE FROM cards');
    await conn.query('DELETE FROM editions');
    await conn.query('DELETE FROM booster_templates');
    await conn.query('DELETE FROM universes');

    const snap = CURRENT_CATALOG_SNAPSHOT;
    const [uni] = await conn.execute<ResultSetHeader>(
      `INSERT INTO universes (slug, name, tagline, description, accent_color, backdrop_color)
       VALUES (?,?,?,?,?,?)`,
      [
        snap.universe.slug,
        snap.universe.name,
        snap.universe.tagline,
        snap.universe.description,
        snap.universe.accentColor,
        snap.universe.backdropColor,
      ],
    );
    const universeId = uni.insertId;
    const [ed] = await conn.execute<ResultSetHeader>(
      `INSERT INTO editions (universe_id, name, code, number, description, released_at, cover_color)
       VALUES (?,?,?,?,?,?,?)`,
      [
        universeId,
        snap.edition.name,
        snap.edition.code,
        snap.edition.number,
        snap.edition.description,
        snap.edition.releasedAt,
        snap.edition.coverColor,
      ],
    );
    const editionId = ed.insertId;

    const [adminRows] = await conn.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      ['admin@arcana.local'],
    );
    const createdBy = adminRows.length ? Number(adminRows[0].id) : null;

    for (const card of snap.cards) {
      await conn.execute(
        `INSERT INTO cards (
          universe_id, edition_id, collector_number, name, subtitle, description, flavor_text,
          style, magic_type, kind, subtype, rarity, foil, animated, border_color, back_color,
          glow_color, text_color, frame_style, holofoil_pattern, power, toughness, artist,
          art_seed, art_url, art_filter, border_finish, art_animated_url, giphy_url,
          animated_unlock_copies, created_by
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          universeId,
          editionId,
          card.collectorNumber,
          card.name,
          card.subtitle,
          card.description,
          card.flavorText,
          card.style,
          card.magicType,
          card.kind,
          card.subtype,
          card.rarity,
          card.foil ? 1 : 0,
          card.animated ? 1 : 0,
          card.borderColor,
          card.backColor,
          card.glowColor,
          card.textColor,
          card.frameStyle,
          card.holofoilPattern,
          card.power,
          card.toughness,
          card.artist,
          card.artSeed,
          card.artUrl,
          card.artFilter,
          card.borderFinish,
          card.artAnimatedUrl,
          card.giphyUrl,
          card.animatedUnlockCopies,
          createdBy,
        ],
      );
    }

    await conn.execute('INSERT INTO app_flags (name) VALUES (?)', [FLAG]);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  copySnapshotArt();
  await ensureBoosterPresets();
}

export async function applyCurrentCatalogSnapshotOnce(): Promise<void> {
  await ensureFlagsTable();
  const [flags] = await pool.execute<RowDataPacket[]>(
    'SELECT name FROM app_flags WHERE name = ?',
    [FLAG],
  );
  if (flags.length) return;

  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id
     FROM universes u
     JOIN editions e ON e.universe_id = u.id
     WHERE u.slug = ? AND e.code = ?
     LIMIT 1`,
    [CURRENT_CATALOG_SNAPSHOT.universe.slug, CURRENT_CATALOG_SNAPSHOT.edition.code],
  );
  if (existing.length) {
    await pool.execute('INSERT IGNORE INTO app_flags (name) VALUES (?)', [FLAG]);
    console.log('📦 Catalog snapshot already present — one-shot skipped');
    return;
  }

  console.log('📦 Applying current catalog snapshot (one-shot wipe + restore)...');
  try {
    await replaceCatalog();
    console.log(`📦 Catalog snapshot applied (${CURRENT_CATALOG_SNAPSHOT.cards.length} cards)`);
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'ER_DUP_ENTRY') {
      console.log('📦 Catalog snapshot already claimed by another start');
      return;
    }
    throw error;
  }
}
