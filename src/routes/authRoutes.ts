import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import * as auth from '../controllers/authController';

// Express 4 não captura rejeições de handlers async, então encaminhamos para o errorHandler.
const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void> | void): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

export const authRoutes = Router();
authRoutes.post('/register', asyncHandler(auth.registrar));
authRoutes.post('/login', asyncHandler(auth.login));
authRoutes.post('/logout', auth.logout);
