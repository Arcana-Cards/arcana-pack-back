import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(here, '../.env'),
  path.resolve(here, '../../.env'),
];

export function loadEnv(): void {
  const envPath = candidates.find((file) => fs.existsSync(file));
  if (!envPath) return;
  const parsed = dotenv.parse(fs.readFileSync(envPath));
  for (const [key, value] of Object.entries(parsed)) {
    if (!String(process.env[key] ?? '').trim()) {
      process.env[key] = value;
    }
  }
}

loadEnv();
