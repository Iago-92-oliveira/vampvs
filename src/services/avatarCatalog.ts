import type { Faccao } from '../types/game';

/**
 * Catálogo FIXO de avatares: 4 por facção, imagens quadradas (1:1) em public/images/avatars.
 * O banco guarda só o `id` (ex.: 'vampire_1'); a URL sai sempre deste catálogo, nunca do cliente.
 * Para trocar as imagens por arte final (PNG, por exemplo), basta substituir os arquivos e ajustar
 * a extensão em `extensao` abaixo, sem mexer em banco nem em contas existentes.
 */
export interface Avatar {
  id: string;
  faccao: Faccao;
  nome: string;
  url: string;
}

const PASTA_URL = '/static/images/avatars';
const extensao = 'svg';

function montar(faccao: Faccao, prefixo: string, nomes: string[]): Avatar[] {
  return nomes.map((nome, i) => ({
    id: `${prefixo}_${i + 1}`,
    faccao,
    nome,
    url: `${PASTA_URL}/${prefixo}_${i + 1}.${extensao}`,
  }));
}

export const AVATARES: Avatar[] = [
  ...montar('vampiro', 'vampire', ['Nobre da Noite', 'Sombra Encapuzada', 'Dama Carmesim', 'Senhor dos Morcegos']),
  ...montar('lobisomem', 'werewolf', ['Alfa da Matilha', 'Uivo da Lua Cheia', 'Garras Afiadas', 'Lobo Cicatrizado']),
];

export const URL_AVATAR_PADRAO = `${PASTA_URL}/default.${extensao}`;

export const avataresDaFaccao = (faccao: Faccao): Avatar[] => AVATARES.filter((a) => a.faccao === faccao);

/** Busca por igualdade EXATA do id: qualquer outra string (caminhos, maiúsculas, extensão) não existe. */
export function encontrarAvatar(id: unknown): Avatar | undefined {
  return typeof id === 'string' ? AVATARES.find((a) => a.id === id) : undefined;
}

export const urlDoAvatar = (id: string | null): string | null => encontrarAvatar(id)?.url ?? null;

export type VerificacaoAvatar =
  | { ok: true; avatar: Avatar }
  | { ok: false; motivo: 'inexistente' | 'outra_faccao' };

/** Regra central: o avatar precisa existir E ser da facção do personagem. */
export function verificarAvatar(faccao: Faccao, id: unknown): VerificacaoAvatar {
  const avatar = encontrarAvatar(id);
  if (!avatar) return { ok: false, motivo: 'inexistente' };
  if (avatar.faccao !== faccao) return { ok: false, motivo: 'outra_faccao' };
  return { ok: true, avatar };
}
