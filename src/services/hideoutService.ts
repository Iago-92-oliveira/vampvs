import { db } from '../db/database';
import { GameError } from '../errors';
import * as characterModel from '../models/characterModel';
import * as hideoutModel from '../models/hideoutModel';
import { ESTRUTURAS, Esconderijo, Estrutura, Personagem } from '../types/game';
import { regenerarPA } from './actionPoints';
import { exigirPersonagemComFaccao } from './battleHelpers';
import {
  calcularAcumulado,
  capacidadeTesouro,
  custoEvolucao,
  descreverBonus,
  nivelMaximoAbsoluto,
  ouroPorHora,
  tetoPelaCripta,
} from './hideoutRules';
import { paParams } from './paService';

const NOMES: Record<Estrutura, string> = {
  cripta: 'Cripta',
  muralha: 'Muralha',
  mina: 'Mina de Ouro',
  tesouro: 'Tesouro',
  altar: 'Altar',
};

const DESCRICOES: Record<Estrutura, string> = {
  cripta: 'O coração da base. Quanto mais profunda, mais as outras estruturas podem crescer.',
  muralha: 'Pedra e sombra contra invasores: você perde menos ouro quando é derrotado na arena.',
  mina: 'Escravos e picaretas produzem ouro enquanto você está longe.',
  tesouro: 'Aumenta quanto ouro a mina consegue guardar antes de parar de produzir.',
  altar: 'Aumenta seus pontos de ação máximos e acelera a recarga deles.',
};

function garantir(p: Personagem, agora: number): Esconderijo {
  let h = hideoutModel.buscar(p.id);
  if (!h) {
    hideoutModel.criar(p.id, agora); // contas muito antigas ou falha no cadastro: cria sob demanda
    h = hideoutModel.buscar(p.id)!;
  }
  return h;
}

/** Ouro atualmente na mina (com fração), usando os níveis ATUAIS de Mina e Tesouro. */
function acumuladoAgora(h: Esconderijo, agora: number): number {
  return calcularAcumulado(
    h.ouro_acumulado,
    h.acumulado_em,
    agora,
    ouroPorHora(h.nivel_mina_ouro),
    capacidadeTesouro(h.nivel_tesouro),
  );
}

/** Grava o ouro produzido até agora. Chamar ANTES de mudar o nível da Mina ou do Tesouro. */
function liquidar(p: Personagem, h: Esconderijo, agora: number): void {
  hideoutModel.gravarAcumulado(p.id, acumuladoAgora(h, agora), agora);
}

export function montar(usuarioId: number) {
  const p = exigirPersonagemComFaccao(usuarioId);
  const agora = Date.now();
  const h = garantir(p, agora);

  const estruturas = ESTRUTURAS.map((e) => {
    const nivel = hideoutModel.nivelDe(h, e);
    const maxAbsoluto = nivelMaximoAbsoluto(e);
    const teto = e === 'cripta' ? maxAbsoluto : Math.min(maxAbsoluto, tetoPelaCripta(h.nivel_cripta));
    const custo = nivel < maxAbsoluto ? custoEvolucao(e, nivel) : null;

    let bloqueio: string | null = null;
    if (nivel >= maxAbsoluto) bloqueio = 'Nível máximo';
    else if (nivel >= teto) bloqueio = 'Evolua a Cripta primeiro';
    else if (custo !== null && p.ouro < custo) bloqueio = `Faltam ${custo - p.ouro} de ouro`;

    return {
      chave: e,
      nome: NOMES[e],
      descricao: DESCRICOES[e],
      nivel,
      nivelMax: maxAbsoluto,
      bonusAtual: descreverBonus(e, nivel),
      bonusProximo: nivel < maxAbsoluto ? descreverBonus(e, nivel + 1) : null,
      custo,
      bloqueio,
    };
  });

  const acumulado = acumuladoAgora(h, agora);
  const capacidade = capacidadeTesouro(h.nivel_tesouro);
  const porHora = ouroPorHora(h.nivel_mina_ouro);
  return {
    ouro: p.ouro,
    estruturas,
    mina: {
      acumulado, // exato (com fração): o front extrapola a contagem; o servidor sempre recalcula na coleta
      acumuladoInteiro: Math.floor(acumulado),
      capacidade,
      porHora,
      cheia: acumulado >= capacidade,
    },
  };
}

function validarEstrutura(valor: unknown): Estrutura {
  if (typeof valor !== 'string' || !ESTRUTURAS.includes(valor as Estrutura)) {
    throw new GameError(400, 'estrutura_invalida', 'Estrutura inválida.');
  }
  return valor as Estrutura;
}

/**
 * Evolução. Custo, nível e saldo vêm do banco; o cliente só diz QUAL estrutura.
 * Tudo numa transação imediata: ou debita e sobe o nível, ou nada muda.
 */
const evoluirTx = db.transaction((usuarioId: number, estruturaBruta: unknown) => {
  const estrutura = validarEstrutura(estruturaBruta);
  const agora = Date.now();
  const p = exigirPersonagemComFaccao(usuarioId);
  const h = garantir(p, agora);

  const nivel = hideoutModel.nivelDe(h, estrutura);
  if (nivel >= nivelMaximoAbsoluto(estrutura)) {
    throw new GameError(400, 'nivel_maximo', `${NOMES[estrutura]} já está no nível máximo.`);
  }
  if (estrutura !== 'cripta' && nivel >= tetoPelaCripta(h.nivel_cripta)) {
    throw new GameError(403, 'cripta_insuficiente', `Evolua a Cripta para liberar o nível ${nivel + 1} de ${NOMES[estrutura]}.`);
  }
  const custo = custoEvolucao(estrutura, nivel);
  if (p.ouro < custo) {
    throw new GameError(400, 'ouro_insuficiente', `Ouro insuficiente: faltam ${custo - p.ouro}.`);
  }

  // Efeitos que dependem do nível ANTIGO são fechados antes da mudança (sem ganho nem perda retroativa).
  if (estrutura === 'mina' || estrutura === 'tesouro') liquidar(p, h, agora);
  if (estrutura === 'altar') {
    const est = regenerarPA(p.pa, p.pa_atualizado_em, agora, paParams(p.id));
    characterModel.gravarPA(p.id, est.pa, est.atualizadoEm);
  }

  if (!characterModel.debitarOuro(p.id, custo)) throw new GameError(400, 'ouro_insuficiente', 'Ouro insuficiente.');
  if (!hideoutModel.subirNivel(p.id, estrutura, nivel)) throw new GameError(409, 'estado_mudou', 'Tente novamente.');
  return { nome: NOMES[estrutura], nivelNovo: nivel + 1, custo };
});

export function evoluir(usuarioId: number, estrutura: unknown) {
  return evoluirTx.immediate(usuarioId, estrutura);
}

/** Coleta: o ouro vem do cálculo do servidor (nunca de um valor enviado pelo cliente). */
const coletarTx = db.transaction((usuarioId: number) => {
  const agora = Date.now();
  const p = exigirPersonagemComFaccao(usuarioId);
  const h = garantir(p, agora);

  const acumulado = acumuladoAgora(h, agora);
  const coletado = Math.floor(acumulado);
  if (coletado < 1) throw new GameError(400, 'nada_a_coletar', 'A mina ainda não produziu ouro suficiente para coletar.');

  characterModel.creditarOuro(p.id, coletado);
  hideoutModel.gravarAcumulado(p.id, acumulado - coletado, agora); // a fração (< 1 ouro) continua guardada
  return { coletado };
});

export function coletar(usuarioId: number) {
  return coletarTx.immediate(usuarioId);
}
