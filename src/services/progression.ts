import { PONTOS_POR_NIVEL, xpParaProximoNivel } from './gameRules';

export interface Progresso {
  nivel: number;
  xp: number;
  pontosGanhos: number;
  niveisGanhos: number;
}

/** Soma XP e sobe quantos níveis forem necessários (o XP que sobra é mantido). Função pura. */
export function aplicarXp(nivel: number, xp: number, ganho: number): Progresso {
  let n = nivel;
  let x = xp + ganho;
  let niveis = 0;
  while (x >= xpParaProximoNivel(n)) {
    x -= xpParaProximoNivel(n);
    n++;
    niveis++;
  }
  return { nivel: n, xp: x, niveisGanhos: niveis, pontosGanhos: niveis * PONTOS_POR_NIVEL };
}
