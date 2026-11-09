import { Router } from 'express';
import path from 'path';
import { config } from '../config';
import { exigirLoginPagina } from '../middleware/auth';
import * as characterModel from '../models/characterModel';
import { destinoInicial } from '../services/flow';

export const pageRoutes = Router();
const view = (nome: string) => path.join(config.viewsDir, nome);

pageRoutes.get('/', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.redirect(destinoInicial(req.session.userId));
});

pageRoutes.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.sendFile(view('login.html'));
});

// Tela de facção: só aparece se o jogador ainda não escolheu.
pageRoutes.get('/faction', exigirLoginPagina, (req, res) => {
  const p = characterModel.findByUsuarioId(req.session.userId!);
  if (p?.faccao) return res.redirect('/profile');
  res.sendFile(view('faction.html'));
});

// Escolha de avatar: exige login e facção (os avatares dependem dela).
pageRoutes.get('/avatar', exigirLoginPagina, (req, res) => {
  const p = characterModel.findByUsuarioId(req.session.userId!);
  if (!p?.faccao) return res.redirect('/faction');
  res.sendFile(view('avatar.html'));
});

// Páginas do jogo: exigem login e facção escolhida.
for (const pagina of ['profile', 'village', 'hideout', 'hunt', 'arena']) {
  pageRoutes.get(`/${pagina}`, exigirLoginPagina, (req, res) => {
    const p = characterModel.findByUsuarioId(req.session.userId!);
    if (!p?.faccao) return res.redirect('/faction');
    res.sendFile(view(`${pagina}.html`));
  });
}
