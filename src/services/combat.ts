/**
 * Motor de combate puro (sem banco, sem Express): recebe dois lutadores e devolve o relatório.
 * O RNG é injetável para permitir testes determinísticos.
 *
 *  - Vida máxima      = vitalidade × 10
 *  - Chance de acerto = 70% + (agilidade do atacante − agilidade do alvo) × 2%   (limitada a 20%–95%)
 *  - Dano bruto       = força × 2 × variação aleatória (0,85 a 1,15)
 *  - Dano líquido     = bruto × 20 / (20 + defesa do alvo)   (mínimo 1; defesa tem retorno decrescente)
 *  - Iniciativa       = quem tem mais agilidade ataca primeiro em todos os rounds (empate: sorteio)
 *  - Limite de 20 rounds; se ninguém cair, vence quem tiver maior % de vida (empate: defensor).
 */

export type Rng = () => number;

export interface Lutador {
  nome: string;
  forca: number;
  defesa: number;
  agilidade: number;
  vitalidade: number;
}

export interface LogRound {
  round: number;
  atacante: 'A' | 'D'; // A = quem iniciou o combate, D = defensor/monstro
  acertou: boolean;
  dano: number;
  hpA: number;
  hpD: number;
}

export interface ResultadoCombate {
  vencedor: 'A' | 'D';
  hpMaxA: number;
  hpMaxD: number;
  hpFinalA: number;
  hpFinalD: number;
  rounds: LogRound[];
}

export const MAX_ROUNDS = 20;

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function chanceAcerto(atacante: Lutador, alvo: Lutador): number {
  return limitar(0.7 + (atacante.agilidade - alvo.agilidade) * 0.02, 0.2, 0.95);
}

export function danoLiquido(atacante: Lutador, alvo: Lutador, rng: Rng): number {
  const bruto = atacante.forca * 2 * (0.85 + rng() * 0.3);
  return Math.max(1, Math.round((bruto * 20) / (20 + alvo.defesa)));
}

export function simular(a: Lutador, d: Lutador, rng: Rng = Math.random): ResultadoCombate {
  const hpMaxA = a.vitalidade * 10;
  const hpMaxD = d.vitalidade * 10;
  let hpA = hpMaxA;
  let hpD = hpMaxD;
  const rounds: LogRound[] = [];

  const aPrimeiro = a.agilidade > d.agilidade || (a.agilidade === d.agilidade && rng() < 0.5);
  const ordem: Array<'A' | 'D'> = aPrimeiro ? ['A', 'D'] : ['D', 'A'];

  for (let r = 1; r <= MAX_ROUNDS && hpA > 0 && hpD > 0; r++) {
    for (const quem of ordem) {
      if (hpA <= 0 || hpD <= 0) break;
      const atk = quem === 'A' ? a : d;
      const alvo = quem === 'A' ? d : a;
      const acertou = rng() < chanceAcerto(atk, alvo);
      const dano = acertou ? danoLiquido(atk, alvo, rng) : 0;
      if (quem === 'A') hpD = Math.max(0, hpD - dano);
      else hpA = Math.max(0, hpA - dano);
      rounds.push({ round: r, atacante: quem, acertou, dano, hpA, hpD });
    }
  }

  let vencedor: 'A' | 'D';
  if (hpA <= 0) vencedor = 'D';
  else if (hpD <= 0) vencedor = 'A';
  else vencedor = hpA / hpMaxA > hpD / hpMaxD ? 'A' : 'D'; // estourou o limite de rounds

  return { vencedor, hpMaxA, hpMaxD, hpFinalA: hpA, hpFinalD: hpD, rounds };
}
