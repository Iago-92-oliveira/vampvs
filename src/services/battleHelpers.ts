import { GameError } from '../errors';
import * as characterModel from '../models/characterModel';
import { Personagem } from '../types/game';
import { regenerarPA } from './actionPoints';
import { Lutador } from './combat';
import { paParams } from './paService';
import { statsAtuais } from './statsService';

/** Atributos TOTAIS (base + itens equipados) calculados no servidor a cada combate. */
export function lutadorDe(p: Personagem): Lutador {
  const { atributos } = statsAtuais(p);
  const total = (c: string) => atributos.find((a) => a.chave === c)!.total;
  return {
    nome: p.nome,
    forca: total('forca'),
    defesa: total('defesa'),
    agilidade: total('agilidade'),
    vitalidade: total('vitalidade'),
  };
}

/**
 * Regenera e debita PA. Deve rodar DENTRO de uma transação `immediate`
 * (leitura + gravação sem ninguém no meio).
 */
export function gastarPA(p: Personagem, custo: number, agora: number): void {
  const params = paParams(p.id); // teto e recarga dependem do Altar
  const est = regenerarPA(p.pa, p.pa_atualizado_em, agora, params);
  if (est.pa < custo) {
    const faltamMin = Math.max(1, Math.ceil((est.atualizadoEm + params.intervaloMs - agora) / 60000));
    throw new GameError(
      400,
      'pa_insuficiente',
      `Pontos de ação insuficientes (precisa de ${custo}). Próximo PA em cerca de ${faltamMin} min.`,
    );
  }
  characterModel.gravarPA(p.id, est.pa - custo, est.atualizadoEm);
}

export function exigirPersonagemComFaccao(usuarioId: number): Personagem {
  const p = characterModel.findByUsuarioId(usuarioId);
  if (!p) throw new GameError(404, 'personagem_inexistente', 'Personagem não encontrado.');
  if (!p.faccao) throw new GameError(403, 'faccao_pendente', 'Escolha sua facção primeiro.');
  return p;
}
