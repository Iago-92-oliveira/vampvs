import { Request, Response } from 'express';
import * as characterService from '../services/characterService';
import { BONUS_FACCAO, INFO_FACCAO, ROTULOS } from '../services/gameRules';
import { AtributoNome, FACCOES } from '../types/game';

export function opcoes(_req: Request, res: Response) {
  res.json({
    faccoes: FACCOES.map((chave) => ({
      chave,
      ...INFO_FACCAO[chave],
      bonus: Object.entries(BONUS_FACCAO[chave]).map(([attr, valor]) => ({
        atributo: ROTULOS[attr as AtributoNome],
        valor,
      })),
    })),
  });
}

export function escolher(req: Request, res: Response) {
  characterService.escolherFaccao(req.session.userId!, req.body?.faccao);
  res.json({ ok: true, redirect: '/avatar' }); // primeiro acesso: escolher o avatar
}
