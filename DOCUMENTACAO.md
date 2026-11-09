# VampVS — Documentação do projeto

Web game de texto e estratégia, no estilo BiteFight / MonstersGame: **Vampiros contra Lobisomens**.
Protótipo funcional para rodar localmente, com back-end em Node.js + TypeScript + Express e banco SQLite.

> Esta documentação descreve o código como ele está hoje (versão `0.1.0`): autenticação, facções, avatares,
> perfil e treino, caça (PvE), arena (PvP), Vila/Mercador, inventário e Esconderijo.
> A parte de **operação** (Git, túnel, Codespaces) reúne os comandos que usamos no dia a dia.

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Stack e requisitos](#2-stack-e-requisitos)
3. [Início rápido](#3-início-rápido)
4. [Estrutura do projeto](#4-estrutura-do-projeto)
5. [Arquitetura](#5-arquitetura)
6. [Banco de dados](#6-banco-de-dados)
7. [Regras do jogo](#7-regras-do-jogo)
8. [API REST](#8-api-rest)
9. [Front-end](#9-front-end)
10. [Segurança](#10-segurança)
11. [Operação: Git, túnel e Codespaces](#11-operação-git-túnel-e-codespaces)
12. [Solução de problemas](#12-solução-de-problemas)
13. [Limitações conhecidas e próximos passos](#13-limitações-conhecidas-e-próximos-passos)

---

## 1. Visão geral

### O que o jogo tem

| Módulo | O que faz |
|---|---|
| Autenticação | Cadastro e login com senha criptografada (bcrypt) e sessão por cookie |
| Facção | Escolha **permanente** entre Vampiro (+3 Agilidade) e Lobisomem (+3 Força) |
| Avatar | 4 avatares por facção; a escolha é validada no servidor |
| Perfil | Nível, XP, ouro, PA, honra, 4 atributos, treino com ouro, pontos livres, histórico de batalhas |
| Caça (PvE) | Gasta 1 PA, sorteia um monstro, combate automático, rende XP e ouro |
| Arena (PvP) | Ataca jogadores da facção oposta (5 PA), rouba ouro, ganha honra, ranking |
| Vila / Mercador | Compra e venda de itens, equipar/desequipar, poções consumíveis |
| Esconderijo | 5 construções: ouro passivo, defesa contra roubo, mais PA, Cripta como limite geral |

### Fluxo do jogador

```
Cadastro ──► Escolha de facção ──► Escolha de avatar ──► Perfil
                 (1 vez)               (1 vez, pode trocar depois)
                                                          │
            ┌──────────────┬──────────────┬───────────────┼──────────────┐
          Caça           Arena          Vila          Esconderijo      Perfil
         (ouro/XP)   (honra/ouro)    (itens/poções)  (ouro passivo,   (treino,
                                                      PA, defesa)      inventário)
```

Ao entrar (`/`), o servidor decide o destino: sem facção vai para `/faction`; com facção e sem avatar vai
para `/avatar`; com tudo escolhido vai para `/profile`.

### Ciclo econômico

- **Ouro** vem da caça, da arena (roubo ao perdedor) e da mina do Esconderijo.
- **Ouro** é gasto no treino de atributos, na Vila (itens e poções) e na evolução do Esconderijo.
- **PA (pontos de ação)** limitam o ritmo: regeneram com o tempo e o Altar aumenta o teto e acelera a recarga.

---

## 2. Stack e requisitos

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript (compilado com `tsc`, executado em desenvolvimento com `tsx`) |
| Servidor | Node.js + Express 4 |
| Banco | SQLite via `better-sqlite3` (síncrono, arquivo local) |
| Senhas | `bcryptjs` (mesmo algoritmo do bcrypt, sem compilar código nativo), custo 12 |
| Sessão | `express-session` (cookie `vampvs.sid`, armazenamento em memória) |
| Front-end | HTML puro + CSS (variáveis, tema escuro) + JavaScript sem framework |

**Requisitos:** Node.js 20 LTS ou mais novo e npm. Conferir com `node -v`. Se o `npm install` reclamar do
`better-sqlite3`, quase sempre é versão antiga do Node.

**Scripts do `package.json`:**

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor com recarga automática (`tsx watch src/server.ts`) |
| `npm run build` | Compila o TypeScript para `dist/` |
| `npm start` | Roda o compilado (`node dist/server.js`) |
| `npm run typecheck` | Só verifica os tipos, sem gerar arquivos |

---

## 3. Início rápido

```powershell
npm install
npm run dev
```

Abra `http://localhost:3000`. Quando aparecer `VampVS rodando em http://localhost:3000`, está no ar.

### Contas de teste

Ao iniciar **fora de produção**, o servidor cria (se ainda não existirem) 6 contas já com facção e avatar:

| Usuário | Personagem | Facção |
|---|---|---|
| `teste1`, `teste2`, `teste3` | `personagem1`, `personagem2`, `personagem3` | Vampiro |
| `teste4`, `teste5`, `teste6` | `personagem4`, `personagem5`, `personagem6` | Lobisomem |

Senha de todas: **`123456789`** (exemplo: `teste1` / `123456789`).

- Quem já existe não é alterado: o progresso não é resetado a cada início.
- Para desligar: `$env:SEED_TESTE="0"; npm run dev`.
- Em produção (`NODE_ENV=production`) elas **nunca** são criadas.
- Se o repositório for **público**, essas credenciais ficam visíveis no código e nesta documentação. Elas só
  existem em desenvolvimento, mas, se isso incomodar, deixe o repositório privado.

**Testar a Arena:** é preciso um jogador da facção oposta. Use `teste1` (vampiro) numa janela e `teste4`
(lobisomem) em outra. `localhost:3000` e `127.0.0.1:3000` guardam cookies separados, então dá para ficar logado
numa conta em cada endereço na mesma janela.

**Botão de teste:** no Perfil e na Vila aparece "+500 ouro (teste)", só fora de produção.

### Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `NODE_ENV` | (vazio) | `production` liga o modo produção (veja abaixo) |
| `SESSION_SECRET` | `dev-only-troque-este-segredo` | Segredo da sessão. **Obrigatório em produção** (o servidor se recusa a iniciar sem ele) |
| `DB_PATH` | `data/vampvs.db` | Caminho do arquivo SQLite |
| `SEED_TESTE` | (vazio) | `0` desliga a criação das contas de teste |

No PowerShell, defina antes do comando (vale só para aquele terminal):

```powershell
$env:SESSION_SECRET="uma-frase-longa-e-aleatoria-aqui"
npm run dev
```

**Modo produção** (`NODE_ENV=production`): exige `SESSION_SECRET`, o cookie de sessão passa a ser `secure`
(só HTTPS), não cria contas de teste e remove a rota e o botão de ouro de teste.

### Resetar o banco

Pare o servidor e apague `data/vampvs.db` (e os arquivos `data/vampvs.db-wal` e `data/vampvs.db-shm`, se
existirem). Ao iniciar de novo, o banco é recriado do zero.

### Compilar e rodar sem reinício automático

```powershell
npm run build
npm start
```

Aqui o servidor só reinicia quando você mandar (veja a seção 11.2).

---

## 4. Estrutura do projeto

```
vampvs/
├── package.json  tsconfig.json  .gitignore  README.md  DOCUMENTACAO.md
├── data/                         banco SQLite (vampvs.db é ignorado pelo Git)
├── public/                       arquivos estáticos, servidos em /static
│   ├── css/style.css             tema escuro, tokens e componentes
│   ├── images/avatars/           8 avatares + default.svg (SVG, 1:1)
│   └── js/                       common.js + um script por tela
├── views/                        páginas HTML (protegidas por rota)
│   └── login, faction, avatar, profile, village, hideout, hunt, arena (.html)
└── src/
    ├── server.ts                 monta o app, sessão, cabeçalhos, rotas, tratador de erros
    ├── config.ts  errors.ts
    ├── types/                    game.ts (tipos do domínio), express-session.d.ts
    ├── db/                       database.ts (schema, migrações, catálogo), seedDev.ts
    ├── middleware/auth.ts        exigirLoginApi, exigirFaccaoApi, exigirLoginPagina
    ├── routes/                   uma rota por módulo + pageRoutes (páginas)
    ├── controllers/              traduzem HTTP em chamadas aos services
    ├── services/                 regras de negócio (a camada mais importante)
    └── models/                   acesso ao SQLite (SQL preparado)
```

### O que cada arquivo faz

**`src/services/` (regras de negócio):**

| Arquivo | Responsabilidade |
|---|---|
| `gameRules.ts` | Constantes de balanceamento, custo de treino, cálculo dos atributos totais |
| `combat.ts` | Motor de combate puro (sem banco): `simular(a, d, rng)` |
| `progression.ts` | `aplicarXp`: soma XP e sobe níveis |
| `actionPoints.ts` | Regeneração de PA sob demanda (`regenerarPA`, `statusPA`) |
| `paService.ts` | Teto e intervalo de PA conforme o nível do Altar |
| `statsService.ts` | Único lugar que calcula os atributos totais (base + itens + efeitos) |
| `battleHelpers.ts` | `lutadorDe`, `gastarPA`, `exigirPersonagemComFaccao` |
| `characterService.ts` | Perfil, escolha de facção, treino, pontos livres |
| `huntService.ts` | Caça: sorteio de monstro, combate, recompensas |
| `arenaService.ts` | Alvos, ataque PvP, ouro, honra, ranking |
| `battleService.ts` | Histórico de batalhas do jogador |
| `shopService.ts` | Catálogo da Vila e compra |
| `inventoryService.ts` | Inventário, equipar, desequipar, usar poção, vender |
| `itemView.ts` | Formato do item enviado ao navegador |
| `hideoutRules.ts` | Fórmulas puras do Esconderijo |
| `hideoutService.ts` | Ver, evoluir e coletar no Esconderijo |
| `avatarCatalog.ts` | Catálogo fixo de avatares e a verificação de facção |
| `avatarService.ts` | Opções e escolha de avatar |
| `flow.ts` | `destinoInicial`: facção → avatar → perfil |

**`src/models/`:** `userModel`, `characterModel`, `itemModel`, `inventoryModel`, `efeitoModel`, `monsterModel`,
`battleModel`, `hideoutModel`. Só executam SQL; não contêm regras de jogo.

---

## 5. Arquitetura

### Camadas

```
Navegador ──► routes ──► controllers ──► services ──► models ──► SQLite
                │              │             │
           middleware     (só HTTP)    (regras de negócio,
           (sessão,                     validações, transações)
            login, facção)
```

- **routes** declaram os endereços e aplicam os middlewares de login e facção.
- **controllers** leem `req`, chamam um service e montam a resposta JSON. Não têm regra de jogo.
- **services** concentram as regras e validações, sempre lendo os dados do **banco**, nunca confiando no cliente.
- **models** são SQL parametrizado; nomes de coluna dinâmicos só vêm de listas fixas no código.

### Ordem dos middlewares (`server.ts`)

1. `express.json({ limit: '10kb' })`
2. `express-session` (cookie `vampvs.sid`, `httpOnly`, `sameSite=lax`, `secure` em produção, validade de 7 dias)
3. Cabeçalhos de segurança (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'self'`)
4. Em `/api`, mutações (POST etc.) só aceitam `Content-Type: application/json` (senão 415)
5. `/static` (arquivos de `public/`), depois as rotas `/api/*`, depois as páginas
6. 404 JSON para `/api` inexistente e o tratador de erros final

### Tratamento de erros

Regras de negócio lançam `GameError(status, codigo, mensagem)`. O tratador final converte em
`{ "erro": "codigo", "mensagem": "texto" }` com o status HTTP. Erros do banco (por exemplo, o gatilho de slot
ocupado) viram 409/400 amigáveis; qualquer outro erro vira 500 genérico e é registrado no terminal.
Handlers `async` (cadastro e login) passam por um `asyncHandler`, porque o Express 4 não captura rejeições.

### Transações e concorrência

O `better-sqlite3` é síncrono. Operações que mexem em ouro, PA, itens ou níveis usam `db.transaction(...)`, e as
que tocam ouro/PA usam `.immediate` (bloqueio de escrita desde o início). Além disso, o próprio SQL repete a
condição crítica, por exemplo:

```sql
UPDATE personagens SET ouro = ouro - ? WHERE id = ? AND ouro >= ?   -- nunca fica negativo
UPDATE personagens SET avatar = ? WHERE id = ? AND faccao = ?      -- avatar só da própria facção
UPDATE esconderijo SET nivel_x = nivel_x + 1 WHERE ... AND nivel_x = ?  -- evita evoluir duas vezes
```

### Tempo sem timers

Não existe nenhum processo rodando em segundo plano. PA, ouro da mina e expiração das poções são
**calculados sob demanda** a partir de um instante gravado (`pa_atualizado_em`, `acumulado_em`, `expira_em`).

---

## 6. Banco de dados

SQLite em `data/vampvs.db`, com `journal_mode = WAL` e `foreign_keys = ON`. Tudo é criado e migrado por
`initDatabase()` em `src/db/database.ts` a cada início do servidor.

### Relações

```
usuarios 1──1 personagens 1──N inventario N──1 itens
                  │
                  ├──1 esconderijo          (construções + ouro passivo)
                  ├──N efeitos_ativos       (buffs temporários de poções)
                  └──N batalhas             (PvE e PvP; atacante_id / defensor_id)

monstros                                    (catálogo da caça)
```

### Tabelas

**`usuarios`**: `id`, `username` (único, sem diferenciar maiúsculas), `password_hash`, `criado_em`.

**`personagens`** (1 por usuário):

| Coluna | Detalhe |
|---|---|
| `usuario_id` | único, FK para `usuarios` |
| `nome` | único, sem diferenciar maiúsculas |
| `faccao` | `NULL` (ainda não escolheu), `vampiro` ou `lobisomem` |
| `nivel`, `xp` | começam em 1 e 0 |
| `ouro` | começa em 200; `CHECK ouro >= 0` |
| `forca`, `defesa`, `agilidade`, `vitalidade` | começam em 5 |
| `pa`, `pa_atualizado_em` | PA gravado e instante do último "tick" de regeneração |
| `pontos_livres` | pontos de atributo ganhos ao subir de nível |
| `honra` | pontuação do ranking PvP (nunca negativa) |
| `avatar` | id do catálogo (ex.: `vampire_2`); `NULL` = não escolhido |

**`itens`** (catálogo): `nome` (único), `descricao`, `tipo` (`weapon`, `armor`, `defensive`, `potion`),
`bonus_forca/defesa/agilidade/vitalidade`, `nivel_minimo`, `preco_ouro`, `faccao` (`NULL` = qualquer),
`efeito_tipo` (`pa` ou `buff`, só poções), `efeito_valor`, `efeito_duracao_min`.
Um `CHECK` garante que só poções têm efeito.

**`inventario`** (instâncias): `personagem_id`, `item_id`, `equipado` (0/1), `preco_pago`, `adquirido_em`.
O mesmo item pode aparecer em várias linhas. `preco_pago = 0` marca item inicial (não vendável).

**`esconderijo`** (1 por personagem): `nivel_cripta`, `nivel_muralha`, `nivel_mina_ouro`, `nivel_tesouro`,
`nivel_altar` (todos começam em 1), `ouro_acumulado` (REAL, pode ter fração) e `acumulado_em` (epoch ms).

**`efeitos_ativos`**: `personagem_id`, `nome`, `bonus_*` e `expira_em` (epoch ms). Efeitos vencidos são
ignorados na leitura.

**`monstros`**: `nome`, `descricao`, `nivel`, `forca`, `defesa`, `agilidade`, `vitalidade`, `xp_recompensa`,
`ouro_min`, `ouro_max`.

**`batalhas`**: `tipo` (`pve`/`pvp`), `atacante_id`, `defensor_id` (nulo na caça), `monstro_nome/nivel`,
`vencedor` (`atacante`/`defensor`), `xp_ganho`, `ouro_ganho`, `honra_ganha`, `honra_perdida`, `criado_em`.

### Gatilhos (defesa em profundidade)

| Gatilho | Garante |
|---|---|
| `trg_um_item_por_slot` | No máximo 1 item equipado por tipo (arma, armadura, defensivo) |
| `trg_pocao_nao_equipa` | Poção nunca fica "equipada" |

Os dois são recriados (`DROP` + `CREATE`) a cada início do servidor.

### Migrações automáticas

Bancos antigos são atualizados sozinhos, **sem perder dados**:

- Colunas novas: `personagens.pa`, `pa_atualizado_em`, `pontos_livres`, `honra`, `avatar` e `inventario.preco_pago`.
- A tabela `itens` é reconstruída quando está no formato antigo (`arma`/`armadura` viram `weapon`/`armor`,
  `nivel_requerido` vira `nivel_minimo`), preservando os ids e os inventários.
- Todo personagem sem Esconderijo ganha um (a mina começa a produzir a partir desse momento).
- Tabelas novas (`monstros`, `batalhas`, `esconderijo`, `efeitos_ativos`) são criadas se faltarem.

### Catálogo no código

A lista `CATALOGO` (itens) em `database.ts` é a **fonte da verdade** e é aplicada com *upsert* por nome a cada
início: mudou preço ou bônus, é só reiniciar. Itens já comprados mantêm o `preco_pago`. Os monstros
(`MONSTROS_INICIAIS`) só são inseridos se a tabela estiver vazia.

---

## 7. Regras do jogo

Todos os números abaixo ficam em `src/services/gameRules.ts` e `src/services/hideoutRules.ts` (resumo na seção 7.11).

### 7.1 Facções

| Facção | Bônus inicial | Itens iniciais (não vendáveis) |
|---|---|---|
| Vampiro | +3 Agilidade | Espada Comum, Couraça de Couro, Adaga de Sangue, Manto das Sombras |
| Lobisomem | +3 Força | Espada Comum, Couraça de Couro, Garras de Prata, Pele de Urso Cinzento |

- A escolha é **permanente**: `UPDATE ... WHERE faccao IS NULL`, e a segunda tentativa responde 409.
- Itens e avatares exclusivos de uma facção não podem ser usados pela outra.

### 7.2 Atributos e treino

| Atributo | Efeito no combate |
|---|---|
| Força | Dano: `força × 2` (com variação aleatória) |
| Defesa | Reduz o dano recebido: fator `20 / (20 + defesa)` |
| Agilidade | Chance de acerto e iniciativa (quem tem mais ataca primeiro) |
| Vitalidade | Vida máxima: `vitalidade × 10` |

- Todos começam em **5** (mais o bônus da facção).
- **Atributo total** = base + bônus dos itens **equipados** + efeitos ativos de poção. O cálculo fica só em
  `statsService.ts`, então perfil, caça e arena sempre concordam.
- **Treino com ouro:** custo = **valor base atual × 10** (o bônus de item não encarece o treino).
  Exemplo: base 5 custa 50, base 6 custa 60.
- **Pontos livres** (ganhos ao subir de nível) sobem um atributo sem custo em ouro, pelo botão "+1 ponto".

### 7.3 XP e nível

- XP para o próximo nível: **nível × 100** (nível 1 → 100 XP, nível 2 → 200 XP, ...).
- O XP que sobra é mantido, e é possível subir vários níveis de uma vez.
- Cada nível ganho dá **3 pontos livres**.

### 7.4 Pontos de Ação (PA)

| Item | Valor |
|---|---|
| Máximo base | 50 PA |
| Regeneração base | +1 PA a cada 5 minutos (50 PA em cerca de 4h10) |
| Custo da caça | 1 PA |
| Custo de um ataque na arena | 5 PA |

- **Regeneração sob demanda:** o servidor calcula quantos "ticks" passaram desde `pa_atualizado_em`. Cheio, o
  relógio reinicia no próximo gasto.
- O **Altar** do Esconderijo aumenta o máximo e acelera a recarga (seção 7.9).
- A **Poção de Energia** restaura 10 PA (e é recusada se o PA já estiver cheio).

### 7.5 Combate

O mesmo motor (`combat.ts`) serve a caça e a arena. Os dois lados usam seus **atributos totais**.

| Elemento | Fórmula |
|---|---|
| Vida máxima | `vitalidade × 10` |
| Chance de acerto | `70% + (agilidade do atacante − agilidade do alvo) × 2%`, limitada a 20%–95% |
| Dano bruto | `força × 2 × variação aleatória (0,85 a 1,15)` |
| Dano líquido | `bruto × 20 / (20 + defesa do alvo)`, arredondado, mínimo 1 |
| Iniciativa | Quem tem mais agilidade ataca primeiro em todos os rounds (empate: sorteio) |
| Limite | 20 rounds. Se ninguém cair, vence quem tiver maior % de vida (empate: o defensor) |

Todo o cálculo e o sorteio acontecem **no servidor**. O navegador só recebe o relatório (golpes, vida final).

### 7.6 Caça (PvE)

1. Custa **1 PA** (sem PA, a caça é recusada).
2. O servidor sorteia um monstro com nível até **nível do jogador + 2**, com pesos: nível igual ou menor **3**,
   +1 nível **2**, +2 níveis **1** (monstros mais fortes aparecem pouco).
3. Combate automático. **Vitória:** XP fixo do monstro e ouro aleatório entre o mínimo e o máximo dele.
   **Derrota:** o jogador perde só o PA gasto (não há perda de vida ou ouro nesta versão).
4. Toda caça é registrada em `batalhas`.

| Monstro | Nível | For | Def | Agi | Vit | XP | Ouro |
|---|---|---|---|---|---|---|---|
| Rato Gigante | 1 | 4 | 2 | 3 | 4 | 10 | 10–25 |
| Lobo Faminto | 2 | 7 | 4 | 6 | 6 | 20 | 20–45 |
| Cultista Sombrio | 3 | 9 | 6 | 7 | 8 | 35 | 40–80 |
| Ghoul | 4 | 10 | 7 | 6 | 9 | 55 | 70–130 |
| Caçador de Bruxas | 6 | 13 | 9 | 9 | 12 | 90 | 120–220 |
| Troll das Cavernas | 8 | 17 | 12 | 6 | 16 | 140 | 200–350 |

Em simulações com um lobisomem nível 1 recém-criado e equipado com os itens iniciais: Rato 100% de vitória,
Lobo 92%, Cultista 47%, Ghoul 18%. Treinar e equipar muda isso.

### 7.7 Arena (PvP)

- **Alvos:** só jogadores da **facção oposta** (até 30, ordenados por honra, depois nível). Mostra o **ranking de
  honra** (top 10) e as últimas batalhas.
- **Regras validadas no servidor:**
  - não pode atacar a si mesmo (`auto_ataque`);
  - não pode atacar a própria facção (`mesma_faccao`);
  - alvo inexistente ou sem facção é recusado;
  - **cooldown de 10 minutos** para atacar o mesmo alvo de novo (`cooldown_alvo`, HTTP 429);
  - **5 PA** por ataque.
- **Consequências:**

| O que | Regra |
|---|---|
| Ouro | O vencedor leva **10% do ouro do perdedor**, no máximo 500, **reduzido pela Muralha do perdedor** |
| XP | Vencedor ganha `15 + 5 × nível do perdedor` |
| Honra | Vencedor +10; perdedor −3 (nunca abaixo de 0) |
| Registro | Gravado em `batalhas` (aparece no histórico dos dois jogadores) |

- A Muralha vale para **quem perde** (atacante ou defensor). O relatório mostra quanto ela poupou.
- O ouro guardado na **mina do Esconderijo** não pode ser roubado: só o ouro que o jogador carrega.

### 7.8 Vila / Mercador e inventário

**Tipos de item e slots**

| Tipo | Uso |
|---|---|
| `weapon` (arma), `armor` (armadura), `defensive` (defensivo) | Equipáveis; **um item equipado por tipo** |
| `potion` (poção) | Consumível; nunca equipa |

**Compra** (o cliente só envia o id do item; preço e requisitos vêm do banco). Validações, em ordem: id válido,
item à venda, facção compatível, nível mínimo, mochila com espaço (**máximo 40 itens**), ouro suficiente.
O débito é `UPDATE ... WHERE ouro >= preço` dentro de uma transação imediata.

**Equipar:** valida dono do item, não-poção, não já equipado, facção e nível. Equipar um item **desequipa
automaticamente** o anterior do mesmo tipo.

**Poções** (usar remove a poção do inventário):

| Poção | Efeito |
|---|---|
| Poção de Energia | Restaura 10 PA (recusa se o PA já está cheio) |
| Poção de Vida | +3 Vitalidade por 30 minutos |
| Poção de Fúria | +3 Força por 30 minutos |
| Elixir de Reflexos | +3 Agilidade por 30 minutos |

Beber a mesma poção de novo **renova** a duração (não empilha). Poções diferentes somam. O efeito vale na caça
e na arena.

**Venda rápida:** devolve **50% do que o jogador pagou** (`preco_pago`). Itens iniciais não podem ser vendidos
(evita criar conta só para vender o kit). Vender um item equipado remove o bônus.

**Catálogo de itens**

| Item | Tipo | Bônus | Nível | Facção | Preço |
|---|---|---|---|---|---|
| Espada Comum | arma | +2 For | 1 | todas | 120 |
| Adaga de Sangue | arma | +1 For, +2 Agi | 1 | Vampiro | 150 |
| Garras de Prata | arma | +3 For | 1 | Lobisomem | 150 |
| Adaga de Prata | arma | +3 For, +1 Agi | 3 | todas | 400 |
| Montante do Carrasco | arma | +6 For | 5 | todas | 1200 |
| Lâmina Rúnica | arma | +8 For, +2 Agi | 10 | todas | 3500 |
| Couraça de Couro | armadura | +2 Def, +1 Vit | 1 | todas | 120 |
| Manto das Sombras | armadura | +2 Def, +1 Agi | 1 | Vampiro | 150 |
| Pele de Urso Cinzento | armadura | +2 Def, +2 Vit | 1 | Lobisomem | 150 |
| Armadura de Couro Batido | armadura | +3 Def, +2 Vit | 3 | todas | 450 |
| Cota de Malha | armadura | +6 Def, +3 Vit | 7 | todas | 1800 |
| Anel Sombrio | defensivo | +1 Def, +2 Agi | 2 | todas | 300 |
| Amuleto da Lua | defensivo | +4 Vit | 3 | todas | 450 |
| Escudo de Ferro | defensivo | +4 Def | 4 | todas | 600 |
| Talismã Ancestral | defensivo | +3 Def, +2 Agi, +3 Vit | 8 | todas | 2200 |
| Poção de Energia | poção | +10 PA | 1 | todas | 150 |
| Poção de Vida | poção | +3 Vit (30 min) | 1 | todas | 120 |
| Poção de Fúria | poção | +3 For (30 min) | 1 | todas | 120 |
| Elixir de Reflexos | poção | +3 Agi (30 min) | 1 | todas | 120 |

### 7.9 Esconderijo

Cinco construções, todas começando no **nível 1**. Custo para evoluir = **valor-base da construção × nível atual**.

| Construção | Nível máx. | Efeito | Valor-base |
|---|---|---|---|
| Cripta | 5 | "Nível geral": libera as outras construções até o nível `2 × Cripta` (máx. 10) | 200 |
| Mina de Ouro | 10 | 10 ouro por hora por nível | 100 |
| Tesouro | 10 | Capacidade da mina = `100 + 200 × nível` | 100 |
| Muralha | 10 | −5% por nível (máx. 50%) do ouro perdido ao perder na arena | 100 |
| Altar | 10 | +5 PA de máximo e recarga 5% mais rápida por nível acima do 1º (nível 10: 95 PA e 2,75 min por PA) | 150 |

- **Ouro passivo:** o servidor calcula `produção × tempo`, limitado pela capacidade do Tesouro. Com a mina
  **cheia, ela para de produzir** (o excedente se perde). O botão **Coletar ouro** credita o valor calculado
  pelo servidor e aparece quando há pelo menos 1 de ouro.
- **Sem ganho nem perda retroativa:** ao evoluir Mina ou Tesouro, o ouro produzido até aquele instante é
  fechado com o nível antigo. Ao evoluir o Altar, o PA é sincronizado antes.
- **Evoluir:** valida estrutura, nível máximo, limite da Cripta (`cripta_insuficiente`) e saldo; o débito e o
  novo nível acontecem na mesma transação.
- Custo total para deixar tudo no máximo: **22.250 de ouro**.
- Todo personagem nasce com um Esconderijo (criado no cadastro; contas antigas recebem ao iniciar o servidor).

### 7.10 Avatares

- 4 por facção, imagens quadradas em `public/images/avatars/` (placeholders em SVG), mais `default.svg` para
  quem ainda não escolheu.
- O banco guarda só o **id** (`vampire_1..4`, `werewolf_1..4`); a URL sai sempre do catálogo do servidor.
- Vampiros: Nobre da Noite, Sombra Encapuzada, Dama Carmesim, Senhor dos Morcegos.
  Lobisomens: Alfa da Matilha, Uivo da Lua Cheia, Garras Afiadas, Lobo Cicatrizado.
- **Segurança:** o cliente envia só `{ "avatarId": "vampire_2" }`. O servidor aceita apenas ids exatos do
  catálogo, recusa avatar de outra facção (403) e id inexistente (400), e o `UPDATE` ainda confere a facção.
  A lista enviada ao navegador só traz os avatares da facção do jogador.
- Para usar arte própria: substitua os arquivos mantendo os nomes (se forem PNG, mude `extensao` em
  `src/services/avatarCatalog.ts`).

### 7.11 Constantes de balanceamento (onde mudar)

| Constante | Valor | Arquivo |
|---|---|---|
| `PA_MAX`, `PA_INTERVALO_MS` | 50, 5 min | `gameRules.ts` |
| `CUSTO_PA_CACA`, `CUSTO_PA_ATAQUE` | 1, 5 | `gameRules.ts` |
| `NIVEL_MAX_MONSTRO_ACIMA` | 2 | `gameRules.ts` |
| `PONTOS_POR_NIVEL` | 3 | `gameRules.ts` |
| `COOLDOWN_MESMO_ALVO_MS` | 10 min | `gameRules.ts` |
| `PERCENTUAL_ROUBO_OURO`, `TETO_ROUBO_OURO` | 10%, 500 | `gameRules.ts` |
| `HONRA_VITORIA`, `HONRA_DERROTA` | 10, 3 | `gameRules.ts` |
| `XP_PVP_BASE`, `XP_PVP_POR_NIVEL_DO_OPONENTE` | 15, 5 | `gameRules.ts` |
| `FRACAO_VENDA`, `LIMITE_INVENTARIO` | 50%, 40 | `gameRules.ts` |
| `BONUS_FACCAO`, `ITENS_INICIAIS_POR_FACCAO` | veja 7.1 | `gameRules.ts` |
| `custoTreino` | base × 10 | `gameRules.ts` |
| `xpParaProximoNivel` | nível × 100 | `gameRules.ts` |
| Fórmulas do Esconderijo | veja 7.9 | `hideoutRules.ts` |
| Fórmula de combate | veja 7.5 | `combat.ts` |
| `CATALOGO`, `MONSTROS_INICIAIS` | veja 7.6 e 7.8 | `db/database.ts` |
| Avatares | veja 7.10 | `avatarCatalog.ts` |

Depois de mudar qualquer valor, reinicie o servidor (`npm run dev` faz isso sozinho ao salvar).

---

## 8. API REST

- Todas as rotas `/api` respondem JSON. Mutações (POST) exigem `Content-Type: application/json`.
- **Acesso:** *Público*, *Login* (sessão válida) ou *Login + facção* (já escolheu a facção).
- Erros: `{ "erro": "codigo", "mensagem": "texto" }` (códigos na seção 8.3).
- O front chama tudo pela função `api()` de `common.js`.

### 8.1 Rotas de API

| Método | Rota | Acesso | Corpo | Resposta (resumo) |
|---|---|---|---|---|
| POST | `/api/auth/register` | Público | `username`, `password`, `nomePersonagem?` | 201 `{ ok, redirect:'/faction' }` |
| POST | `/api/auth/login` | Público | `username`, `password` | `{ ok, redirect }` (destino conforme facção/avatar) |
| POST | `/api/auth/logout` | Público | — | `{ ok, redirect:'/login' }` |
| GET | `/api/faction/options` | Login | — | `{ faccoes:[{ chave, titulo, descricao, bonus }] }` |
| POST | `/api/faction/choose` | Login | `faccao` | `{ ok, redirect:'/avatar' }` |
| GET | `/api/avatar` | Login + facção | — | `{ faccao, atual, avatares:[{ id, nome, url }] }` |
| POST | `/api/avatar` | Login + facção | `avatarId` | `{ ok, mensagem, redirect:'/profile' }` |
| GET | `/api/character` | Login + facção | — | Perfil completo (abaixo) |
| POST | `/api/character/train` | Login + facção | `atributo` | Perfil atualizado |
| POST | `/api/character/spend-point` | Login + facção | `atributo` | Perfil atualizado |
| POST | `/api/character/dev/gold` | Login + facção | — | +500 ouro (**só fora de produção**) |
| GET | `/api/inventory` | Login + facção | — | `{ itens:[{ id, equipado, item, precoPago, valorVenda, bloqueio }], ocupados }` |
| POST | `/api/inventory/:id/equip` | Login + facção | — | `{ ok, perfil }` |
| POST | `/api/inventory/:id/unequip` | Login + facção | — | `{ ok, perfil }` |
| POST | `/api/inventory/:id/use` | Login + facção | — | `{ ok, mensagem, perfil }` (poção) |
| POST | `/api/inventory/:id/sell` | Login + facção | — | `{ ok, mensagem, perfil }` |
| GET | `/api/shop` | Login + facção | — | `{ ouro, nivel, ocupados, limiteInventario, itens:[... , bloqueio] }` |
| POST | `/api/shop/buy` | Login + facção | `itemId` | `{ ok, mensagem, perfil }` |
| GET | `/api/hideout` | Login + facção | — | `{ ouro, estruturas:[...], mina:{ acumulado, capacidade, porHora, cheia } }` |
| POST | `/api/hideout/upgrade` | Login + facção | `estrutura` (`cripta`, `muralha`, `mina`, `tesouro`, `altar`) | `{ ok, mensagem, esconderijo }` |
| POST | `/api/hideout/collect` | Login + facção | — | `{ ok, mensagem, esconderijo }` |
| GET | `/api/hunt/monsters` | Login + facção | — | `{ custoPA, pa, monstros:[...] }` |
| POST | `/api/hunt` | Login + facção | — | `{ relatorio, perfil }` |
| GET | `/api/arena/targets` | Login + facção | — | `{ custoPA, cooldownMinutos, pa, alvos, ranking }` |
| POST | `/api/arena/attack` | Login + facção | `alvoId` | `{ relatorio, perfil }` |
| GET | `/api/arena/history` | Login + facção | — | `{ batalhas:[...] }` (últimas 10) |

**Regras do cadastro:** `username` com 3–20 caracteres (letras, números e `_`); `password` com 8–72 caracteres;
`nomePersonagem` com 3–24 caracteres (letras, números, `_` e espaço; padrão = o `username`).

**Formato do perfil** (`GET /api/character`):

```json
{
  "modoDev": true,
  "personagem": { "nome": "...", "faccao": "vampiro", "avatar": "/static/images/avatars/vampire_1.svg",
                  "nivel": 1, "xp": 0, "xpProximoNivel": 100, "ouro": 200, "honra": 0, "pontosLivres": 0,
                  "pa": 50, "paMax": 50, "segundosProximoPA": 0 },
  "atributos": [ { "chave": "forca", "rotulo": "Força", "base": 5, "bonus": 2, "total": 7, "custo": 50 } ],
  "derivados": { "pv": 70, "ataque": 14, "esquiva": 8, "reducaoDano": 7 },
  "efeitos": [ { "nome": "Poção de Fúria", "segundosRestantes": 1500, "bonus": { "forca": 3 } } ]
}
```

### 8.2 Páginas (HTML)

| Rota | Acesso | Comportamento |
|---|---|---|
| `/` | — | Redireciona para `/login`, `/faction`, `/avatar` ou `/profile` (função `destinoInicial`) |
| `/login` | Público | Se já houver sessão, redireciona para `/` |
| `/faction` | Login | Só aparece se ainda não escolheu facção; senão vai para `/profile` |
| `/avatar` | Login + facção | Escolha ou troca de avatar |
| `/profile`, `/village`, `/hideout`, `/hunt`, `/arena` | Login + facção | Sem login vai para `/login`; sem facção vai para `/faction` |

### 8.3 Códigos de erro

| Status | Códigos |
|---|---|
| 400 | `alvo_invalido`, `atributo_invalido`, `auto_ataque`, `avatar_invalido`, `dados_invalidos`, `estrutura_invalida`, `faccao_invalida`, `id_invalido`, `inventario_cheio`, `item_invalido`, `nada_a_coletar`, `nao_consumivel`, `nao_equipavel`, `nao_vendavel`, `nivel_maximo`, `nome_invalido`, `ouro_insuficiente`, `pa_insuficiente`, `sem_pontos`, `senha_invalida`, `usuario_invalido` |
| 401 | `credenciais_invalidas`, `nao_autenticado` |
| 403 | `avatar_outra_faccao`, `cripta_insuficiente`, `faccao_incompativel`, `faccao_pendente`, `mesma_faccao`, `nivel_insuficiente` |
| 404 | `alvo_inexistente`, `item_inexistente`, `item_nao_encontrado`, `personagem_inexistente`, `nao_encontrado` (rota de API inexistente) |
| 409 | `estado_mudou`, `faccao_ja_escolhida`, `item_ja_equipado`, `item_nao_equipado`, `ja_existe`, `pa_cheio`, `slot_ocupado` |
| 415 | `content_type` |
| 429 | `cooldown_alvo` |
| 500 | `efeito_invalido`, `erro_interno` |

`estado_mudou` significa que o estado do personagem mudou durante a operação (outra requisição ganhou a corrida);
basta tentar de novo.

---

## 9. Front-end

HTML puro servido pelo Express, com um script por tela. Sem framework e sem `innerHTML`.

| Página (`views/`) | Script (`public/js/`) | Função |
|---|---|---|
| `login.html` | `login.js` | Abas Entrar / Criar conta |
| `faction.html` | `faction.js` | Duas metades de tela: Vampiro e Lobisomem |
| `avatar.html` | `avatar.js` | Grade de 4 avatares e botão "Salvar Avatar" |
| `profile.html` | `profile.js` | Status, atributos, treino, inventário, efeitos, histórico |
| `village.html` | `village.js` | Abas Mercado e Meu inventário |
| `hideout.html` | `hideout.js` | Mina com contador ao vivo e as 5 construções |
| `hunt.html` | `hunt.js` | Botão Caçar, monstros da região e relatório |
| `arena.html` | `arena.js` | Alvos, relatório, ranking e histórico |

### `common.js` (compartilhado)

| Função | Para quê |
|---|---|
| `api(caminho, metodo, corpo)` | `fetch` JSON; se vier 401 (fora do login), redireciona para `/login`; erros viram `Error` com a mensagem do servidor |
| `el(tag, props, ...filhos)` | Cria elementos sem `innerHTML` (nomes de jogador e itens nunca são lidos como HTML) |
| `aviso(msg, tipo)` | Mensagem temporária (`#toast`) |
| `montarNav(atual)` | Menu: Perfil, Vila, Esconderijo, Caça, Arena |
| `formatarTempo`, `textoPA`, `sinal` | Formatação |
| `renderRounds`, `renderBarraVida`, `renderHistorico` | Relatórios de combate e histórico |
| `renderInventarioItens`, `renderEfeitos` | Inventário (perfil e Vila) e poções ativas |

### Tema e estilo (`public/css/style.css`)

- **Tokens** (variáveis CSS): `--noite`, `--noite-2`, `--pedra`, `--linha`, `--osso`, `--osso-fraco`, `--sangue`,
  `--ambar`, `--ok`, `--erro`, `--accent`.
- **Tema por facção:** `body[data-faccao="vampiro"]` usa carmesim e `body[data-faccao="lobisomem"]` usa âmbar.
  O script de cada tela define `document.body.dataset.faccao` ao carregar os dados.
- **Componentes:** `.pagina`, `.painel`, `.grade`, `.btn` (`.btn-ghost`, `.negado` para ação indisponível em
  vermelho), `.item`, `.cartao-item`, `.mercado-grid`, `.avatar-*`, `.barra`.
- **Regras:** como o CSP é `default-src 'self'`, **não use `style="..."` nem `<script>` inline** nos HTML.
  Larguras dinâmicas são definidas por JavaScript (`elemento.style.width`), que o CSP permite.

### Comportamentos de interface

- Botões indisponíveis (sem ouro, nível ou PA) ficam desativados; o motivo aparece escrito, em vermelho.
- Depois de cada ação, a tela **recarrega o estado do servidor**, que é a fonte da verdade.
- O contador da mina é extrapolado no navegador só para acompanhar a produção; o ouro coletado é sempre o
  que o servidor calcula.
- Vender um item pede confirmação (e avisa quando o item está equipado e perderá o bônus).

---

## 10. Segurança

### O que está implementado

| Medida | Como |
|---|---|
| Senhas | bcrypt (custo 12); comparação com hash falso quando o usuário não existe (evita revelar contas pelo tempo de resposta) |
| Sessão | Cookie `httpOnly`, `sameSite=lax`, `secure` em produção; ID de sessão **regenerado** a cada login |
| CSRF (básico) | `sameSite=lax` + mutações só em JSON (um formulário de outro site não consegue enviar) |
| Cabeçalhos | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, CSP `default-src 'self'`, sem `X-Powered-By` |
| SQL | Sempre parametrizado; nome de coluna dinâmico só vem de listas fixas |
| XSS | Telas montadas com `textContent`/`createElement`; CSP bloqueia scripts e estilos inline |
| Autorização | Todo acesso a item, avatar, alvo e estrutura confere o **dono/facção no banco**, nunca no cliente |
| Valores críticos | Preço, custo, saldo, nível, PA e resultado de combate são calculados **só no servidor** |
| Concorrência | Transações imediatas e `UPDATE` condicional (sem ouro negativo, sem evolução dupla, sem facção trocada) |
| Entrada | Corpo JSON limitado a 10 KB; validação de tipo e formato em todos os campos |
| Produção | `SESSION_SECRET` obrigatório; sem contas de teste; sem rota de ouro de teste |

### O que ainda **não** existe

- **Limite de tentativas de login** (rate limit): quem tem o link pode ficar tentando senhas.
- **Sessão persistente:** o armazenamento é em memória, então reiniciar o servidor desloga todos.
- **`trust proxy`:** atrás de HTTPS de hospedagem, é preciso `app.set('trust proxy', 1)` no `server.ts`;
  sem isso o cookie `secure` não é gravado e o login falha.
- **Auditoria de segurança** externa e testes automatizados.
- **Recuperação de senha** e confirmação de e-mail (o cadastro não usa e-mail).

### Checklist antes de expor na internet

1. Definir `NODE_ENV=production` e um `SESSION_SECRET` longo e aleatório.
2. Adicionar `app.set('trust proxy', 1)` e limite de tentativas de login.
3. Guardar o banco em local **persistente** (`DB_PATH`) e fazer backup do arquivo.
4. Trocar o armazenamento de sessão por um persistente.
5. Servir apenas por HTTPS.
6. Não publicar credenciais, tokens ou links temporários no repositório.

---

## 11. Operação: Git, túnel e Codespaces

Os comandos abaixo são para o **PowerShell** do Windows (terminal integrado do VS Code: `` Ctrl+` ``).
Copie apenas os comandos, **sem o `>>`** que o PowerShell mostra quando uma linha continua.

### 11.1 Git e GitHub

**Primeira vez** (já feito neste projeto; serve de referência para outro computador):

```powershell
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
git init
git add .
git status
git commit -m "Primeira versão do VampVS"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/vampvs.git
git push -u origin main
```

- Use no `user.email` o e-mail da conta do GitHub (ou o e-mail `noreply` que o GitHub mostra em Settings, Emails).
- Antes do `commit`, o `git status` **não deve** listar `node_modules/` nem `data/vampvs.db` (o `.gitignore` já
  cuida disso).
- Os avisos `LF will be replaced by CRLF` do Windows são inofensivos.
- Na primeira vez abre uma janela de login do GitHub no navegador; autorize.

**Para atualizar o repositório daqui para frente**

A cada rodada de mudanças, no terminal da pasta:

```powershell
git add .
git commit -m "Descreva o que mudou"
git push
```

Também dá pelo painel **Source Control** do VS Code (`Ctrl+Shift+G`): escreva a mensagem, **Commit**, depois
**Sync Changes**.

- **Não precisa pausar o `npm run dev`** para fazer commit e push. Abra um segundo terminal (botão `+` do
  painel) e rode os comandos lá. O Git só lê os arquivos.
- O banco (`data/vampvs.db`) **não vai para o GitHub**: cada ambiente (seu PC, Codespaces) tem o seu.
- Se o projeto estiver numa pasta do **OneDrive**, a sincronização pode deixar tudo lento e, raramente, corromper
  a pasta oculta `.git`. O mais seguro é mover o projeto para fora do OneDrive (ex.: `C:\projetos\vampvs`).

### 11.2 Reinícios automáticos

O `npm run dev` observa os arquivos `.ts` e **reinicia o servidor a cada salvamento**. Como as sessões ficam na
memória, **todo mundo é deslogado** e precisa entrar de novo. Mudanças só nas telas (`views/`, `public/`) não
reiniciam o servidor (basta atualizar a página com `Ctrl+F5`).

Se não quiser reinícios automáticos: pare o `npm run dev` e use `npm run build` seguido de `npm start`. Aí o
servidor só reinicia quando você mandar.

### 11.3 Compartilhar pelo seu PC com túnel (Cloudflare)

Um "túnel" cria um endereço público (`https://....trycloudflare.com`) que aponta para o jogo rodando no seu PC.
Não exige conta, nem pagamento, nem alterar o código. Só a porta 3000 é exposta (o túnel conecta de dentro para
fora; não abre porta no roteador).

**Resumo para subir o túnel**

Em um terminal, deixe o jogo rodando:

```powershell
npm run dev
```

Em um segundo terminal:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Se o `cloudflared` ainda não estiver instalado, rode antes

```powershell
winget install --id Cloudflare.cloudflared
```

e reabra o terminal. Copie o endereço `https://....trycloudflare.com` que ele mostrar e envie para a pessoa.
Antes de enviar, abra o link você mesmo e entre com `teste1` / `123456789` para confirmar que funciona.

Lembre de usar o `Ctrl+C` no terminal do túnel quando terminar, para o link parar de funcionar.

**Se o terminal do jogo "fica preso":** é normal, ele está rodando o servidor. Não aperte `Ctrl+C` nele. Abra um
**segundo terminal** (botão `+` do painel, ou `` Ctrl+Shift+` ``) para o túnel.

**Servidor e túnel do meu PC: se o `cloudflared` não for reconhecido**

- **Jeito 1:** rodar a linha do PATH e depois o túnel. Primeiro cole esta linha inteira (ela não mostra nada
  quando dá certo):

  ```powershell
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  ```

  Depois rode o túnel:

  ```powershell
  cloudflared tunnel --url http://localhost:3000
  ```

  Esse ajuste vale só para o terminal em que foi colado.

- **Jeito 2:** fechar a **janela inteira** do VS Code e abrir de novo. Os terminais novos passam a enxergar o
  `cloudflared` sem ajuste.

- **Jeito 3:** caminho completo, se os outros falharem:

  ```powershell
  & "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000
  ```

**O meu túnel caiu, como fazer ele voltar?**

O endereço antigo **não volta**: os túneis rápidos mudam de endereço toda vez que são criados e não têm garantia
de funcionamento contínuo. Suba um novo e mande o novo link.

1. **Veja se o jogo ainda está rodando.** Abra `http://localhost:3000` no navegador. Se não abrir, rode
   `npm run dev` em um terminal e espere aparecer `VampVS rodando em http://localhost:3000`.
2. **Veja o terminal do túnel.** Se ele ainda está aberto e com erro, ou o processo terminou, aperte `Ctrl+C` e
   rode o comando de novo. Se você fechou o terminal, abra um novo.
3. **Suba o túnel.** Se o `cloudflared` não for reconhecido neste terminal, use o caminho completo:

   ```powershell
   & "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000
   ```

4. **Copie o novo endereço** (`https://....trycloudflare.com`), teste você mesmo e envie.

O que costuma derrubar o túnel: fechar o terminal do túnel ou o VS Code, o PC entrar em suspensão, queda ou troca
de rede, ou o jogo (`npm run dev`) ter parado (o túnel fica aberto, mas o link mostra erro). Deixe o PC sem
suspender enquanto alguém testa.

**Links de túnel já usados (temporários, já expiraram)**

```
https://therefore-walk-opera-internet.trycloudflare.com/login
https://spa-specifically-classroom-simply.trycloudflare.com
```

> Cada túnel gera um endereço novo; esses dois não funcionam mais. **Não publique link de túnel em repositório
> público**: qualquer pessoa que o abrir entra no jogo rodando no seu PC. Se este arquivo for para um repositório
> público, apague esta lista.

**Cuidados ao compartilhar**

- Mande o link só para quem você confia. Quem tiver o link entra no jogo, e as contas `teste1` a `teste6`
  existem com senha conhecida.
- Defina um segredo de sessão próprio antes de iniciar (`$env:SESSION_SECRET="..."; npm run dev`).
- Peça que a pessoa **não reutilize uma senha real** ao criar conta: é um protótipo sem auditoria e sem limite de
  tentativas de login.
- Mudanças em arquivos `.ts` reiniciam o servidor e desconectam quem estiver testando (basta entrar de novo).
- Encurtadores de link não resolvem o endereço que muda (o destino continua sendo o do túnel); só valem se
  permitirem editar o destino.

### 11.4 Compartilhar pelo servidor do GitHub (Codespaces)

O Codespaces roda o jogo numa máquina do GitHub, então o seu PC pode ficar desligado. O **GitHub Pages não
serve** para este projeto: ele só hospeda arquivos estáticos, sem servidor nem banco.

**Como fazer, se quiser tentar**

1. No repositório do jogo no GitHub, clique no botão verde **Code**, depois na aba **Codespaces** e em
   **Create codespace on main**.
2. Espere o editor abrir no navegador. No terminal dele, rode:

   ```bash
   npm install
   npm run dev
   ```

3. Abra a aba **Portas** (Ports), clique com o botão direito na porta **3000**, escolha **Port Visibility** e
   depois **Public**.
4. Copie o endereço da coluna "Endereço local" e envie. Teste você mesmo antes (de preferência numa janela
   anônima).
5. Quando acabar, pare o codespace pela página `github.com/codespaces` (três pontinhos, **Stop codespace**) para
   não gastar a cota.

**Se você mudar o código depois**

O codespace tem sua própria cópia do projeto. Para as mudanças feitas no seu PC chegarem lá:

1. No seu PC: `git add .`, `git commit -m "mensagem"` e `git push`.
2. No terminal do codespace: `git pull`. O servidor reinicia sozinho e desloga quem estiver testando, que é só
   entrar de novo.

**Onde ver quanto você já usou (cota gratuita)**

Abra `github.com/settings/billing` e procure a seção **Codespaces**. Na conta gratuita, a cota mensal costuma ser de
**120 horas de núcleo** (cerca de 60 horas numa máquina de 2 núcleos) e **15 GB-mês de armazenamento**; confira os
valores atuais, porque mudam. O painel pode mostrar só valores em dólar: `$0` em "Billable usage" significa que
nada será cobrado. Sem cartão cadastrado, o uso é bloqueado quando a cota acaba, em vez de cobrado.

**Como gastar menos:** pare o codespace ao terminar; reduza o tempo de inatividade nas configurações (o padrão é
30 minutos); apague codespaces que não usa mais (o armazenamento conta mesmo parado).

**Diferenças em relação ao seu PC:** o banco do codespace é separado do banco local (contas e progresso criados
lá não aparecem no jogo local, e vice-versa). Porta pública é acessível a quem tiver o link, com o mesmo risco do
túnel. Não publique o link no repositório.

### 11.5 Comparativo: formas de deixar outra pessoa testar

| Forma | Esforço | Custo | Fica no ar | Observações |
|---|---|---|---|---|
| Túnel Cloudflare | 5 min | Grátis | Só com o seu PC, servidor e túnel abertos | Endereço muda a cada túnel |
| Codespaces | 10 min | Grátis até a cota | Só com o codespace ligado | PC pode ficar desligado; banco separado |
| Hostinger gerenciada (Node.js) | Algumas horas | Pago | Sim | Confirmar persistência do banco e instalação do `better-sqlite3` |
| Hostinger VPS | Meio dia ou mais | Pago | Sim | Você administra o servidor; melhor encaixe técnico para o SQLite |
| Render e similares (plano grátis) | 1–2 horas | Grátis | Dorme sem uso | Disco efêmero: **o banco some** a cada reinício ou deploy |

### 11.6 Hospedagem permanente: ajustes necessários

Para deixar o jogo no ar de verdade (Hostinger, Render, Railway, Fly.io...):

1. Acrescentar `app.set('trust proxy', 1)` em `src/server.ts` (senão o cookie de login não é gravado atrás do HTTPS).
2. Definir `NODE_ENV=production` e `SESSION_SECRET` (frase longa e aleatória).
3. Comando de build: `npm install --include=dev && npm run build` (com `NODE_ENV=production`, o `npm install` comum
   pula o TypeScript e o build falha). Comando de início: `npm start`. A plataforma informa a porta em `PORT`
   (o jogo já lê essa variável).
4. Apontar `DB_PATH` para um disco **persistente** (fora da pasta que o deploy substitui).
5. Adicionar limite de tentativas de login e, de preferência, sessão persistente.
6. Lembrar que, em produção, **não existem** contas de teste nem o botão de ouro: quem testa cria a própria conta.

---

## 12. Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `error: key does not contain a section: ...` ao configurar o Git | Faltou o nome da chave | Use `git config --global user.name "Seu Nome"` e `git config --global user.email "seu@email.com"` |
| `O termo '>>' não é reconhecido` | O `>>` foi copiado junto com o comando | Copie só o comando, sem o `>>` |
| `error: remote origin already exists` | O remoto já foi adicionado | Não repita o `git remote add`; só rode `git push -u origin main` |
| `Invalid username or token. Password authentication is not supported` | O GitHub não aceita senha da conta no Git | (1) Publicar pelo painel Source Control do VS Code e autorizar no navegador; (2) apagar as entradas `git:https://github.com` no **Gerenciador de Credenciais** do Windows e tentar de novo; (3) usar um *Personal access token (classic)* com a permissão `repo` como senha |
| `Valor de argumento obrigatório, mas nenhum encontrado: "--id"` | Comando do `winget` cortado | Use tudo em uma linha: `winget install --id Cloudflare.cloudflared` |
| `cloudflared` não é reconhecido | O terminal não enxerga o programa recém-instalado | Veja os Jeitos 1, 2 e 3 na seção 11.3 |
| Terminal "preso" mostrando `VampVS rodando em ...` | É o servidor rodando (normal) | Abra um segundo terminal (botão `+`) para os outros comandos |
| O link do túnel parou de funcionar | Túnel fechado, PC suspenso, rede caiu ou jogo parado | Seção 11.3, "O meu túnel caiu" |
| Link abre, mas dá erro | O `npm run dev` não está rodando | Rode `npm run dev` e confira `http://localhost:3000` |
| Link novo ainda "não encontrado" | O endereço demora um pouco para ficar acessível | Espere cerca de 1 minuto e atualize |
| Todos foram deslogados de repente | Salvar um arquivo `.ts` reinicia o servidor (sessões em memória) | Entrar de novo; ou usar `npm run build` + `npm start` |
| Botão (Sair, Comprar, Evoluir, Equipar) **invisível** com personagem lobisomem | Texto escuro sobre fundo escuro por uma regra de CSS do tema âmbar | Corrigido: a regra é `body[data-faccao="lobisomem"] .btn:not(.btn-ghost):not(.negado)` em `style.css`. Se voltar, confira essa linha e use `Ctrl+F5` |
| Mudanças no CSS/JS não aparecem | Cache do navegador | `Ctrl+F5` |
| `EADDRINUSE` (porta em uso) | Já há um servidor na porta 3000 | Feche o outro terminal ou use `$env:PORT="3001"; npm run dev` |
| Erro ao instalar `better-sqlite3` | Versão antiga do Node | Instale o Node 20 LTS ou mais novo |
| `teste1` não existe | Contas de teste só são criadas fora de produção e se `SEED_TESTE` não for `0` | Veja a mensagem no terminal ao iniciar; ou crie a conta manualmente |
| Arena sem alvos | Não há jogador da facção oposta | Use `teste1` e `teste4`, ou crie outra conta da outra facção |
| Quero zerar tudo | — | Pare o servidor e apague `data/vampvs.db` (e `.db-wal`, `.db-shm`) |
| Projeto lento ou erros estranhos de Git | Pasta dentro do OneDrive | Mova o projeto para fora do OneDrive |

---

## 13. Limitações conhecidas e próximos passos

### Limitações atuais

- Sessões em memória (reiniciar o servidor desloga todos).
- Sem limite de tentativas de login e sem `trust proxy` (necessário atrás de HTTPS).
- Sem testes automatizados no repositório (as regras foram verificadas com scripts avulsos durante o desenvolvimento).
- Derrota na caça só custa o PA (não existe vida persistente nem cura).
- A "Poção de Vida" dá um bônus temporário de Vitalidade, não cura.
- Vários jogadores podem atacar a mesma vítima em sequência (cada um respeita o próprio cooldown).
- Avatares são placeholders em SVG, exibidos só no perfil (não aparecem na arena nem no ranking).
- O papel da Cripta (limitar as demais construções) foi uma interpretação de "nível geral da base".

### Ideias de próximos passos

1. **Vida persistente e cura** (a Poção de Vida passaria a curar de verdade).
2. **Escudo anti-abuso** na arena para quem acabou de ser derrotado.
3. **Clãs ou guildas**, com ranking por clã.
4. **Missões diárias** (ouro e XP) para dar motivo de voltar todo dia.
5. **Hospedagem fixa** (com sessão persistente, limite de login e banco em disco persistente).
6. **Avatares** na arena e no ranking, e arte final no lugar dos placeholders.

---

## Apêndice: histórico do desenvolvimento

| Fase | O que foi entregue |
|---|---|
| 1 | Autenticação, escolha de facção, perfil/status com treino, inventário e equipamentos |
| 2 | Caça (PvE) com Pontos de Ação e Arena (PvP), nível e pontos livres |
| 3 | Vila/Mercador: catálogo, compra, equipar por tipo, poções, venda rápida |
| 4 | Esconderijo: Cripta, Muralha, Mina, Tesouro e Altar |
| 5 | Contas de teste automáticas (`teste1` a `teste6`) |
| 6 | Publicação no GitHub e formas de compartilhar (túnel Cloudflare, Codespaces) |
| 7 | Seleção de avatares por facção |

Para manter esta documentação atualizada, revise as seções 7 (regras), 8 (API) e 6 (banco) sempre que mudar
valores de balanceamento, rotas ou tabelas.
