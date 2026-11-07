import { db } from '../db/database';
import { BonusFonte, EfeitoAtivo } from '../types/game';

/** Só efeitos que ainda não expiraram (a expiração é conferida na leitura, sem timer). */
export function listarAtivos(personagemId: number, agora: number): EfeitoAtivo[] {
  return db
    .prepare('SELECT * FROM efeitos_ativos WHERE personagem_id = ? AND expira_em > ? ORDER BY expira_em')
    .all(personagemId, agora) as EfeitoAtivo[];
}

/** Beber a mesma poção de novo renova a duração em vez de empilhar. */
export function substituir(personagemId: number, nome: string, bonus: BonusFonte, expiraEm: number, agora: number): void {
  db.prepare('DELETE FROM efeitos_ativos WHERE personagem_id = ? AND (nome = ? OR expira_em <= ?)').run(
    personagemId,
    nome,
    agora,
  );
  db.prepare(
    `INSERT INTO efeitos_ativos
     (personagem_id, nome, bonus_forca, bonus_defesa, bonus_agilidade, bonus_vitalidade, expira_em)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(personagemId, nome, bonus.bonus_forca, bonus.bonus_defesa, bonus.bonus_agilidade, bonus.bonus_vitalidade, expiraEm);
}
