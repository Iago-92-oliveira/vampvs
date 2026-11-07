import { db } from '../db/database';
import { Monstro } from '../types/game';

export function listar(): Monstro[] {
  return db.prepare('SELECT * FROM monstros ORDER BY nivel, nome').all() as Monstro[];
}
