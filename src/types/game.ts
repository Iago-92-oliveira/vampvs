export type Faccao = 'vampiro' | 'lobisomem';
export const FACCOES: Faccao[] = ['vampiro', 'lobisomem'];

export type AtributoNome = 'forca' | 'defesa' | 'agilidade' | 'vitalidade';
export const ATRIBUTOS: AtributoNome[] = ['forca', 'defesa', 'agilidade', 'vitalidade'];

export type TipoItem = 'weapon' | 'armor' | 'defensive' | 'potion';
export const TIPOS_EQUIPAVEIS: TipoItem[] = ['weapon', 'armor', 'defensive'];
export type EfeitoTipo = 'pa' | 'buff';

export interface Usuario {
  id: number;
  username: string;
  password_hash: string;
}

export interface Personagem {
  id: number;
  usuario_id: number;
  nome: string;
  faccao: Faccao | null; // null = ainda não escolheu
  nivel: number;
  xp: number;
  ouro: number;
  forca: number;
  defesa: number;
  agilidade: number;
  vitalidade: number;
  pa: number; // pontos de ação gravados (a regeneração é calculada sob demanda)
  pa_atualizado_em: number; // epoch ms do último "tick" de regeneração
  pontos_livres: number; // pontos de atributo ganhos ao subir de nível
  honra: number; // pontuação do ranking PvP
}

export interface Monstro {
  id: number;
  nome: string;
  descricao: string;
  nivel: number;
  forca: number;
  defesa: number;
  agilidade: number;
  vitalidade: number;
  xp_recompensa: number;
  ouro_min: number;
  ouro_max: number;
}

export interface Item {
  id: number;
  nome: string;
  descricao: string;
  tipo: TipoItem;
  bonus_forca: number;
  bonus_defesa: number;
  bonus_agilidade: number;
  bonus_vitalidade: number;
  nivel_minimo: number;
  preco_ouro: number;
  faccao: Faccao | null; // null = qualquer facção
  // Só poções: 'pa' restaura pontos de ação (efeito_valor); 'buff' soma os bonus_* por efeito_duracao_min minutos.
  efeito_tipo: EfeitoTipo | null;
  efeito_valor: number | null;
  efeito_duracao_min: number | null;
}

/** Qualquer coisa que some bônus aos atributos (item equipado ou efeito de poção). */
export interface BonusFonte {
  bonus_forca: number;
  bonus_defesa: number;
  bonus_agilidade: number;
  bonus_vitalidade: number;
}

export interface EfeitoAtivo extends BonusFonte {
  id: number;
  personagem_id: number;
  nome: string;
  expira_em: number; // epoch ms
}

/** Linha do inventário já unida com os dados do item. */
export interface EntradaInventario extends Item {
  inv_id: number;
  equipado: number; // 0 | 1
  preco_pago: number; // ouro pago na compra (0 = item inicial, não vendável)
}

export type Estrutura = 'cripta' | 'muralha' | 'mina' | 'tesouro' | 'altar';
export const ESTRUTURAS: Estrutura[] = ['cripta', 'muralha', 'mina', 'tesouro', 'altar'];

export interface Esconderijo {
  id: number;
  personagem_id: number;
  nivel_cripta: number;
  nivel_muralha: number;
  nivel_mina_ouro: number;
  nivel_tesouro: number;
  nivel_altar: number;
  ouro_acumulado: number; // ouro já produzido e "liquidado" até acumulado_em (pode ter fração)
  acumulado_em: number; // epoch ms
}
