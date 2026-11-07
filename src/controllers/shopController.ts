import { Request, Response } from 'express';
import * as characterService from '../services/characterService';
import * as shopService from '../services/shopService';

export function catalogo(req: Request, res: Response) {
  res.json(shopService.catalogo(req.session.userId!));
}

export function comprar(req: Request, res: Response) {
  const r = shopService.comprar(req.session.userId!, req.body?.itemId);
  res.json({ ok: true, mensagem: `Você comprou ${r.nome} por ${r.preco} de ouro.`, perfil: characterService.montarPerfil(req.session.userId!) });
}
