import { db } from '../db/database';

export interface NovaBatalha {
  tipo: 'pve' | 'pvp';
  atacanteId: number;
  defensorId: number | null;
  monstroNome: string | null;
  monstroNivel: number | null;
  vencedor: 'atacante' | 'defensor';
  xpGanho: number;
  ouroGanho: number;
  honraGanha: number;
  honraPerdida: number;
  criadoEm: number;
}

export interface LinhaBatalha {
  id: number;
  tipo: 'pve' | 'pvp';
  atacante_id: number;
  defensor_id: number | null;
  monstro_nome: string | null;
  monstro_nivel: number | null;
  vencedor: 'atacante' | 'defensor';
  xp_ganho: number;
  ouro_ganho: number;
  honra_ganha: number;
  honra_perdida: number;
  criado_em: number;
  atacante_nome: string;
  defensor_nome: string | null;
}

export function registrar(b: NovaBatalha): void {
  db.prepare(
    `INSERT INTO batalhas
     (tipo, atacante_id, defensor_id, monstro_nome, monstro_nivel, vencedor,
      xp_ganho, ouro_ganho, honra_ganha, honra_perdida, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    b.tipo, b.atacanteId, b.defensorId, b.monstroNome, b.monstroNivel, b.vencedor,
    b.xpGanho, b.ouroGanho, b.honraGanha, b.honraPerdida, b.criadoEm,
  );
}

export function recentes(personagemId: number, limite: number): LinhaBatalha[] {
  return db
    .prepare(
      `SELECT b.*, a.nome AS atacante_nome, d.nome AS defensor_nome
         FROM batalhas b
         JOIN personagens a ON a.id = b.atacante_id
         LEFT JOIN personagens d ON d.id = b.defensor_id
        WHERE b.atacante_id = ? OR b.defensor_id = ?
        ORDER BY b.id DESC LIMIT ?`,
    )
    .all(personagemId, personagemId, limite) as LinhaBatalha[];
}

/** Último ataque PvP do atacante contra cada alvo (para o cooldown): defensor_id -> epoch ms. */
export function ultimosAtaquesPvp(atacanteId: number): Map<number, number> {
  const linhas = db
    .prepare(
      `SELECT defensor_id, MAX(criado_em) AS ultimo
         FROM batalhas
        WHERE tipo = 'pvp' AND atacante_id = ?
        GROUP BY defensor_id`,
    )
    .all(atacanteId) as Array<{ defensor_id: number; ultimo: number }>;
  return new Map(linhas.map((l) => [l.defensor_id, l.ultimo]));
}
