import { Request, Response } from 'express';
import * as characterService from '../services/characterService';
import * as huntService from '../services/huntService';

export function monstros(req: Request, res: Response) {
  res.json(huntService.listarMonstros(req.session.userId!));
}

export function cacar(req: Request, res: Response) {
  const relatorio = huntService.cacar(req.session.userId!);
  res.json({ relatorio, perfil: characterService.montarPerfil(req.session.userId!) });
}
