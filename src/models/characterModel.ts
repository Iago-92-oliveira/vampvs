import { db } from '../db/database';
import { ATRIBUTOS, AtributoNome, Faccao, Personagem } from '../types/game';

export function findByUsuarioId(usuarioId: number): Personagem | undefined {
  return db.prepare('SELECT * FROM personagens WHERE usuario_id = ?').get(usuarioId) as
    | Personagem
    | undefined;
}

export function create(usuarioId: number, nome: string): number {
  const r = db.prepare('INSERT INTO personagens (usuario_id, nome) VALUES (?, ?)').run(usuarioId, nome);
  return Number(r.lastInsertRowid);
}

/**
 * Define a facção APENAS se ainda for NULL (escolha permanente).
 * Retorna false se já havia facção — a checagem e a escrita são um único UPDATE atômico.
 */
export function definirFaccao(
  personagemId: number,
  faccao: Faccao,
  bonus: Partial<Record<AtributoNome, number>>,
): boolean {
  const r = db
    .prepare(
      `UPDATE personagens
          SET faccao = ?,
              forca = forca + ?, defesa = defesa + ?,
              agilidade = agilidade + ?, vitalidade = vitalidade + ?
        WHERE id = ? AND faccao IS NULL`,
    )
    .run(
      faccao,
      bonus.forca ?? 0,
      bonus.defesa ?? 0,
      bonus.agilidade ?? 0,
      bonus.vitalidade ?? 0,
      personagemId,
    );
  return r.changes === 1;
}

/**
 * Sobe 1 ponto e debita o ouro num único UPDATE condicional.
 * As condições `ouro >= custo` e `atributo = valorEsperado` garantem que duas
 * requisições simultâneas não gastem o mesmo ouro nem paguem o custo errado.
 */
export function aplicarTreino(
  personagemId: number,
  atributo: AtributoNome,
  valorEsperado: number,
  custo: number,
): boolean {
  if (!ATRIBUTOS.includes(atributo)) throw new Error('atributo inválido'); // nome de coluna nunca vem cru do cliente
  const r = db
    .prepare(
      `UPDATE personagens
          SET ${atributo} = ${atributo} + 1, ouro = ouro - ?
        WHERE id = ? AND ${atributo} = ? AND ouro >= ? AND faccao IS NOT NULL`,
    )
    .run(custo, personagemId, valorEsperado, custo);
  return r.changes === 1;
}

export function adicionarOuro(personagemId: number, quantidade: number): void {
  db.prepare('UPDATE personagens SET ouro = ouro + ? WHERE id = ?').run(quantidade, personagemId);
}

export function findById(id: number): Personagem | undefined {
  return db.prepare('SELECT * FROM personagens WHERE id = ?').get(id) as Personagem | undefined;
}

export function gravarPA(personagemId: number, pa: number, atualizadoEm: number): void {
  db.prepare('UPDATE personagens SET pa = ?, pa_atualizado_em = ? WHERE id = ?').run(pa, atualizadoEm, personagemId);
}

/** Gasta 1 ponto livre num atributo; o `pontos_livres > 0` no WHERE impede saldo negativo. */
export function usarPontoLivre(personagemId: number, atributo: AtributoNome): boolean {
  if (!ATRIBUTOS.includes(atributo)) throw new Error('atributo inválido');
  const r = db
    .prepare(
      `UPDATE personagens
          SET ${atributo} = ${atributo} + 1, pontos_livres = pontos_livres - 1
        WHERE id = ? AND pontos_livres > 0`,
    )
    .run(personagemId);
  return r.changes === 1;
}

export interface ResultadoAplicavel {
  nivel: number;
  xp: number;
  pontosGanhos: number;
  deltaOuro: number; // pode ser negativo (PvP); nunca deixa o ouro abaixo de zero
  deltaHonra: number; // pode ser negativo; honra nunca fica abaixo de zero
}

export function aplicarResultado(personagemId: number, r: ResultadoAplicavel): void {
  const res = db
    .prepare(
      `UPDATE personagens
          SET nivel = ?, xp = ?,
              pontos_livres = pontos_livres + ?,
              ouro = ouro + ?,
              honra = MAX(0, honra + ?)
        WHERE id = ? AND ouro + ? >= 0`,
    )
    .run(r.nivel, r.xp, r.pontosGanhos, r.deltaOuro, r.deltaHonra, personagemId, r.deltaOuro);
  if (res.changes !== 1) throw new Error('falha ao aplicar resultado de batalha');
}

export interface AlvoArena {
  id: number;
  nome: string;
  faccao: Faccao;
  nivel: number;
  honra: number;
}

export function listarAlvos(faccaoOposta: Faccao, excluirId: number, limite: number): AlvoArena[] {
  return db
    .prepare(
      `SELECT id, nome, faccao, nivel, honra FROM personagens
        WHERE faccao = ? AND id <> ?
        ORDER BY honra DESC, nivel DESC, nome LIMIT ?`,
    )
    .all(faccaoOposta, excluirId, limite) as AlvoArena[];
}

export function ranking(limite: number): AlvoArena[] {
  return db
    .prepare(
      `SELECT id, nome, faccao, nivel, honra FROM personagens
        WHERE faccao IS NOT NULL
        ORDER BY honra DESC, nivel DESC, nome LIMIT ?`,
    )
    .all(limite) as AlvoArena[];
}

/** Débito atômico: o `ouro >= valor` no WHERE garante que o saldo nunca fica negativo. */
export function debitarOuro(personagemId: number, valor: number): boolean {
  const r = db
    .prepare('UPDATE personagens SET ouro = ouro - ? WHERE id = ? AND ouro >= ?')
    .run(valor, personagemId, valor);
  return r.changes === 1;
}

export function creditarOuro(personagemId: number, valor: number): void {
  db.prepare('UPDATE personagens SET ouro = ouro + ? WHERE id = ?').run(valor, personagemId);
}

/**
 * Grava o avatar. O `faccao = ?` no WHERE é uma segunda barreira, no próprio UPDATE:
 * só grava se o avatar for da mesma facção que está gravada no personagem.
 */
export function definirAvatar(personagemId: number, avatarId: string, faccaoDoAvatar: Faccao): boolean {
  const r = db
    .prepare('UPDATE personagens SET avatar = ? WHERE id = ? AND faccao = ?')
    .run(avatarId, personagemId, faccaoDoAvatar);
  return r.changes === 1;
}
