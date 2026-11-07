import { Router } from 'express';
import * as character from '../controllers/characterController';
import { config } from '../config';
import { exigirFaccaoApi, exigirLoginApi } from '../middleware/auth';

export const characterRoutes = Router();
characterRoutes.use(exigirLoginApi, exigirFaccaoApi);
characterRoutes.get('/', character.perfil);
characterRoutes.post('/train', character.treinar);
characterRoutes.post('/spend-point', character.gastarPonto);
if (!config.isProd) characterRoutes.post('/dev/gold', character.darOuroDev);
