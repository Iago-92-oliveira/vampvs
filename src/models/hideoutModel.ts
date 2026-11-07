import { db } from '../db/database';
import { Esconderijo, Estrutura } from '../types/game';

/** Estrutura -> coluna. O nome da coluna nunca vem do cliente: só desta tabela fixa. */
const COLUNA: Record<Estrutura, keyof Esconderijo> = {
  cripta: 'nivel_cripta',
  muralha: 'nivel_muralha',
  mina: 'nivel_mina_ouro',
  tesouro: 'nivel_tesouro',
  altar: 'nivel_altar',
};

export function nivelDe(h: Esconderijo, e: Estrutura): number {
  return h[COLUNA[e]] as number;
}

export function buscar(personagemId: number): Esconderijo | undefined {
  return db.prepare('SELECT * FROM esconderijo WHERE personagem_id = ?').get(personagemId) as Esconderijo | undefined;
}

/** Idempotente: se já existir, não faz nada. */
export function criar(personagemId: number, agora: number): void {
  db.prepare('INSERT OR IGNORE INTO esconderijo (personagem_id, acumulado_em) VALUES (?, ?)').run(personagemId, agora);
}

/** Sobe 1 nível SOMENTE se o nível ainda for o que o servidor leu (evita evoluir duas vezes em corrida). */
export function subirNivel(personagemId: number, e: Estrutura, nivelEsperado: number): boolean {
  const col = COLUNA[e];
  if (!col) throw new Error('estrutura inválida');
  const r = db
    .prepare(`UPDATE esconderijo SET ${col} = ${col} + 1 WHERE personagem_id = ? AND ${col} = ?`)
    .run(personagemId, nivelEsperado);
  return r.changes === 1;
}

export function gravarAcumulado(personagemId: number, ouro: number, em: number): void {
  db.prepare('UPDATE esconderijo SET ouro_acumulado = ?, acumulado_em = ? WHERE personagem_id = ?').run(
    Math.max(0, ouro),
    em,
    personagemId,
  );
}
