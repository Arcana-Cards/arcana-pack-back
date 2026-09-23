import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { defaultBackColor, defaultBorder, defaultGlow } from '../services/cardVisuals.js';
import { defaultWeights } from '../services/mappers.js';
import { FAR_FAR_AWAY_BOOSTER, FAR_FAR_AWAY_CARDS, FAR_FAR_AWAY_EDITION, FAR_FAR_AWAY_UNIVERSE } from './farFarAwayCatalog.js';
import { generateFarFarAwayArt, publicArtUrls } from './farFarAwayArt.js';

async function upsertUniverse(conn: Connection): Promise<number> {
  const [rows] = await conn.execute<RowDataPacket[]>(
    'SELECT id FROM universes WHERE slug = ?',
    [FAR_FAR_AWAY_UNIVERSE.slug],
  );
  if (rows.length) return Number(rows[0].id);
  const [result] = await conn.execute<ResultSetHeader>(
    `INSERT INTO universes (slug, name, tagline, description, accent_color, backdrop_color)
     VALUES (?,?,?,?,?,?)`,
    [
      FAR_FAR_AWAY_UNIVERSE.slug,
      FAR_FAR_AWAY_UNIVERSE.name,
      FAR_FAR_AWAY_UNIVERSE.tagline,
      FAR_FAR_AWAY_UNIVERSE.description,
      FAR_FAR_AWAY_UNIVERSE.accentColor,
      FAR_FAR_AWAY_UNIVERSE.backdropColor,
    ],
  );
  return result.insertId;
}

async function upsertEdition(conn: Connection, universeId: number): Promise<number> {
  const [rows] = await conn.execute<RowDataPacket[]>(
    'SELECT id FROM editions WHERE code = ?',
    [FAR_FAR_AWAY_EDITION.code],
  );
  if (rows.length) return Number(rows[0].id);
  const [result] = await conn.execute<ResultSetHeader>(
    `INSERT INTO editions (universe_id, name, code, number, description, released_at, cover_color)
     VALUES (?,?,?,?,?,?,?)`,
    [
      universeId,
      FAR_FAR_AWAY_EDITION.name,
      FAR_FAR_AWAY_EDITION.code,
      FAR_FAR_AWAY_EDITION.number,
      FAR_FAR_AWAY_EDITION.description,
      new Date().toISOString().slice(0, 10),
      FAR_FAR_AWAY_EDITION.coverColor,
    ],
  );
  return result.insertId;
}

