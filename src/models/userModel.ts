import { db } from '../db/database';
import { Usuario } from '../types/game';

export function findByUsername(username: string): Usuario | undefined {
  return db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username) as Usuario | undefined;
}

export function create(username: string, passwordHash: string): number {
  const r = db
    .prepare('INSERT INTO usuarios (username, password_hash) VALUES (?, ?)')
    .run(username, passwordHash);
  return Number(r.lastInsertRowid);
}
