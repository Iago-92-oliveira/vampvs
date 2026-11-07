import { Router } from 'express';
import * as shop from '../controllers/shopController';
import { exigirFaccaoApi, exigirLoginApi } from '../middleware/auth';

export const shopRoutes = Router();
shopRoutes.use(exigirLoginApi, exigirFaccaoApi);
shopRoutes.get('/', shop.catalogo);
shopRoutes.post('/buy', shop.comprar);
