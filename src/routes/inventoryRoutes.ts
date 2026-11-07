import { Router } from 'express';
import * as inventory from '../controllers/inventoryController';
import { exigirFaccaoApi, exigirLoginApi } from '../middleware/auth';

export const inventoryRoutes = Router();
inventoryRoutes.use(exigirLoginApi, exigirFaccaoApi);
inventoryRoutes.get('/', inventory.listar);
inventoryRoutes.post('/:id/equip', inventory.equipar);
inventoryRoutes.post('/:id/unequip', inventory.desequipar);
inventoryRoutes.post('/:id/use', inventory.usar);
inventoryRoutes.post('/:id/sell', inventory.vender);
