import { Router } from 'express';
import * as hunt from '../controllers/huntController';
import { exigirFaccaoApi, exigirLoginApi } from '../middleware/auth';

export const huntRoutes = Router();
huntRoutes.use(exigirLoginApi, exigirFaccaoApi);
huntRoutes.get('/monsters', hunt.monstros);
huntRoutes.post('/', hunt.cacar);
