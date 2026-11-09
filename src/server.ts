import express, { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import { config } from './config';
import { initDatabase } from './db/database';
import { criarUsuariosDeTeste } from './db/seedDev';
import { GameError } from './errors';
import { arenaRoutes } from './routes/arenaRoutes';
import { authRoutes } from './routes/authRoutes';
import { avatarRoutes } from './routes/avatarRoutes';
import { characterRoutes } from './routes/characterRoutes';
import { factionRoutes } from './routes/factionRoutes';
import { hideoutRoutes } from './routes/hideoutRoutes';
import { huntRoutes } from './routes/huntRoutes';
import { inventoryRoutes } from './routes/inventoryRoutes';
import { pageRoutes } from './routes/pageRoutes';
import { shopRoutes } from './routes/shopRoutes';

if (config.isProd && !process.env.SESSION_SECRET) {
  throw new Error('Defina SESSION_SECRET em produção.');
}

initDatabase();
criarUsuariosDeTeste(); // só em desenvolvimento; veja src/db/seedDev.ts

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

// Sessão em memória: suficiente para o protótipo (reiniciar o servidor desloga todo mundo).
app.use(
  session({
    name: 'vampvs.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax', // bloqueia POSTs cross-site (proteção básica contra CSRF)
      secure: config.isProd,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

// Cabeçalhos de segurança mínimos.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});

// Mutações da API só aceitam JSON (reforça a proteção contra CSRF via formulário).
app.use('/api', (req, _res, next) => {
  if (req.method !== 'GET' && !req.is('application/json')) {
    throw new GameError(415, 'content_type', 'Use Content-Type: application/json.');
  }
  next();
});

app.use('/static', express.static(config.publicDir));
app.use('/api/auth', authRoutes);
app.use('/api/faction', factionRoutes);
app.use('/api/avatar', avatarRoutes);
app.use('/api/character', characterRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/hideout', hideoutRoutes);
app.use('/api/hunt', huntRoutes);
app.use('/api/arena', arenaRoutes);
app.use(pageRoutes);

app.use('/api', (_req, res) => res.status(404).json({ erro: 'nao_encontrado', mensagem: 'Rota inexistente.' }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof GameError) {
    return res.status(err.status).json({ erro: err.codigo, mensagem: err.message });
  }
  // Erro do trigger do banco (defesa em profundidade para slot duplicado).
  if (err instanceof Error && err.message.includes('slot_ocupado')) {
    return res.status(409).json({ erro: 'slot_ocupado', mensagem: 'Já existe um item equipado neste slot.' });
  }
  if (err instanceof Error && err.message.includes('pocao_nao_equipa')) {
    return res.status(400).json({ erro: 'nao_equipavel', mensagem: 'Poções não podem ser equipadas.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'erro_interno', mensagem: 'Algo deu errado no servidor.' });
});

app.listen(config.port, () => {
  console.log(`VampVS rodando em http://localhost:${config.port}`);
});
