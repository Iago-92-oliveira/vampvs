import bcrypt from 'bcryptjs';
import { config } from '../config';
import * as characterModel from '../models/characterModel';
import * as hideoutModel from '../models/hideoutModel';
import * as userModel from '../models/userModel';
import * as characterService from '../services/characterService';
import { Faccao } from '../types/game';
import { db } from './database';

/**
 * Contas de teste (SOMENTE FORA DE PRODUÇÃO), criadas ao iniciar o servidor se ainda não existirem:
 *   teste1..teste3 = vampiros  | teste4..teste6 = lobisomens
 *   personagem1..personagem6   | senha: 123456789
 *
 * É idempotente: quem já existe é ignorado (o progresso não é resetado).
 * Para desligar, inicie com SEED_TESTE=0.
 */
const SENHA_TESTE = '123456789';
const QUANTIDADE = 6;

export function criarUsuariosDeTeste(): void {
  if (config.isProd || process.env.SEED_TESTE === '0') return;

  const faltando = [];
  for (let i = 1; i <= QUANTIDADE; i++) {
    if (!userModel.findByUsername(`teste${i}`)) faltando.push(i);
  }
  if (faltando.length === 0) return;

  const hash = bcrypt.hashSync(SENHA_TESTE, config.bcryptRounds); // mesmo hash para as seis contas
  const criados: string[] = [];

  for (const i of faltando) {
    const faccao: Faccao = i <= QUANTIDADE / 2 ? 'vampiro' : 'lobisomem';
    try {
      db.transaction(() => {
        const usuarioId = userModel.create(`teste${i}`, hash);
        const personagemId = characterModel.create(usuarioId, `personagem${i}`);
        hideoutModel.criar(personagemId, Date.now());
        characterService.escolherFaccao(usuarioId, faccao); // aplica bônus e entrega os itens iniciais
        const avatarId = faccao === 'vampiro' ? `vampire_${i}` : `werewolf_${i - QUANTIDADE / 2}`;
        characterModel.definirAvatar(personagemId, avatarId, faccao);
      })();
      criados.push(`teste${i} (${faccao})`);
    } catch (err) {
      // Ex.: já existe outro personagem chamado "personagem<i>". Não derruba o servidor.
      console.warn(`Não foi possível criar teste${i}:`, (err as Error).message);
    }
  }
  if (criados.length > 0) {
    console.log(`Contas de teste criadas: ${criados.join(', ')}. Senha: ${SENHA_TESTE}`);
  }
}
