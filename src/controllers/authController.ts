import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { config } from '../config';
import { db } from '../db/database';
import { GameError } from '../errors';
import * as characterModel from '../models/characterModel';
import * as hideoutModel from '../models/hideoutModel';
import * as userModel from '../models/userModel';
import { destinoInicial } from '../services/flow';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const NOME_RE = /^[\p{L}0-9_ ]{3,24}$/u;

// Hash falso para comparar quando o usuário não existe (evita revelar usuários pelo tempo de resposta).
const HASH_FALSO = bcrypt.hashSync('senha-falsa-para-timing', config.bcryptRounds);

function iniciarSessao(req: Request, userId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId; // novo ID de sessão a cada login (evita session fixation)
      resolve();
    });
  });
}

function destinoPosLogin(userId: number): string {
  return destinoInicial(userId);
}

export async function registrar(req: Request, res: Response) {
  const { username, password, nomePersonagem } = req.body ?? {};

  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    throw new GameError(400, 'usuario_invalido', 'Usuário: 3 a 20 caracteres (letras, números e _).');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    throw new GameError(400, 'senha_invalida', 'A senha deve ter entre 8 e 72 caracteres.');
  }
  const nome = typeof nomePersonagem === 'string' && nomePersonagem.trim() ? nomePersonagem.trim() : username;
  if (!NOME_RE.test(nome)) {
    throw new GameError(400, 'nome_invalido', 'Nome do personagem: 3 a 24 caracteres (letras, números, _ e espaço).');
  }

  const hash = await bcrypt.hash(password, config.bcryptRounds);

  let userId: number;
  try {
    userId = db.transaction(() => {
      const id = userModel.create(username, hash);
      const personagemId = characterModel.create(id, nome);
      hideoutModel.criar(personagemId, Date.now()); // todo jogador nasce com um Esconderijo
      return id;
    })();
  } catch (err: any) {
    // UNIQUE de username/nome estoura aqui mesmo em corrida entre duas requisições.
    if (String(err?.code).startsWith('SQLITE_CONSTRAINT')) {
      throw new GameError(409, 'ja_existe', 'Usuário ou nome de personagem já está em uso.');
    }
    throw err;
  }

  await iniciarSessao(req, userId);
  res.status(201).json({ ok: true, redirect: '/faction' });
}

export async function login(req: Request, res: Response) {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new GameError(400, 'dados_invalidos', 'Informe usuário e senha.');
  }

  const user = userModel.findByUsername(username);
  const ok = await bcrypt.compare(password, user?.password_hash ?? HASH_FALSO);
  if (!user || !ok) throw new GameError(401, 'credenciais_invalidas', 'Usuário ou senha incorretos.');

  await iniciarSessao(req, user.id);
  res.json({ ok: true, redirect: destinoPosLogin(user.id) });
}

export function logout(req: Request, res: Response) {
  req.session.destroy(() => {
    res.clearCookie('vampvs.sid');
    res.json({ ok: true, redirect: '/login' });
  });
}
