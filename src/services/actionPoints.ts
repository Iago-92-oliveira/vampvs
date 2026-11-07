import { PA_INTERVALO_MS, PA_MAX } from './gameRules';

export interface EstadoPA {
  pa: number;
  atualizadoEm: number; // início do "tick" em andamento (ou "agora" se estiver cheio)
}

/** Teto e intervalo de regeneração. Os valores base valem para Altar nível 1; o Altar os melhora. */
export interface ParamsPA {
  paMax: number;
  intervaloMs: number;
}
export const PARAMS_PA_BASE: ParamsPA = { paMax: PA_MAX, intervaloMs: PA_INTERVALO_MS };

/**
 * Regeneração preguiçosa: não existe timer rodando. Ao precisar do PA, calculamos
 * quantos ticks se passaram desde o último registro. Função pura.
 */
export function regenerarPA(
  pa: number,
  atualizadoEm: number,
  agora: number,
  params: ParamsPA = PARAMS_PA_BASE,
): EstadoPA {
  if (pa >= params.paMax) return { pa: params.paMax, atualizadoEm: agora };
  const ticks = Math.max(0, Math.floor((agora - atualizadoEm) / params.intervaloMs));
  const novoPa = Math.min(params.paMax, pa + ticks);
  if (novoPa >= params.paMax) return { pa: params.paMax, atualizadoEm: agora };
  return { pa: novoPa, atualizadoEm: atualizadoEm + ticks * params.intervaloMs };
}

/** Dados de PA para exibição (somente leitura, não grava nada). */
export function statusPA(pa: number, atualizadoEm: number, agora: number, params: ParamsPA = PARAMS_PA_BASE) {
  const e = regenerarPA(pa, atualizadoEm, agora, params);
  const segundosProximoPA =
    e.pa >= params.paMax ? 0 : Math.max(0, Math.ceil((e.atualizadoEm + params.intervaloMs - agora) / 1000));
  return { pa: e.pa, paMax: params.paMax, segundosProximoPA };
}
