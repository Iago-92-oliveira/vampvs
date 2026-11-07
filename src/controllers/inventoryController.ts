import { Request, Response } from 'express';
import * as characterService from '../services/characterService';
import * as inventoryService from '../services/inventoryService';

export function listar(req: Request, res: Response) {
  res.json(inventoryService.listar(req.session.userId!));
}

export function equipar(req: Request, res: Response) {
  inventoryService.equipar(req.session.userId!, req.params.id);
  res.json({ ok: true, perfil: characterService.montarPerfil(req.session.userId!) });
}

export function desequipar(req: Request, res: Response) {
  inventoryService.desequipar(req.session.userId!, req.params.id);
  res.json({ ok: true, perfil: characterService.montarPerfil(req.session.userId!) });
}

export function usar(req: Request, res: Response) {
  const r = inventoryService.usar(req.session.userId!, req.params.id);
  res.json({ ok: true, mensagem: r.mensagem, perfil: characterService.montarPerfil(req.session.userId!) });
}

export function vender(req: Request, res: Response) {
  const r = inventoryService.vender(req.session.userId!, req.params.id);
  res.json({ ok: true, mensagem: `Você vendeu ${r.nome} por ${r.valor} de ouro.`, perfil: characterService.montarPerfil(req.session.userId!) });
}
