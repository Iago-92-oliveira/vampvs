import { db } from '../db/database';
import { GameError } from '../errors';
import * as characterModel from '../models/characterModel';
import * as inventoryModel from '../models/inventoryModel';
import * as itemModel from '../models/itemModel';
import { exigirPersonagemComFaccao } from './battleHelpers';
import { LIMITE_INVENTARIO } from './gameRules';
import { descreverItem } from './itemView';

/** Catálogo visível ao jogador: itens neutros + os da própria facção. `bloqueio` só serve para desabilitar o botão. */
export function catalogo(usuarioId: number) {
  const p = exigirPersonagemComFaccao(usuarioId);
  const ocupados = inventoryModel.contar(p.id);
  const itens = itemModel
    .listarCatalogo()
    .filter((i) => !i.faccao || i.faccao === p.faccao)
    .map((i) => {
      let bloqueio: string | null = null;
      if (p.nivel < i.nivel_minimo) bloqueio = `Requer nível ${i.nivel_minimo}`;
      else if (p.ouro < i.preco_ouro) bloqueio = `Faltam ${i.preco_ouro - p.ouro} de ouro`;
      else if (ocupados >= LIMITE_INVENTARIO) bloqueio = 'Inventário cheio';
      return { id: i.id, ...descreverItem(i), bloqueio };
    });
  return { ouro: p.ouro, nivel: p.nivel, ocupados, limiteInventario: LIMITE_INVENTARIO, itens };
}

/**
 * Compra. O preço e as regras vêm SEMPRE do banco (o cliente só envia o id do item).
 * Transação imediata: checagem de saldo, débito e entrega do item acontecem juntos ou não acontecem.
 */
const comprarTx = db.transaction((usuarioId: number, itemIdBruto: unknown) => {
  const itemId = typeof itemIdBruto === 'number' ? itemIdBruto : Number(itemIdBruto);
  if (!Number.isInteger(itemId) || itemId <= 0) throw new GameError(400, 'item_invalido', 'Item inválido.');

  const p = exigirPersonagemComFaccao(usuarioId);
  const item = itemModel.findById(itemId);
  if (!item || item.preco_ouro <= 0) throw new GameError(404, 'item_inexistente', 'Este item não está à venda.');

  if (item.faccao && item.faccao !== p.faccao) {
    throw new GameError(403, 'faccao_incompativel', `Este item é exclusivo da facção ${item.faccao}.`);
  }
  if (p.nivel < item.nivel_minimo) {
    throw new GameError(403, 'nivel_insuficiente', `Requer nível ${item.nivel_minimo} (você está no nível ${p.nivel}).`);
  }
  if (inventoryModel.contar(p.id) >= LIMITE_INVENTARIO) {
    throw new GameError(400, 'inventario_cheio', `Inventário cheio (máximo de ${LIMITE_INVENTARIO} itens). Venda ou use algo.`);
  }
  if (p.ouro < item.preco_ouro) {
    throw new GameError(400, 'ouro_insuficiente', `Ouro insuficiente: faltam ${item.preco_ouro - p.ouro}.`);
  }
  // Segunda barreira: o UPDATE só debita se `ouro >= preço` no momento da escrita.
  if (!characterModel.debitarOuro(p.id, item.preco_ouro)) {
    throw new GameError(400, 'ouro_insuficiente', 'Ouro insuficiente.');
  }
  inventoryModel.adicionar(p.id, item.id, item.preco_ouro);
  return { nome: item.nome, preco: item.preco_ouro };
});

export function comprar(usuarioId: number, itemId: unknown) {
  return comprarTx.immediate(usuarioId, itemId);
}
