import { config } from '../config';
import { db } from '../db/database';
import { GameError } from '../errors';
import * as characterModel from '../models/characterModel';
import * as efeitoModel from '../models/efeitoModel';
import * as inventoryModel from '../models/inventoryModel';
import * as itemModel from '../models/itemModel';
import { ATRIBUTOS, AtributoNome, FACCOES, Faccao, Personagem } from '../types/game';
import { statusPAde } from './paService';
import { statsAtuais } from './statsService';
import {
  BONUS_FACCAO,
  ITENS_INICIAIS_POR_FACCAO,
  custoTreino,
  xpParaProximoNivel,
} from './gameRules';

function carregar(usuarioId: number): Personagem {
  const p = characterModel.findByUsuarioId(usuarioId);
  if (!p) throw new GameError(404, 'personagem_inexistente', 'Personagem não encontrado.');
  return p;
}

/** Monta o JSON que a tela de perfil consome. */
export function montarPerfil(usuarioId: number) {
  const p = carregar(usuarioId);
  const agora = Date.now();
  const stats = statsAtuais(p, agora);
  return {
    modoDev: !config.isProd,
    personagem: {
      nome: p.nome,
      faccao: p.faccao,
      nivel: p.nivel,
      xp: p.xp,
      xpProximoNivel: xpParaProximoNivel(p.nivel),
      ouro: p.ouro,
      honra: p.honra,
      pontosLivres: p.pontos_livres,
      ...statusPAde(p, agora),
    },
    efeitos: efeitoModel.listarAtivos(p.id, agora).map((e) => ({
      nome: e.nome,
      segundosRestantes: Math.ceil((e.expira_em - agora) / 1000),
      bonus: { forca: e.bonus_forca, defesa: e.bonus_defesa, agilidade: e.bonus_agilidade, vitalidade: e.bonus_vitalidade },
    })),
    ...stats,
  };
}

export const escolherFaccao = db.transaction((usuarioId: number, faccao: unknown) => {
  if (typeof faccao !== 'string' || !FACCOES.includes(faccao as Faccao)) {
    throw new GameError(400, 'faccao_invalida', 'Facção inválida.');
  }
  const f = faccao as Faccao;
  const p = carregar(usuarioId);

  if (!characterModel.definirFaccao(p.id, f, BONUS_FACCAO[f])) {
    throw new GameError(409, 'faccao_ja_escolhida', 'Sua facção já foi escolhida e não pode ser alterada.');
  }
  for (const nome of ITENS_INICIAIS_POR_FACCAO[f]) {
    const item = itemModel.findByNome(nome);
    if (item) inventoryModel.adicionar(p.id, item.id);
  }
});

export function treinar(usuarioId: number, atributo: unknown): void {
  if (typeof atributo !== 'string' || !ATRIBUTOS.includes(atributo as AtributoNome)) {
    throw new GameError(400, 'atributo_invalido', 'Atributo inválido.');
  }
  const attr = atributo as AtributoNome;
  const p = carregar(usuarioId);
  if (!p.faccao) throw new GameError(403, 'faccao_pendente', 'Escolha sua facção primeiro.');

  const custo = custoTreino(p[attr]);
  if (p.ouro < custo) {
    throw new GameError(400, 'ouro_insuficiente', `Ouro insuficiente: você precisa de ${custo}.`);
  }
  if (!characterModel.aplicarTreino(p.id, attr, p[attr], custo)) {
    throw new GameError(409, 'estado_mudou', 'Seu personagem mudou durante o treino. Tente novamente.');
  }
}

/** Gasta 1 ponto livre (ganho ao subir de nível) num atributo. Sem custo em ouro. */
export function gastarPontoLivre(usuarioId: number, atributo: unknown): void {
  if (typeof atributo !== 'string' || !ATRIBUTOS.includes(atributo as AtributoNome)) {
    throw new GameError(400, 'atributo_invalido', 'Atributo inválido.');
  }
  const p = carregar(usuarioId);
  if (!p.faccao) throw new GameError(403, 'faccao_pendente', 'Escolha sua facção primeiro.');
  if (!characterModel.usarPontoLivre(p.id, atributo as AtributoNome)) {
    throw new GameError(400, 'sem_pontos', 'Você não tem pontos livres.');
  }
}
