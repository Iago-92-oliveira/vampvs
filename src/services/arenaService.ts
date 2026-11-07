import { db } from '../db/database';
import { GameError } from '../errors';
import * as battleModel from '../models/battleModel';
import * as characterModel from '../models/characterModel';
import * as hideoutModel from '../models/hideoutModel';
import { statusPAde } from './paService';
import { exigirPersonagemComFaccao, gastarPA, lutadorDe } from './battleHelpers';
import { simular } from './combat';
import {
  COOLDOWN_MESMO_ALVO_MS,
  CUSTO_PA_ATAQUE,
  HONRA_DERROTA,
  HONRA_VITORIA,
  PERCENTUAL_ROUBO_OURO,
  TETO_ROUBO_OURO,
  XP_PVP_BASE,
  XP_PVP_POR_NIVEL_DO_OPONENTE,
} from './gameRules';
import { reducaoMuralha } from './hideoutRules';
import { aplicarXp } from './progression';
import { Faccao } from '../types/game';

const oposta = (f: Faccao): Faccao => (f === 'vampiro' ? 'lobisomem' : 'vampiro');

/** Alvos = SOMENTE jogadores da facção oposta (nunca você mesmo nem sua facção). */
export function listarAlvos(usuarioId: number) {
  const p = exigirPersonagemComFaccao(usuarioId);
  const agora = Date.now();
  const ultimos = battleModel.ultimosAtaquesPvp(p.id);

  return {
    custoPA: CUSTO_PA_ATAQUE,
    cooldownMinutos: COOLDOWN_MESMO_ALVO_MS / 60000,
    pa: statusPAde(p, agora),
    alvos: characterModel.listarAlvos(oposta(p.faccao!), p.id, 30).map((a) => ({
      id: a.id,
      nome: a.nome,
      faccao: a.faccao,
      nivel: a.nivel,
      honra: a.honra,
      cooldownSegundos: Math.max(0, Math.ceil(((ultimos.get(a.id) ?? 0) + COOLDOWN_MESMO_ALVO_MS - agora) / 1000)),
    })),
    ranking: characterModel.ranking(10).map((r, i) => ({
      posicao: i + 1,
      nome: r.nome,
      faccao: r.faccao,
      nivel: r.nivel,
      honra: r.honra,
      voce: r.id === p.id,
    })),
  };
}

const atacarTx = db.transaction((usuarioId: number, alvoIdBruto: unknown) => {
  const agora = Date.now();

  // 1) Validação da entrada
  const alvoId = typeof alvoIdBruto === 'number' ? alvoIdBruto : Number(alvoIdBruto);
  if (!Number.isInteger(alvoId) || alvoId <= 0) throw new GameError(400, 'alvo_invalido', 'Alvo inválido.');

  // 2) Regras de quem pode atacar quem (tudo lido do banco, nada confiado ao cliente)
  const atacante = exigirPersonagemComFaccao(usuarioId);
  const defensor = characterModel.findById(alvoId);
  if (!defensor) throw new GameError(404, 'alvo_inexistente', 'Jogador não encontrado.');
  if (defensor.id === atacante.id) throw new GameError(400, 'auto_ataque', 'Você não pode atacar a si mesmo.');
  if (!defensor.faccao) throw new GameError(400, 'alvo_invalido', 'Este jogador ainda não escolheu uma facção.');
  if (defensor.faccao === atacante.faccao) {
    throw new GameError(403, 'mesma_faccao', 'Você não pode atacar membros da sua própria facção.');
  }

  // 3) Cooldown por alvo (anti-farm)
  const ultimo = battleModel.ultimosAtaquesPvp(atacante.id).get(defensor.id) ?? 0;
  const restanteMs = ultimo + COOLDOWN_MESMO_ALVO_MS - agora;
  if (restanteMs > 0) {
    throw new GameError(
      429,
      'cooldown_alvo',
      `Você atacou ${defensor.nome} há pouco. Aguarde ${Math.ceil(restanteMs / 60000)} min para atacar de novo.`,
    );
  }

  // 4) Custo em PA (lança erro se insuficiente)
  gastarPA(atacante, CUSTO_PA_ATAQUE, agora);

  // 5) Combate com atributos totais de ambos
  const combate = simular(lutadorDe(atacante), lutadorDe(defensor));
  const atacanteVenceu = combate.vencedor === 'A';
  const vencedor = atacanteVenceu ? atacante : defensor;
  const perdedor = atacanteVenceu ? defensor : atacante;

  // 6) Consequências (valores do banco, na mesma transação)
  // A Muralha do PERDEDOR reduz o ouro que ele perde (e, portanto, o que o vencedor leva).
  const ouroBase = Math.min(Math.floor(perdedor.ouro * PERCENTUAL_ROUBO_OURO), TETO_ROUBO_OURO);
  const reducao = reducaoMuralha(hideoutModel.buscar(perdedor.id)?.nivel_muralha ?? 1);
  const ouroRoubado = Math.floor(ouroBase * (1 - reducao));
  const xp = XP_PVP_BASE + perdedor.nivel * XP_PVP_POR_NIVEL_DO_OPONENTE;
  const honraPerdida = Math.min(HONRA_DERROTA, perdedor.honra);
  const prog = aplicarXp(vencedor.nivel, vencedor.xp, xp);

  characterModel.aplicarResultado(vencedor.id, {
    nivel: prog.nivel, xp: prog.xp, pontosGanhos: prog.pontosGanhos,
    deltaOuro: ouroRoubado, deltaHonra: HONRA_VITORIA,
  });
  characterModel.aplicarResultado(perdedor.id, {
    nivel: perdedor.nivel, xp: perdedor.xp, pontosGanhos: 0,
    deltaOuro: -ouroRoubado, deltaHonra: -honraPerdida,
  });

  battleModel.registrar({
    tipo: 'pvp',
    atacanteId: atacante.id,
    defensorId: defensor.id,
    monstroNome: null,
    monstroNivel: null,
    vencedor: atacanteVenceu ? 'atacante' : 'defensor',
    xpGanho: xp,
    ouroGanho: ouroRoubado,
    honraGanha: HONRA_VITORIA,
    honraPerdida,
    criadoEm: agora,
  });

  // 7) Relatório do ponto de vista de quem atacou
  return {
    venceu: atacanteVenceu,
    atacante: { nome: atacante.nome, hpMax: combate.hpMaxA, hpFinal: combate.hpFinalA },
    defensor: {
      nome: defensor.nome,
      faccao: defensor.faccao,
      nivel: defensor.nivel,
      hpMax: combate.hpMaxD,
      hpFinal: combate.hpFinalD,
    },
    rounds: combate.rounds,
    xp: atacanteVenceu ? xp : 0,
    ouro: atacanteVenceu ? ouroRoubado : -ouroRoubado,
    honra: atacanteVenceu ? HONRA_VITORIA : -honraPerdida,
    niveisGanhos: atacanteVenceu ? prog.niveisGanhos : 0,
    nivelNovo: atacanteVenceu ? prog.nivel : atacante.nivel,
    muralha: { de: perdedor.nome, reducaoPercentual: Math.round(reducao * 100), ouroEvitado: ouroBase - ouroRoubado },
  };
});

export function atacar(usuarioId: number, alvoId: unknown) {
  return atacarTx.immediate(usuarioId, alvoId);
}
