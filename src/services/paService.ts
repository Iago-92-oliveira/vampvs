import * as hideoutModel from '../models/hideoutModel';
import { Personagem } from '../types/game';
import { ParamsPA, statusPA } from './actionPoints';
import { intervaloPAAltar, paMaxAltar } from './hideoutRules';

/** Teto e intervalo de PA do personagem, conforme o nível do Altar do Esconderijo. */
export function paParams(personagemId: number): ParamsPA {
  const nivelAltar = hideoutModel.buscar(personagemId)?.nivel_altar ?? 1;
  return { paMax: paMaxAltar(nivelAltar), intervaloMs: intervaloPAAltar(nivelAltar) };
}

export function statusPAde(p: Personagem, agora: number) {
  return statusPA(p.pa, p.pa_atualizado_em, agora, paParams(p.id));
}
