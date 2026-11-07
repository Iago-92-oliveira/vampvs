import { Item } from '../types/game';

/** Formato do item enviado ao front-end (loja e inventário). */
export function descreverItem(i: Item) {
  return {
    nome: i.nome,
    descricao: i.descricao,
    tipo: i.tipo,
    nivelMinimo: i.nivel_minimo,
    preco: i.preco_ouro,
    faccao: i.faccao,
    bonus: {
      forca: i.bonus_forca,
      defesa: i.bonus_defesa,
      agilidade: i.bonus_agilidade,
      vitalidade: i.bonus_vitalidade,
    },
    efeito: i.efeito_tipo
      ? { tipo: i.efeito_tipo, valor: i.efeito_valor, duracaoMin: i.efeito_duracao_min }
      : null,
  };
}
