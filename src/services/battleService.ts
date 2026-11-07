import * as battleModel from '../models/battleModel';
import { exigirPersonagemComFaccao } from './battleHelpers';

/** Histórico do ponto de vista do jogador (ataques feitos e recebidos, caças incluídas). */
export function recentes(usuarioId: number, limite = 10) {
  const p = exigirPersonagemComFaccao(usuarioId);
  return battleModel.recentes(p.id, limite).map((b) => {
    const euAtaquei = b.atacante_id === p.id;
    const venceu = euAtaquei ? b.vencedor === 'atacante' : b.vencedor === 'defensor';
    return {
      tipo: b.tipo,
      papel: euAtaquei ? 'atacante' : 'defensor',
      oponente: b.tipo === 'pve' ? `${b.monstro_nome} (nível ${b.monstro_nivel})` : euAtaquei ? b.defensor_nome : b.atacante_nome,
      venceu,
      xp: venceu ? b.xp_ganho : 0,
      // PvE: só há ouro em vitória. PvP: o perdedor perde o que o vencedor levou.
      ouro: venceu ? b.ouro_ganho : b.tipo === 'pvp' ? -b.ouro_ganho : 0,
      honra: venceu ? b.honra_ganha : -b.honra_perdida,
      quando: b.criado_em,
    };
  });
}
