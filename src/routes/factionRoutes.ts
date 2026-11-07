import { Router } from 'express';
import * as faction from '../controllers/factionController';
import { exigirLoginApi } from '../middleware/auth';

export const factionRoutes = Router();
factionRoutes.use(exigirLoginApi);
factionRoutes.get('/options', faction.opcoes);
factionRoutes.post('/choose', faction.escolher);
