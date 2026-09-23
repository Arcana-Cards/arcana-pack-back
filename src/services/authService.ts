import bcrypt from 'bcryptjs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../db/connection.js';
import { generateToken } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { mapUser } from './mappers.js';
import type { UserDto } from '../types/index.js';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function registerUser(input: { email?: string; username?: string; password?: string }) {
  const email = input.email ? normalizeEmail(input.email) : '';
  const username = input.username?.trim() ?? '';
  const password = input.password ?? '';

  if (!email.includes('@') || !username || !password) {
    throw new AppError('Champs requis : email, username, password', 400);
  }
  if (username.length < 3 || username.length > 40) {
    throw new AppError('Le pseudo doit faire entre 3 et 40 caractères', 400);
  }
  if (password.length < 6) {
    throw new AppError('Le mot de passe doit faire au moins 6 caractères', 400);
  }

  const [existing] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? OR username = ?',
    [email, username],
  );
  if (existing.length) throw new AppError('Email ou pseudo déjà utilisé', 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (email, username, password_hash, role) VALUES (?,?,?,?)',
    [email, username, passwordHash, 'collector'],
  );

  const token = generateToken({
    userId: result.insertId,
    email,
    username,
    role: 'collector',
  });

  return {
    token,
    user: {
      id: result.insertId,
      email,
      username,
      role: 'collector' as const,
      createdAt: new Date().toISOString(),
      lastLogin: null,
    },
  };
}

export async function loginUser(input: { email?: string; password?: string }) {
  const email = input.email ? normalizeEmail(input.email) : '';
  const password = input.password ?? '';
  if (!email || !password) throw new AppError('Champs requis : email, password', 400);

  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, email, username, password_hash, role FROM users WHERE email = ?',
    [email],
  );
  if (!rows.length) throw new AppError('Email ou mot de passe invalide', 401);

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash as string);
  if (!valid) throw new AppError('Email ou mot de passe invalide', 401);

  await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

  const token = generateToken({
    userId: user.id as number,
    email: user.email as string,
    username: user.username as string,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id as number,
      email: user.email as string,
      username: user.username as string,
      role: user.role,
    },
  };
}

export async function getProfile(userId: number): Promise<UserDto> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.*,
            (SELECT COUNT(*) FROM user_boosters b WHERE b.user_id = u.id AND b.opened_at IS NULL) AS unopened_boosters,
            (SELECT COUNT(*) FROM collection_copies c WHERE c.user_id = u.id) AS collected_copies
     FROM users u WHERE u.id = ?`,
    [userId],
  );
  if (!rows.length) throw new AppError('Utilisateur introuvable', 404);
  return mapUser(rows[0]);
}

export async function listUsers(): Promise<UserDto[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.*,
            (SELECT COUNT(*) FROM user_boosters b WHERE b.user_id = u.id AND b.opened_at IS NULL) AS unopened_boosters,
            (SELECT COUNT(*) FROM collection_copies c WHERE c.user_id = u.id) AS collected_copies
     FROM users u
     ORDER BY u.created_at DESC`,
  );
  return rows.map(mapUser);
}
