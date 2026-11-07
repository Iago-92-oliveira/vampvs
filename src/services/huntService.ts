import { db } from '../db/database';
import { GameError } from '../errors';
import * as battleModel from '../models/battleModel';
import * as characterModel from '../models/characterModel';
import * as monsterModel from '../models/monsterModel';
import { statusPAde } from './paService';
import { exigirPersonagemComFaccao, gastarPA, lutadorDe } from './battleHelpers';
import { Rng, simular } from './combat';
import { CUSTO_PA_CACA, NIVEL_MAX_MONSTRO_ACIMA } from './gameRules';
import { aplicarXp } from './progression';
import { Monstro } from '../types/game';

/** Monstros do mesmo nível ou abaixo aparecem mais; os mais fortes (até +2 níveis) são raros. */
function sortearMonstro(monstros: Monstro[], nivelJogador: number, rng: Rng): Monstro {
  const pool = monstros.filter((m) => m.nivel <= nivelJogador + NIVEL_MAX_MONSTRO_ACIMA);
  const peso = (m: Monstro) => (m.nivel <= nivelJogador ? 3 : m.nivel === nivelJogador + 1 ? 2 : 1);
  let sorteio = rng() * pool.reduce((s, m) => s + peso(m), 0);
  for (const m of pool) {
    sorteio -= peso(m);
    if (sorteio < 0) return m;
  }
  return pool[pool.length - 1];
}

export function listarMonstros(usuarioId: number) {
  const p = exigirPersonagemComFaccao(usuarioId);
  return {
    custoPA: CUSTO_PA_CACA,
    pa: statusPAde(p, Date.now()),
    monstros: monsterModel.listar().map((m) => ({
      nome: m.nome,
      descricao: m.descricao,
      nivel: m.nivel,
      forca: m.forca,
      defesa: m.defesa,
      agilidade: m.agilidade,
      vitalidade: m.vitalidade,
      xp: m.xp_recompensa,
      ouroMin: m.ouro_min,
      ouroMax: m.ouro_max,
      disponivel: m.nivel <= p.nivel + NIVEL_MAX_MONSTRO_ACIMA,
    })),
  };
}

const cacarTx = db.transaction((usuarioId: number) => {
  const rng: Rng = Math.random;
  const agora = Date.now();
  const p = exigirPersonagemComFaccao(usuarioId);

  gastarPA(p, CUSTO_PA_CACA, agora); // lança erro se PA = 0: nada mais acontece

  const monstro = sortearMonstro(monsterModel.listar(), p.nivel, rng);
  const jogador = lutadorDe(p);
  const alvo = {
    nome: monstro.nome,
    forca: monstro.forca,
    defesa: monstro.defesa,
    agilidade: monstro.agilidade,
    vitalidade: monstro.vitalidade,
  };
  const combate = simular(jogador, alvo, rng);
  const vitoria = combate.vencedor === 'A';

  let xp = 0;
  let ouro = 0;
  let nivel = p.nivel;
  let pontosGanhos = 0;
  let niveisGanhos = 0;
  if (vitoria) {
    xp = monstro.xp_recompensa;
    ouro = monstro.ouro_min + Math.floor(rng() * (monstro.ouro_max - monstro.ouro_min + 1));
    const prog = aplicarXp(p.nivel, p.xp, xp);
    nivel = prog.nivel;
    pontosGanhos = prog.pontosGanhos;
    niveisGanhos = prog.niveisGanhos;
    characterModel.aplicarResultado(p.id, {
      nivel: prog.nivel, xp: prog.xp, pontosGanhos, deltaOuro: ouro, deltaHonra: 0,
    });
  }
  // Derrota: o jogador perde apenas o PA já debitado (sem penalidade de vida/ouro nesta versão).

  battleModel.registrar({
    tipo: 'pve',
    atacanteId: p.id,
    defensorId: null,
    monstroNome: monstro.nome,
    monstroNivel: monstro.nivel,
    vencedor: vitoria ? 'atacante' : 'defensor',
    xpGanho: xp,
    ouroGanho: ouro,
    honraGanha: 0,
    honraPerdida: 0,
    criadoEm: agora,
  });

  return {
    vitoria,
    jogador: { nome: p.nome, hpMax: combate.hpMaxA, hpFinal: combate.hpFinalA },
    monstro: {
      nome: monstro.nome,
      nivel: monstro.nivel,
      descricao: monstro.descricao,
      hpMax: combate.hpMaxD,
      hpFinal: combate.hpFinalD,
    },
    rounds: combate.rounds,
    xp,
    ouro,
    niveisGanhos,
    nivelNovo: nivel,
    pontosGanhos,
  };
});

/** `immediate` abre a transação já com bloqueio de escrita: ninguém gasta o mesmo PA em paralelo. */
export function cacar(usuarioId: number) {
  if (!Number.isInteger(usuarioId)) throw new GameError(401, 'nao_autenticado', 'Sessão inválida.');
  return cacarTx.immediate(usuarioId);
}
