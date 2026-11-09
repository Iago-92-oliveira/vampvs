import { Router } from 'express';
import * as avatar from '../controllers/avatarController';
import { exigirFaccaoApi, exigirLoginApi } from '../middleware/auth';

export const avatarRoutes = Router();
avatarRoutes.use(exigirLoginApi, exigirFaccaoApi);
avatarRoutes.get('/', avatar.opcoes);
avatarRoutes.post('/', avatar.escolher); // { "avatarId": "vampire_2" }
