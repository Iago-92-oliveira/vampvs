import { db } from '../db/database';
import { EntradaInventario, TipoItem } from '../types/game';

const SELECT_BASE = `
  SELECT inv.id AS inv_id, inv.equipado, inv.preco_pago, i.*
    FROM inventario inv
    JOIN itens i ON i.id = inv.item_id
`;

export function listar(personagemId: number): EntradaInventario[] {
  return db
    .prepare(`${SELECT_BASE} WHERE inv.personagem_id = ? ORDER BY inv.equipado DESC, i.tipo, i.nome`)
    .all(personagemId) as EntradaInventario[];
}

export function listarEquipados(personagemId: number): EntradaInventario[] {
  return db
    .prepare(`${SELECT_BASE} WHERE inv.personagem_id = ? AND inv.equipado = 1`)
    .all(personagemId) as EntradaInventario[];
}

/** Só encontra a entrada se ela pertencer ao personagem (evita mexer no inventário alheio). */
export function buscarEntrada(invId: number, personagemId: number): EntradaInventario | undefined {
  return db
    .prepare(`${SELECT_BASE} WHERE inv.id = ? AND inv.personagem_id = ?`)
    .get(invId, personagemId) as EntradaInventario | undefined;
}

export function adicionar(personagemId: number, itemId: number, precoPago = 0): void {
  db.prepare('INSERT INTO inventario (personagem_id, item_id, preco_pago) VALUES (?, ?, ?)').run(
    personagemId,
    itemId,
    precoPago,
  );
}

export function contar(personagemId: number): number {
  const r = db.prepare('SELECT COUNT(*) AS total FROM inventario WHERE personagem_id = ?').get(personagemId) as {
    total: number;
  };
  return r.total;
}

/** Remove a entrada SOMENTE se for do personagem (venda e consumo). */
export function remover(invId: number, personagemId: number): boolean {
  const r = db.prepare('DELETE FROM inventario WHERE id = ? AND personagem_id = ?').run(invId, personagemId);
  return r.changes === 1;
}

export function definirEquipado(invId: number, personagemId: number, equipado: boolean): boolean {
  const r = db
    .prepare('UPDATE inventario SET equipado = ? WHERE id = ? AND personagem_id = ?')
    .run(equipado ? 1 : 0, invId, personagemId);
  return r.changes === 1;
}

/** Desequipa tudo do mesmo slot (arma/armadura) antes de equipar outro. */
export function desequiparSlot(personagemId: number, tipo: TipoItem): void {
  db.prepare(
    `UPDATE inventario SET equipado = 0
      WHERE personagem_id = ? AND equipado = 1
        AND item_id IN (SELECT id FROM itens WHERE tipo = ?)`,
  ).run(personagemId, tipo);
}
