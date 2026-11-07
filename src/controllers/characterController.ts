import { Request, Response } from 'express';
import { config } from '../config';
import * as characterModel from '../models/characterModel';
import * as characterService from '../services/characterService';

export function perfil(req: Request, res: Response) {
  res.json(characterService.montarPerfil(req.session.userId!));
}

export function treinar(req: Request, res: Response) {
  characterService.treinar(req.session.userId!, req.body?.atributo);
  res.json(characterService.montarPerfil(req.session.userId!));
}

export function gastarPonto(req: Request, res: Response) {
  characterService.gastarPontoLivre(req.session.userId!, req.body?.atributo);
  res.json(characterService.montarPerfil(req.session.userId!));
}

/** SOMENTE DESENVOLVIMENTO: dá ouro para testar o treino. Não é registrada em produção. */
export function darOuroDev(req: Request, res: Response) {
  if (config.isProd) return res.status(404).end();
  const p = characterModel.findByUsuarioId(req.session.userId!)!;
  characterModel.adicionarOuro(p.id, 500);
  res.json(characterService.montarPerfil(req.session.userId!));
}
