# VampVS — protótipo local

Web game de texto: Vampiros vs Lobisomens. Node + TypeScript + Express + SQLite (better-sqlite3).

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
```

O banco é criado sozinho em `data/vampvs.db` (apague o arquivo para resetar tudo).
Para produção: `npm run build && SESSION_SECRET=algo-longo NODE_ENV=production npm start`.

## Contas de teste

Ao iniciar fora de produção, o servidor cria (se ainda não existirem) 6 contas já com facção escolhida:

| Usuário | Personagem | Facção |
|---|---|---|
| teste1, teste2, teste3 | personagem1, personagem2, personagem3 | Vampiro |
| teste4, teste5, teste6 | personagem4, personagem5, personagem6 | Lobisomem |

Senha de todas: `123456789`. Quem já existe não é alterado, então o progresso não é resetado.
Para desligar: `SEED_TESTE=0 npm run dev`. Em produção (`NODE_ENV=production`) nunca são criadas.

Dica: `localhost:3000` e `127.0.0.1:3000` guardam cookies separados, então dá para ficar logado numa conta em
cada endereço, na mesma janela, para testar a arena.

## Como testar o fluxo

1. Crie uma conta → cai na tela de facção (só aparece enquanto não houver facção).
2. Escolha Vampiro (+3 Agilidade) ou Lobisomem (+3 Força). Não dá para trocar depois.
3. No perfil, clique em "+" para treinar. Custo = valor base do atributo × 10. Comece com 200 de ouro;
   use "+500 ouro (teste)" (só fora de produção).
4. Equipe/desequipe itens e veja os bônus somarem no atributo.

## Caça (PvE) e Arena (PvP)

**Pontos de Ação (PA):** máximo 50, +1 a cada 5 minutos. Não há timer rodando: o servidor calcula a regeneração
quando você age. Caçar custa 1 PA, atacar na arena custa 5 PA.

**Caça:** o servidor sorteia um monstro (do seu nível ou abaixo é mais comum; até +2 níveis é raro).
Vitória dá XP e ouro; derrota custa só o PA. Ao subir de nível você ganha 3 pontos livres, usados no perfil
com "+1 ponto" (sem gastar ouro).

**Arena:** lista só jogadores da facção oposta. Regras no servidor: sem auto-ataque, sem atacar a própria facção,
espera de 10 min para atacar o mesmo alvo de novo, 5 PA por ataque. O vencedor leva 10% do ouro do perdedor
(teto 500), XP (15 + 5 × nível do perdedor) e +10 de honra; o perdedor perde até 3 de honra.

**Fórmula de combate** (`src/services/combat.ts`, usada nos dois modos):

- Vida = vitalidade × 10 (atributos totais, com itens equipados)
- Chance de acerto = 70% + (agilidade do atacante − agilidade do alvo) × 2%, limitada a 20%–95%
- Dano = força × 2 × (0,85 a 1,15) × 20 / (20 + defesa do alvo), mínimo 1
- Quem tem mais agilidade ataca primeiro; máximo de 20 rounds (se ninguém cair, vence quem tem mais % de vida)

Os números de balanceamento (PA, custos, cooldown, % de ouro, honra) ficam em `src/services/gameRules.ts`,
e os monstros em `MONSTROS_INICIAIS` no `src/db/database.ts` (só são inseridos com a tabela vazia).

**Testar a arena:** você precisa de um jogador da facção oposta. Abra uma janela anônima, crie outra conta e
escolha a outra facção. Para ver o PA acabar sem clicar 50 vezes, reduza `PA_MAX` para 3 em `gameRules.ts`.

**Banco existente:** ao iniciar, o servidor adiciona sozinho as colunas novas (`pa`, `pa_atualizado_em`,
`pontos_livres`, `honra`) e cria as tabelas `monstros` e `batalhas`, sem apagar seus dados.

## Vila / Mercador

Tela `/village` com duas abas: **Mercado** (compra) e **Meu inventário** (equipar, usar poção, vender).

**Tipos de item:** `weapon`, `armor`, `defensive` (um equipado por tipo) e `potion` (consumível, nunca equipa).
Cada item tem `preco_ouro`, `nivel_minimo` e bônus fixos de atributo (um item pode dar mais de um bônus).
Itens exclusivos de facção só aparecem para a facção certa.

**Compra:** o servidor confere facção, nível, espaço na mochila (máx. 40) e saldo, e debita com
`UPDATE ... WHERE ouro >= preco`. O cliente só envia o id do item; preço e requisitos vêm do banco.

**Equipar:** valida dono, facção, nível e tipo; desequipa o item anterior do mesmo tipo. Os atributos
totais são recalculados no servidor a cada uso: base + itens equipados + efeitos de poção ativos.

**Poções** (usar remove a poção do inventário):
- Poção de Energia: restaura 10 PA (recusa se o PA já está cheio).
- Poção de Vida / Fúria / Elixir de Reflexos: +3 de Vitalidade / Força / Agilidade por 30 minutos.
  Beber a mesma poção de novo renova o tempo, sem empilhar. O efeito vale na caça e na arena.

**Venda rápida:** devolve 50% do que o jogador **pagou** (`inventario.preco_pago`). Itens iniciais custaram 0,
então não são vendáveis (evita criar conta só para vender o kit inicial).

**Catálogo:** a lista `CATALOGO` em `src/db/database.ts` é a fonte da verdade. Ela é aplicada a cada início
do servidor (upsert por nome): mudou preço ou bônus, reinicie. Itens já comprados mantêm o `preco_pago`.

**Banco existente:** a tabela `itens` é reconstruída automaticamente (tipos `arma`/`armadura` viram `weapon`/`armor`,
`nivel_requerido` vira `nivel_minimo`), preservando ids e inventários. Novas tabelas/colunas: `efeitos_ativos`,
`inventario.preco_pago`.

## Esconderijo

Tela `/hideout` (menu "Esconderijo"). Cinco construções, todas começam no nível 1:

| Construção | Efeito | Custo para evoluir |
|---|---|---|
| Cripta (máx. 5) | libera as outras: nível máximo delas = 2 × nível da Cripta (até 10) | 200 × nível atual |
| Mina de Ouro | 10 ouro/hora por nível | 100 × nível atual |
| Tesouro | capacidade da mina = 100 + 200 × nível | 100 × nível atual |
| Muralha | −5% por nível (máx. 50%) do ouro perdido ao perder na arena | 100 × nível atual |
| Altar | +5 PA de máximo e recarga 5% mais rápida por nível acima do 1º (95 PA e 2,75 min no nível 10) | 150 × nível atual |

- **Ouro passivo:** não há timer. O servidor calcula `produção × tempo`, limitado pela capacidade do Tesouro
  (cheia, a mina para de produzir). Ao evoluir Mina ou Tesouro, o ouro produzido até aquele instante é
  fechado com o nível antigo, então não há ganho nem perda retroativa. "Coletar ouro" credita o valor
  calculado pelo servidor (o cliente não envia quantia nenhuma).
- **Altar:** o teto e o intervalo de PA vêm do nível do Altar em todo lugar (caça, arena, poção de energia,
  perfil). Ao evoluir o Altar, o PA é sincronizado antes, para não dar PA grátis.
- **Muralha:** vale para quem perde o combate PvP (atacante ou defensor); o vencedor leva o valor já reduzido.
  O relatório da arena mostra quanto a Muralha poupou.
- **Cadastro e contas antigas:** o Esconderijo é criado junto com o personagem; ao iniciar, contas existentes
  recebem o registro (a mina começa a produzir a partir desse momento).
- Os números ficam em `src/services/hideoutRules.ts`.

## Estrutura

```
src/
  server.ts            app Express, sessão, cabeçalhos, errorHandler
  config.ts errors.ts
  db/database.ts       SCHEMA (usuarios, personagens, itens, inventario) + seed
  models/              acesso ao SQLite (SQL preparado)
  services/            regras de jogo (gameRules, characterService, inventoryService)
  controllers/         HTTP <-> services
  routes/              rotas da API e das páginas
  middleware/auth.ts
