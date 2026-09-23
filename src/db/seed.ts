import type { Connection, RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { getDbConnectionOptions } from './dbConfig.js';
import { applyCurrentCatalogSnapshotOnce } from './applyCurrentCatalogSnapshot.js';
import { ensureFarFarAwayCatalog } from './farFarAwaySeed.js';
import { ensureBoosterPresets } from './boosterPresets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function ensureUsers(conn: Connection): Promise<void> {
  const passwordHash = bcrypt.hashSync('password', 10);
  const email = 'admin@arcana.local';
  const username = 'admin';

  const [rows] = await conn.execute<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [email]);
  if (!rows.length) {
    await conn.execute(
      'INSERT INTO users (email, username, password_hash, role) VALUES (?,?,?,?)',
      [email, username, passwordHash, 'admin'],
    );
    console.log(`✅ User ${email} created`);
    return;
  }

  await conn.execute(
    'UPDATE users SET password_hash = ?, username = ?, role = ? WHERE email = ?',
    [passwordHash, username, 'admin', email],
  );
  console.log(`✅ User ${email} updated`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  const connection = await mysql.createConnection({
    ...getDbConnectionOptions(),
    database: process.env.DB_NAME || 'arcana_pack',
  });
  try {
    await ensureUsers(connection);
    await applyCurrentCatalogSnapshotOnce();
    await ensureFarFarAwayCatalog(connection);
    await ensureBoosterPresets();
  } finally {
    await connection.end();
  }
}
