import type { Estrutura } from '../types/game';
import { PA_INTERVALO_MS, PA_MAX } from './gameRules';

/**
 * Regras do Esconderijo (funções puras, sem banco). Todas as estruturas começam no nível 1.
 *
 *  Cripta  : "nível geral" da base. Libera as outras estruturas: nível máximo delas = 2 × nível da Cripta (até 10).
 *  Mina    : produz 10 ouro/hora por nível.
 *  Tesouro : capacidade da mina = 100 + 200 × nível. Cheio, a mina estagna (a produção excedente se perde).
 *  Muralha : reduz 5% por nível (máx. 50%) o ouro perdido ao perder um combate PvP.
 *  Altar   : +5 PA de máximo por nível acima do 1º e recarga 5% mais rápida por nível acima do 1º.
 *  Custo   : base da estrutura × nível atual (Cripta 200, Altar 150, demais 100).
 */
export const NIVEL_MAX_CRIPTA = 5;
export const NIVEL_MAX_ESTRUTURA = 10;
export const CUSTO_BASE: Record<Estrutura, number> = { cripta: 200, muralha: 100, mina: 100, tesouro: 100, altar: 150 };

export const OURO_POR_HORA_POR_NIVEL = 10;
export const TESOURO_BASE = 100;
export const TESOURO_POR_NIVEL = 200;
export const MURALHA_REDUCAO_POR_NIVEL = 0.05;
export const MURALHA_REDUCAO_MAX = 0.5;
export const ALTAR_PA_POR_NIVEL = 5;
export const ALTAR_RECARGA_REDUCAO_POR_NIVEL = 0.05;

export const nivelMaximoAbsoluto = (e: Estrutura): number => (e === 'cripta' ? NIVEL_MAX_CRIPTA : NIVEL_MAX_ESTRUTURA);
export const tetoPelaCripta = (nivelCripta: number): number => Math.min(NIVEL_MAX_ESTRUTURA, nivelCripta * 2);
export const custoEvolucao = (e: Estrutura, nivelAtual: number): number => CUSTO_BASE[e] * nivelAtual;

export const ouroPorHora = (nivelMina: number): number => nivelMina * OURO_POR_HORA_POR_NIVEL;
export const capacidadeTesouro = (nivelTesouro: number): number => TESOURO_BASE + nivelTesouro * TESOURO_POR_NIVEL;
export const reducaoMuralha = (nivelMuralha: number): number =>
  Math.min(MURALHA_REDUCAO_MAX, nivelMuralha * MURALHA_REDUCAO_POR_NIVEL);
export const paMaxAltar = (nivelAltar: number): number => PA_MAX + (nivelAltar - 1) * ALTAR_PA_POR_NIVEL;
export const intervaloPAAltar = (nivelAltar: number): number =>
  Math.round(PA_INTERVALO_MS * (1 - (nivelAltar - 1) * ALTAR_RECARGA_REDUCAO_POR_NIVEL));

/** Ouro na mina agora = salvo + produção desde `em`, limitado pela capacidade (estagna ao encher). */
export function calcularAcumulado(salvo: number, em: number, agora: number, porHora: number, capacidade: number): number {
  const horas = Math.max(0, agora - em) / 3_600_000;
  return Math.min(capacidade, salvo + horas * porHora);
}

const fmtMin = (ms: number) => String(Math.round(ms / 6000) / 10).replace('.', ',');

/** Texto do bônus de uma estrutura num dado nível (usado para "bônus atual" e "próximo nível"). */
export function descreverBonus(e: Estrutura, nivel: number): string {
  switch (e) {
    case 'cripta':
      return `Libera as outras estruturas até o nível ${tetoPelaCripta(nivel)}`;
    case 'muralha':
      return `Reduz em ${Math.round(reducaoMuralha(nivel) * 100)}% o ouro perdido ao perder na arena`;
    case 'mina':
      return `Produz ${ouroPorHora(nivel)} de ouro por hora`;
    case 'tesouro':
      return `A mina guarda até ${capacidadeTesouro(nivel)} de ouro`;
    case 'altar':
      return `Máximo de ${paMaxAltar(nivel)} PA, +1 PA a cada ${fmtMin(intervaloPAAltar(nivel))} min`;
  }
}
