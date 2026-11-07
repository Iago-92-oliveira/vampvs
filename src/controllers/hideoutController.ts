import { Request, Response } from 'express';
import * as hideoutService from '../services/hideoutService';

export function ver(req: Request, res: Response) {
  res.json(hideoutService.montar(req.session.userId!));
}

export function evoluir(req: Request, res: Response) {
  const r = hideoutService.evoluir(req.session.userId!, req.body?.estrutura);
  res.json({
    ok: true,
    mensagem: `${r.nome} evoluiu para o nível ${r.nivelNovo} (${r.custo} de ouro).`,
    esconderijo: hideoutService.montar(req.session.userId!),
  });
}

export function coletar(req: Request, res: Response) {
  const r = hideoutService.coletar(req.session.userId!);
  res.json({
    ok: true,
    mensagem: `Você coletou ${r.coletado} de ouro da mina.`,
    esconderijo: hideoutService.montar(req.session.userId!),
  });
}
