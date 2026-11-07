import { db } from '../db/database';
import { Item } from '../types/game';

export function findByNome(nome: string): Item | undefined {
  return db.prepare('SELECT * FROM itens WHERE nome = ?').get(nome) as Item | undefined;
}

export function findById(id: number): Item | undefined {
  return db.prepare('SELECT * FROM itens WHERE id = ?').get(id) as Item | undefined;
}

/** Catálogo da loja: só itens com preço (> 0). */
export function listarCatalogo(): Item[] {
  return db
    .prepare(
      `SELECT * FROM itens WHERE preco_ouro > 0
        ORDER BY CASE tipo WHEN 'weapon' THEN 1 WHEN 'armor' THEN 2 WHEN 'defensive' THEN 3 ELSE 4 END,
                 nivel_minimo, preco_ouro`,
    )
    .all() as Item[];
}
