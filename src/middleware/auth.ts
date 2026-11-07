import { NextFunction, Request, Response } from 'express';
import { GameError } from '../errors';
import * as characterModel from '../models/characterModel';

/** API: exige sessão válida (senão 401 JSON). */
export function exigirLoginApi(req: Request, _res: Response, next: NextFunction) {
  if (!req.session.userId) throw new GameError(401, 'nao_autenticado', 'Faça login para continuar.');
  next();
}

/** API: exige que o jogador já tenha escolhido facção. */
export function exigirFaccaoApi(req: Request, _res: Response, next: NextFunction) {
  const p = characterModel.findByUsuarioId(req.session.userId!);
  if (!p) throw new GameError(401, 'nao_autenticado', 'Sessão inválida.');
  if (!p.faccao) throw new GameError(403, 'faccao_pendente', 'Escolha sua facção primeiro.');
  next();
}

/** Páginas HTML: redireciona para /login quando não há sessão. */
export function exigirLoginPagina(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}
