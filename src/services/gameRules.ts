import { AtributoNome, BonusFonte, Faccao, Personagem, ATRIBUTOS } from '../types/game';

export const ROTULOS: Record<AtributoNome, string> = {
  forca: 'Força',
  defesa: 'Defesa',
  agilidade: 'Agilidade',
  vitalidade: 'Vitalidade',
};

/** Bônus aplicado uma única vez, no momento da escolha de facção. */
export const BONUS_FACCAO: Record<Faccao, Partial<Record<AtributoNome, number>>> = {
  vampiro: { agilidade: 3 },
  lobisomem: { forca: 3 },
};

export const INFO_FACCAO: Record<Faccao, { titulo: string; descricao: string }> = {
  vampiro: {
    titulo: 'Vampiro',
    descricao: 'Criaturas da noite que vencem pela velocidade e pela emboscada.',
  },
  lobisomem: {
    titulo: 'Lobisomem',
    descricao: 'Predadores da lua cheia que vencem pela força bruta.',
  },
};

/** Itens entregues ao personagem assim que ele escolhe a facção. */
export const ITENS_INICIAIS_POR_FACCAO: Record<Faccao, string[]> = {
  vampiro: ['Espada Comum', 'Couraça de Couro', 'Adaga de Sangue', 'Manto das Sombras'],
  lobisomem: ['Espada Comum', 'Couraça de Couro', 'Garras de Prata', 'Pele de Urso Cinzento'],
};

/** Custo para subir 1 ponto: valor BASE atual do atributo × 10 (bônus de item não encarece o treino). */
export function custoTreino(valorBase: number): number {
  return valorBase * 10;
}

export function xpParaProximoNivel(nivel: number): number {
  return nivel * 100;
}

function bonusDe(fonte: BonusFonte, atributo: AtributoNome): number {
  return fonte[`bonus_${atributo}` as const];
}

/** Atributos finais = base + bônus dos itens EQUIPADOS + efeitos temporários ativos (poções). */
export function calcularStats(p: Personagem, equipados: BonusFonte[], efeitos: BonusFonte[] = []) {
  const fontes = [...equipados, ...efeitos];
  const atributos = ATRIBUTOS.map((chave) => {
    const base = p[chave];
    const bonus = fontes.reduce((soma, f) => soma + bonusDe(f, chave), 0);
    return { chave, rotulo: ROTULOS[chave], base, bonus, total: base + bonus, custo: custoTreino(base) };
  });
  const total = (c: AtributoNome) => atributos.find((a) => a.chave === c)!.total;
  return {
    atributos,
    derivados: {
      pv: total('vitalidade') * 10,
      ataque: total('forca') * 2,
      esquiva: total('agilidade'),
      reducaoDano: total('defesa'),
    },
  };
}

/* ======================= Pontos de Ação, caça e arena ======================= */

export const PA_MAX = 50;
export const PA_INTERVALO_MS = 5 * 60 * 1000; // +1 PA a cada 5 minutos (50 PA em ~4h10)
export const CUSTO_PA_CACA = 1;
export const CUSTO_PA_ATAQUE = 5;

export const NIVEL_MAX_MONSTRO_ACIMA = 2; // só sorteia monstros até (nível do jogador + 2)
export const PONTOS_POR_NIVEL = 3;

export const COOLDOWN_MESMO_ALVO_MS = 10 * 60 * 1000; // não atacar o mesmo jogador 2x em 10 min
export const PERCENTUAL_ROUBO_OURO = 0.1; // vencedor leva 10% do ouro do perdedor...
export const TETO_ROUBO_OURO = 500; //       ...limitado a 500
export const HONRA_VITORIA = 10;
export const HONRA_DERROTA = 3;
export const XP_PVP_BASE = 15;
export const XP_PVP_POR_NIVEL_DO_OPONENTE = 5;

/* ======================= Vila / Mercador ======================= */

export const FRACAO_VENDA = 0.5; // venda rápida: 50% do que o jogador PAGOU
export const LIMITE_INVENTARIO = 40; // máximo de itens carregados
