import { Request, Response } from 'express';
import * as avatarService from '../services/avatarService';

export function opcoes(req: Request, res: Response) {
  res.json(avatarService.opcoes(req.session.userId!));
}

export function escolher(req: Request, res: Response) {
  const avatar = avatarService.escolher(req.session.userId!, req.body?.avatarId);
  res.json({ ok: true, mensagem: `Avatar "${avatar.nome}" salvo.`, redirect: '/profile' });
}
