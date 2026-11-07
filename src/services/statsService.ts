import * as efeitoModel from '../models/efeitoModel';
import * as inventoryModel from '../models/inventoryModel';
import { Personagem } from '../types/game';
import { calcularStats } from './gameRules';

/**
 * ÚNICO ponto que calcula os atributos totais: base + itens equipados + efeitos de poção ativos.
 * Perfil, caça e arena usam esta função, então os bônus valem igual em todo lugar.
 */
export function statsAtuais(p: Personagem, agora = Date.now()) {
  return calcularStats(p, inventoryModel.listarEquipados(p.id), efeitoModel.listarAtivos(p.id, agora));
}
