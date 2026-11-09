import * as characterModel from '../models/characterModel';
import { encontrarAvatar } from './avatarCatalog';

/** Para onde mandar o jogador ao entrar: facção -> avatar -> perfil. */
export function destinoInicial(usuarioId: number): string {
  const p = characterModel.findByUsuarioId(usuarioId);
  if (!p?.faccao) return '/faction';
  if (!encontrarAvatar(p.avatar)) return '/avatar'; // sem avatar válido: escolhe uma vez
  return '/profile';
}
