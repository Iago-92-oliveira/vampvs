/** Erro de regra de negócio: o errorHandler converte em resposta JSON. */
export class GameError extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}
