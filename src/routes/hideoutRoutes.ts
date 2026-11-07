import { Router } from 'express';
import * as hideout from '../controllers/hideoutController';
import { exigirFaccaoApi, exigirLoginApi } from '../middleware/auth';

export const hideoutRoutes = Router();
hideoutRoutes.use(exigirLoginApi, exigirFaccaoApi);
hideoutRoutes.get('/', hideout.ver);
hideoutRoutes.post('/upgrade', hideout.evoluir); // { "estrutura": "mina" }
hideoutRoutes.post('/collect', hideout.coletar);