export async function ensureFarFarAwayCatalog(conn: Connection): Promise<void> {
  const art = generateFarFarAwayArt();
  console.log(`🎨 Art Extrêmement Loin généré (${art.png} stills, ${art.gif} GIF)`);

  const universeId = await upsertUniverse(conn);
  const editionId = await upsertEdition(conn, universeId);

  const [adminRows] = await conn.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    ['admin@arcana.local'],
  );
  const createdBy = adminRows.length ? Number(adminRows[0].id) : null;

  let inserted = 0;
  for (let i = 0; i < FAR_FAR_AWAY_CARDS.length; i += 1) {
    const card = FAR_FAR_AWAY_CARDS[i];
    const [existing] = await conn.execute<RowDataPacket[]>(
      'SELECT id FROM cards WHERE art_seed = ? LIMIT 1',
      [card.slug],
    );
    if (existing.length) {
      const urls = publicArtUrls(card.slug);
      await conn.execute(
        `UPDATE cards SET
          name=?, subtitle=?, description=?, flavor_text=?, rarity=?, foil=?, animated=?,
          frame_style=?, holofoil_pattern=?, art_filter=?, border_finish=?,
          art_url=?, art_animated_url=?
         WHERE id=?`,
        [
          card.name,
          card.subtitle,
          card.description,
          card.flavor,
          card.rarity,
          card.foil ? 1 : 0,
          card.animated ? 1 : 0,
          card.frameStyle,
          card.holofoilPattern,
          card.artFilter,
          card.borderFinish,
          urls.artUrl,
          urls.artAnimatedUrl,
          existing[0].id,
        ],
      );
      continue;
    }
    const urls = publicArtUrls(card.slug);
    await conn.execute(
      `INSERT INTO cards (
        universe_id, edition_id, collector_number, name, subtitle, description, flavor_text,
        style, magic_type, kind, subtype, rarity, foil, animated, border_color, back_color, glow_color,
        frame_style, holofoil_pattern, power, toughness, artist, art_seed, art_url,
        art_filter, border_finish, art_animated_url, animated_unlock_copies, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        universeId,
        editionId,
        i + 1,
        card.name,
        card.subtitle,
        card.description,
        card.flavor,
        card.style,
        card.magicType,
        card.kind,
        card.subtype,
        card.rarity,
        card.foil ? 1 : 0,
        card.animated ? 1 : 0,
        defaultBorder(card.rarity),
        defaultBackColor(card.style),
        defaultGlow(card.rarity),
        card.frameStyle,
        card.holofoilPattern,
        card.power,
        card.toughness,
        card.artist,
        card.slug,
        urls.artUrl,
        card.artFilter,
        card.borderFinish,
        urls.artAnimatedUrl,
        5,
        createdBy,
      ],
    );
    inserted += 1;
  }

  const [boosters] = await conn.execute<RowDataPacket[]>(
    'SELECT id FROM booster_templates WHERE name = ? LIMIT 1',
    [FAR_FAR_AWAY_BOOSTER.name],
  );
  let templateId = boosters.length ? Number(boosters[0].id) : 0;
  if (!templateId) {
    const [created] = await conn.execute<ResultSetHeader>(
      `INSERT INTO booster_templates (
        name, description, universe_id, edition_id, card_count, rarity_weights,
        average_rarity, guaranteed_rarity, foil_chance, animated_chance, allow_duplicates
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        FAR_FAR_AWAY_BOOSTER.name,
        FAR_FAR_AWAY_BOOSTER.description,
        universeId,
        editionId,
        FAR_FAR_AWAY_BOOSTER.cardCount,
        JSON.stringify(defaultWeights()),
        FAR_FAR_AWAY_BOOSTER.averageRarity,
        FAR_FAR_AWAY_BOOSTER.guaranteedRarity,
        FAR_FAR_AWAY_BOOSTER.foilChance,
        FAR_FAR_AWAY_BOOSTER.animatedChance,
        1,
      ],
    );
    templateId = created.insertId;
  }

  await conn.execute(
    `UPDATE booster_templates
     SET rarity_weights = ?, average_rarity = ?, guaranteed_rarity = ?
     WHERE id = ?`,
    [
      JSON.stringify(defaultWeights()),
      FAR_FAR_AWAY_BOOSTER.averageRarity,
      FAR_FAR_AWAY_BOOSTER.guaranteedRarity,
      templateId,
    ],
  );

  await conn.execute(
    `UPDATE booster_templates SET art_url = ? WHERE id = ? AND (art_url IS NULL OR art_url = '')`,
    ['/uploads/cards/marais-aux-oignons.png', templateId],
  );

  if (createdBy) {
    const [owned] = await conn.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM user_boosters WHERE user_id = ? AND template_id = ?',
      [createdBy, templateId],
    );
    if (Number(owned[0].n) < 12) {
      for (let i = Number(owned[0].n); i < 12; i += 1) {
        await conn.execute(
          'INSERT INTO user_boosters (user_id, template_id, granted_by) VALUES (?,?,?)',
          [createdBy, templateId, createdBy],
        );
      }
      console.log('🎁 12 paquets d’Extrêmement Loin accordés à admin');
    }
  }

  console.log(`✅ Catalogue Extrêmement Loin : ${inserted} cartes ajoutées (${FAR_FAR_AWAY_CARDS.length} au total)`);
}
