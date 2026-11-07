import path from 'path';

export const config = {
  port: Number(process.env.PORT) || 3000,
  isProd: process.env.NODE_ENV === 'production',
  // Em produção SESSION_SECRET é obrigatório (veja server.ts).
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-troque-este-segredo',
  dbPath: process.env.DB_PATH || path.join(process.cwd(), 'data', 'vampvs.db'),
  viewsDir: path.join(process.cwd(), 'views'),
  publicDir: path.join(process.cwd(), 'public'),
  bcryptRounds: 12,
};
