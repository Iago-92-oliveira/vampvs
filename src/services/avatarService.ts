import { GameError } from '../errors';
import * as characterModel from '../models/characterModel';
import { avataresDaFaccao, encontrarAvatar, verificarAvatar } from './avatarCatalog';
import { exigirPersonagemComFaccao } from './battleHelpers';

/** Só devolve os avatares da facção do jogador: os da facção oposta nem são enviados ao navegador. */
export function opcoes(usuarioId: number) {
  const p = exigirPersonagemComFaccao(usuarioId);
  return {
    faccao: p.faccao,
    atual: encontrarAvatar(p.avatar)?.id ?? null,
    avatares: avataresDaFaccao(p.faccao!).map(({ id, nome, url }) => ({ id, nome, url })),
  };
}

/** A facção vem do banco (sessão), nunca do cliente. O cliente só envia o id do avatar. */
export function escolher(usuarioId: number, avatarId: unknown) {
  const p = exigirPersonagemComFaccao(usuarioId);

  const v = verificarAvatar(p.faccao!, avatarId);
  if (!v.ok) {
    if (v.motivo === 'outra_faccao') {
      throw new GameError(403, 'avatar_outra_faccao', 'Este avatar pertence a outra facção.');
    }
    throw new GameError(400, 'avatar_invalido', 'Avatar inválido.');
  }
  if (!characterModel.definirAvatar(p.id, v.avatar.id, p.faccao!)) {
    throw new GameError(409, 'estado_mudou', 'Não foi possível salvar o avatar. Tente novamente.');
  }
  return v.avatar;
}