views/                 login, faction, profile, village, hideout, hunt, arena (protegidas por rota)
public/                css/js estáticos (servidos em /static)
```

## API

| Método | Rota                          | Descrição                          |
|--------|-------------------------------|------------------------------------|
| POST   | /api/auth/register            | cria conta + personagem            |
| POST   | /api/auth/login, /logout      | sessão                             |
| GET    | /api/faction/options          | facções e bônus                    |
| POST   | /api/faction/choose           | escolha permanente                 |
| GET    | /api/character                | perfil, atributos totais e custos  |
| POST   | /api/character/train          | `{ "atributo": "forca" }`          |
| GET    | /api/inventory                | itens do jogador                   |
| POST   | /api/inventory/:id/equip      | equipa (troca o item do slot)      |
| POST   | /api/inventory/:id/unequip    | desequipa                          |
| POST   | /api/inventory/:id/use        | usa uma poção                      |
| POST   | /api/inventory/:id/sell       | venda rápida (50% do preço pago)   |
| GET    | /api/shop                     | catálogo com bloqueios (nível/ouro)|
| POST   | /api/shop/buy                 | `{ "itemId": 4 }`                  |
| GET    | /api/hideout                  | construções, custos e ouro da mina |
| POST   | /api/hideout/upgrade          | `{ "estrutura": "mina" }`          |
| POST   | /api/hideout/collect          | coleta o ouro da mina              |
| POST   | /api/character/spend-point    | usa 1 ponto livre num atributo     |
| GET    | /api/hunt/monsters            | monstros e PA                      |
| POST   | /api/hunt                     | uma caçada (1 PA)                  |
| GET    | /api/arena/targets            | alvos da facção oposta + ranking   |
| POST   | /api/arena/attack             | `{ "alvoId": 3 }` (5 PA)           |
| GET    | /api/arena/history            | últimas 10 batalhas do jogador     |

## Decisões de segurança

- Senhas com bcrypt (`bcryptjs`, mesmo algoritmo do `bcrypt`, sem compilar código nativo), custo 12.
- Sessão em cookie `httpOnly` + `sameSite=lax`; ID de sessão regenerado no login; API só aceita JSON em POST.
- Treino: um único `UPDATE ... WHERE ouro >= custo AND atributo = valor_lido` — sem corrida, sem ouro negativo.
- Facção: `UPDATE ... WHERE faccao IS NULL` — escolha única mesmo com requisições simultâneas.
- Equipar: transação que valida dono, facção, nível e "já equipado"; trigger no banco impede 2 itens no mesmo slot.
- Front monta o DOM com `textContent` (sem `innerHTML`) e a CSP bloqueia scripts/estilos inline.

## Limitações conhecidas (protótipo)

Sessões em memória (reiniciar desloga), sem rate limit no login, derrota na caça não tira vida (só o PA), sem proteção contra vários jogadores atacando a mesma vítima em sequência.
