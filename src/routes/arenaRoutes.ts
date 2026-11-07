import { Router } from 'express';
import * as arena from '../controllers/arenaController';
import { exigirFaccaoApi, exigirLoginApi } from '../middleware/auth';

export const arenaRoutes = Router();
arenaRoutes.use(exigirLoginApi, exigirFaccaoApi);
arenaRoutes.get('/targets', arena.alvos);
arenaRoutes.post('/attack', arena.atacar);
arenaRoutes.get('/history', arena.historico);
