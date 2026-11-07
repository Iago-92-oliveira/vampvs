import { db } from '../db/database';
import { GameError } from '../errors';
import * as characterModel from '../models/characterModel';
import * as efeitoModel from '../models/efeitoModel';
import * as inventoryModel from '../models/inventoryModel';
import { EntradaInventario, Personagem } from '../types/game';
import { regenerarPA } from './actionPoints';
import { FRACAO_VENDA } from './gameRules';
import { paParams } from './paService';
import { descreverItem } from './itemView';

function parseInvId(valor: unknown): number {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new GameError(400, 'id_invalido', 'Item inválido.');
  return id;
}

function carregarPersonagem(usuarioId: number): Personagem {
  const p = characterModel.findByUsuarioId(usuarioId);
  if (!p) throw new GameError(404, 'personagem_inexistente', 'Personagem não encontrado.');
  return p;
}

export function valorDeVenda(precoPago: number): number {
  return precoPago > 0 ? Math.max(1, Math.floor(precoPago * FRACAO_VENDA)) : 0;
}

/** Por que o item NÃO pode ser equipado agora (null = pode, ou é poção). Usado só para a UI; o servidor revalida. */
function bloqueioDeEquipar(p: Personagem, e: EntradaInventario): string | null {
  if (e.tipo === 'potion') return null;
  if (e.faccao && e.faccao !== p.faccao) return `Exclusivo de ${e.faccao}`;
  if (p.nivel < e.nivel_minimo) return `Requer nível ${e.nivel_minimo}`;
  return null;
}

export function listar(usuarioId: number) {
  const p = carregarPersonagem(usuarioId);
  const itens = inventoryModel.listar(p.id).map((e) => ({
    id: e.inv_id,
    equipado: e.equipado === 1,
    item: descreverItem(e),
    precoPago: e.preco_pago,
    valorVenda: valorDeVenda(e.preco_pago), // 0 = não vendável (item inicial)
    bloqueio: bloqueioDeEquipar(p, e),
  }));
  return { itens, ocupados: itens.length };
}

/** Tudo dentro de uma transação: qualquer erro lançado desfaz as alterações. */
export const equipar = db.transaction((usuarioId: number, invIdBruto: unknown) => {
  const invId = parseInvId(invIdBruto);
  const p = carregarPersonagem(usuarioId);

  const entrada = inventoryModel.buscarEntrada(invId, p.id);
  if (!entrada) throw new GameError(404, 'item_nao_encontrado', 'Item não encontrado no seu inventário.');
  if (entrada.tipo === 'potion') throw new GameError(400, 'nao_equipavel', 'Poções não podem ser equipadas, apenas usadas.');
  if (entrada.equipado === 1) throw new GameError(409, 'item_ja_equipado', 'Este item já está equipado.');
  if (entrada.faccao && entrada.faccao !== p.faccao) {
    throw new GameError(403, 'faccao_incompativel', `Este item é exclusivo da facção ${entrada.faccao}.`);
  }
  if (p.nivel < entrada.nivel_minimo) {
    throw new GameError(403, 'nivel_insuficiente', `Requer nível ${entrada.nivel_minimo}.`);
  }

  inventoryModel.desequiparSlot(p.id, entrada.tipo); // equipar uma nova arma desequipa a anterior
  inventoryModel.definirEquipado(invId, p.id, true);
});

export const desequipar = db.transaction((usuarioId: number, invIdBruto: unknown) => {
  const invId = parseInvId(invIdBruto);
  const p = carregarPersonagem(usuarioId);

  const entrada = inventoryModel.buscarEntrada(invId, p.id);
  if (!entrada) throw new GameError(404, 'item_nao_encontrado', 'Item não encontrado no seu inventário.');
  if (entrada.equipado === 0) throw new GameError(409, 'item_nao_equipado', 'Este item não está equipado.');

  inventoryModel.definirEquipado(invId, p.id, false);
});

/** Usa uma poção: aplica o efeito e remove a poção do inventário, tudo na mesma transação. */
const usarTx = db.transaction((usuarioId: number, invIdBruto: unknown) => {
  const invId = parseInvId(invIdBruto);
  const agora = Date.now();
  const p = carregarPersonagem(usuarioId);

  const e = inventoryModel.buscarEntrada(invId, p.id);
  if (!e) throw new GameError(404, 'item_nao_encontrado', 'Item não encontrado no seu inventário.');
  if (e.tipo !== 'potion') throw new GameError(400, 'nao_consumivel', 'Este item não é consumível.');
  if (p.nivel < e.nivel_minimo) throw new GameError(403, 'nivel_insuficiente', `Requer nível ${e.nivel_minimo}.`);

  let mensagem: string;
  if (e.efeito_tipo === 'pa') {
    const params = paParams(p.id);
    const est = regenerarPA(p.pa, p.pa_atualizado_em, agora, params);
    if (est.pa >= params.paMax) throw new GameError(409, 'pa_cheio', 'Seus pontos de ação já estão cheios.');
    const novo = Math.min(params.paMax, est.pa + (e.efeito_valor ?? 0));
    characterModel.gravarPA(p.id, novo, novo >= params.paMax ? agora : est.atualizadoEm);
    mensagem = `${e.nome}: você recuperou ${novo - est.pa} ponto(s) de ação.`;
  } else if (e.efeito_tipo === 'buff') {
    const minutos = e.efeito_duracao_min ?? 30;
    efeitoModel.substituir(p.id, e.nome, e, agora + minutos * 60_000, agora);
    mensagem = `${e.nome} ativa por ${minutos} minutos.`;
  } else {
    throw new GameError(500, 'efeito_invalido', 'Poção sem efeito configurado.');
  }

  if (!inventoryModel.remover(invId, p.id)) throw new GameError(409, 'estado_mudou', 'Tente novamente.');
  return { mensagem };
});

export function usar(usuarioId: number, invId: unknown) {
  return usarTx.immediate(usuarioId, invId);
}

/** Venda rápida: devolve FRACAO_VENDA do que o jogador pagou. Itens iniciais (preco_pago = 0) não vendem. */
const venderTx = db.transaction((usuarioId: number, invIdBruto: unknown) => {
  const invId = parseInvId(invIdBruto);
  const p = carregarPersonagem(usuarioId);

  const e = inventoryModel.buscarEntrada(invId, p.id);
  if (!e) throw new GameError(404, 'item_nao_encontrado', 'Item não encontrado no seu inventário.');
  const valor = valorDeVenda(e.preco_pago);
  if (valor <= 0) throw new GameError(400, 'nao_vendavel', 'Itens iniciais não podem ser vendidos.');

  if (!inventoryModel.remover(invId, p.id)) throw new GameError(409, 'estado_mudou', 'Tente novamente.');
  characterModel.creditarOuro(p.id, valor); // se o item estava equipado, o bônus some junto com a linha
  return { nome: e.nome, valor };
});

export function vender(usuarioId: number, invId: unknown) {
  return venderTx.immediate(usuarioId, invId);
}
