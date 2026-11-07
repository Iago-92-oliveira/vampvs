import { Request, Response } from 'express';
import * as arenaService from '../services/arenaService';
import * as battleService from '../services/battleService';
import * as characterService from '../services/characterService';

export function alvos(req: Request, res: Response) {
  res.json(arenaService.listarAlvos(req.session.userId!));
}

export function atacar(req: Request, res: Response) {
  const relatorio = arenaService.atacar(req.session.userId!, req.body?.alvoId);
  res.json({ relatorio, perfil: characterService.montarPerfil(req.session.userId!) });
}

export function historico(req: Request, res: Response) {
  res.json({ batalhas: battleService.recentes(req.session.userId!, 10) });
}
