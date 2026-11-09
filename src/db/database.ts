import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * SCHEMA
 *
 *  usuarios 1──1 personagens 1──N inventario N──1 itens
 *                    │
 *                    ├──1 esconderijo      (construções e ouro passivo)
 *                    ├──N efeitos_ativos   (buffs temporários de poções)
 *                    └──N batalhas         (PvE e PvP)
 *  monstros (catálogo da caça)
 *
 * - personagens.faccao NULL  => jogador ainda não escolheu (mostra tela de facção).
 * - inventario guarda INSTÂNCIAS: o mesmo item pode aparecer em várias linhas.
 *   preco_pago registra o que o jogador pagou (base da venda; 0 = item inicial, não vendável).
 * - CHECKs impedem ouro/atributos negativos mesmo se houver bug no código.
 * - Gatilhos: no máximo 1 item equipado por tipo, e poção nunca fica "equipada".
 */
const TABELAS = `
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  criado_em     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS personagens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  faccao      TEXT CHECK (faccao IN ('vampiro', 'lobisomem')),
  nivel       INTEGER NOT NULL DEFAULT 1   CHECK (nivel >= 1),
  xp          INTEGER NOT NULL DEFAULT 0   CHECK (xp >= 0),
  ouro        INTEGER NOT NULL DEFAULT 200 CHECK (ouro >= 0),
  forca       INTEGER NOT NULL DEFAULT 5   CHECK (forca >= 1),
  defesa      INTEGER NOT NULL DEFAULT 5   CHECK (defesa >= 1),
  agilidade   INTEGER NOT NULL DEFAULT 5   CHECK (agilidade >= 1),
  vitalidade  INTEGER NOT NULL DEFAULT 5   CHECK (vitalidade >= 1),
  pa               INTEGER NOT NULL DEFAULT 50 CHECK (pa >= 0),
  pa_atualizado_em INTEGER NOT NULL DEFAULT 0,
  pontos_livres    INTEGER NOT NULL DEFAULT 0  CHECK (pontos_livres >= 0),
  honra            INTEGER NOT NULL DEFAULT 0  CHECK (honra >= 0),
  avatar           TEXT,                       -- id do catálogo (avatarCatalog.ts); NULL = não escolhido
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS itens (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  nome               TEXT NOT NULL UNIQUE,
  descricao          TEXT NOT NULL DEFAULT '',
  tipo               TEXT NOT NULL CHECK (tipo IN ('weapon', 'armor', 'defensive', 'potion')),
  bonus_forca        INTEGER NOT NULL DEFAULT 0,
  bonus_defesa       INTEGER NOT NULL DEFAULT 0,
  bonus_agilidade    INTEGER NOT NULL DEFAULT 0,
  bonus_vitalidade   INTEGER NOT NULL DEFAULT 0,
  nivel_minimo       INTEGER NOT NULL DEFAULT 1 CHECK (nivel_minimo >= 1),
  preco_ouro         INTEGER NOT NULL DEFAULT 0 CHECK (preco_ouro >= 0),
  faccao             TEXT CHECK (faccao IN ('vampiro', 'lobisomem')),
  efeito_tipo        TEXT CHECK (efeito_tipo IN ('pa', 'buff')),
  efeito_valor       INTEGER,
  efeito_duracao_min INTEGER,
  CHECK ((tipo = 'potion') = (efeito_tipo IS NOT NULL))  -- só poções têm efeito de consumo
);

CREATE TABLE IF NOT EXISTS inventario (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  personagem_id  INTEGER NOT NULL REFERENCES personagens(id) ON DELETE CASCADE,
  item_id        INTEGER NOT NULL REFERENCES itens(id),
  equipado       INTEGER NOT NULL DEFAULT 0 CHECK (equipado IN (0, 1)),
  preco_pago     INTEGER NOT NULL DEFAULT 0 CHECK (preco_pago >= 0),
  adquirido_em   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inventario_personagem ON inventario(personagem_id);

-- Esconderijo: 1 por personagem, criado no cadastro (e preenchido para contas antigas ao iniciar o servidor).
-- ouro_acumulado + acumulado_em guardam o ouro da mina já "liquidado"; o que foi produzido desde então
-- é calculado sob demanda (sem timer). Os níveis máximos são regra do código (hideoutRules.ts).
CREATE TABLE IF NOT EXISTS esconderijo (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  personagem_id   INTEGER NOT NULL UNIQUE REFERENCES personagens(id) ON DELETE CASCADE,
  nivel_cripta    INTEGER NOT NULL DEFAULT 1 CHECK (nivel_cripta >= 1),
  nivel_muralha   INTEGER NOT NULL DEFAULT 1 CHECK (nivel_muralha >= 1),
  nivel_mina_ouro INTEGER NOT NULL DEFAULT 1 CHECK (nivel_mina_ouro >= 1),
  nivel_tesouro   INTEGER NOT NULL DEFAULT 1 CHECK (nivel_tesouro >= 1),
  nivel_altar     INTEGER NOT NULL DEFAULT 1 CHECK (nivel_altar >= 1),
  ouro_acumulado  REAL    NOT NULL DEFAULT 0 CHECK (ouro_acumulado >= 0),
  acumulado_em    INTEGER NOT NULL            -- epoch ms
);

CREATE TABLE IF NOT EXISTS efeitos_ativos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  personagem_id    INTEGER NOT NULL REFERENCES personagens(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  bonus_forca      INTEGER NOT NULL DEFAULT 0,
  bonus_defesa     INTEGER NOT NULL DEFAULT 0,
  bonus_agilidade  INTEGER NOT NULL DEFAULT 0,
  bonus_vitalidade INTEGER NOT NULL DEFAULT 0,
  expira_em        INTEGER NOT NULL  -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_efeitos_personagem ON efeitos_ativos(personagem_id);

CREATE TABLE IF NOT EXISTS monstros (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT NOT NULL UNIQUE,
  descricao     TEXT NOT NULL DEFAULT '',
  nivel         INTEGER NOT NULL CHECK (nivel >= 1),
  forca         INTEGER NOT NULL CHECK (forca >= 1),
  defesa        INTEGER NOT NULL CHECK (defesa >= 0),
  agilidade     INTEGER NOT NULL CHECK (agilidade >= 0),
  vitalidade    INTEGER NOT NULL CHECK (vitalidade >= 1),
  xp_recompensa INTEGER NOT NULL CHECK (xp_recompensa >= 0),
  ouro_min      INTEGER NOT NULL CHECK (ouro_min >= 0),
  ouro_max      INTEGER NOT NULL CHECK (ouro_max >= ouro_min)
);

-- Registro de batalhas. PvE: defensor_id NULL e monstro_* preenchidos. PvP: o inverso.
-- vencedor é do ponto de vista do combate: 'atacante' (quem iniciou) ou 'defensor'/monstro.
CREATE TABLE IF NOT EXISTS batalhas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo           TEXT NOT NULL CHECK (tipo IN ('pve', 'pvp')),
  atacante_id    INTEGER NOT NULL REFERENCES personagens(id) ON DELETE CASCADE,
  defensor_id    INTEGER REFERENCES personagens(id) ON DELETE CASCADE,
  monstro_nome   TEXT,
  monstro_nivel  INTEGER,
  vencedor       TEXT NOT NULL CHECK (vencedor IN ('atacante', 'defensor')),
  xp_ganho       INTEGER NOT NULL DEFAULT 0,
  ouro_ganho     INTEGER NOT NULL DEFAULT 0,  -- ouro que o vencedor recebeu (PvP: tirado do perdedor)
  honra_ganha    INTEGER NOT NULL DEFAULT 0,
  honra_perdida  INTEGER NOT NULL DEFAULT 0,
  criado_em      INTEGER NOT NULL             -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_batalhas_atacante ON batalhas(atacante_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_batalhas_defensor ON batalhas(defensor_id, id DESC);
`;

// Gatilhos são recriados a cada início (DROP + CREATE) para sempre refletirem a definição atual.
const GATILHOS = `
DROP TRIGGER IF EXISTS trg_um_item_por_slot;
CREATE TRIGGER trg_um_item_por_slot
BEFORE UPDATE OF equipado ON inventario
WHEN NEW.equipado = 1 AND EXISTS (
  SELECT 1
  FROM inventario outro
  JOIN itens io  ON io.id = outro.item_id
  JOIN itens ino ON ino.id = NEW.item_id
  WHERE outro.personagem_id = NEW.personagem_id
    AND outro.equipado = 1
    AND outro.id <> NEW.id
    AND io.tipo = ino.tipo
)
BEGIN
  SELECT RAISE(ABORT, 'slot_ocupado');
END;

DROP TRIGGER IF EXISTS trg_pocao_nao_equipa;
CREATE TRIGGER trg_pocao_nao_equipa
BEFORE UPDATE OF equipado ON inventario
WHEN NEW.equipado = 1 AND (SELECT tipo FROM itens WHERE id = NEW.item_id) = 'potion'
BEGIN
  SELECT RAISE(ABORT, 'pocao_nao_equipa');
END;
`;

/**
 * CATÁLOGO: fonte da verdade dos itens. É aplicado com UPSERT a cada início do servidor,
 * então ajustar preço/bônus aqui e reiniciar atualiza o banco (itens já comprados mantêm o preco_pago).
 */
type LinhaItem = readonly [
  nome: string, descricao: string, tipo: 'weapon' | 'armor' | 'defensive' | 'potion',
  forca: number, defesa: number, agilidade: number, vitalidade: number,
  nivelMin: number, faccao: 'vampiro' | 'lobisomem' | null, preco: number,
  efeitoTipo: 'pa' | 'buff' | null, efeitoValor: number | null, duracaoMin: number | null,
];

const CATALOGO: LinhaItem[] = [
  // ----- armas
  ['Espada Comum', 'Lâmina simples, mas confiável.', 'weapon', 2, 0, 0, 0, 1, null, 120, null, null, null],
  ['Adaga de Sangue', 'Fina, rápida e sempre úmida.', 'weapon', 1, 0, 2, 0, 1, 'vampiro', 150, null, null, null],
  ['Garras de Prata', 'Garras forjadas para rasgar.', 'weapon', 3, 0, 0, 0, 1, 'lobisomem', 150, null, null, null],
  ['Adaga de Prata', 'Letal contra quase tudo que anda à noite.', 'weapon', 3, 0, 1, 0, 3, null, 400, null, null, null],
  ['Montante do Carrasco', 'Exige braço de quem já sangrou muito.', 'weapon', 6, 0, 0, 0, 5, null, 1200, null, null, null],
  ['Lâmina Rúnica', 'Runas antigas aquecem o aço.', 'weapon', 8, 0, 2, 0, 10, null, 3500, null, null, null],
  // ----- armaduras
  ['Couraça de Couro', 'Couro curtido que amortece golpes.', 'armor', 0, 2, 0, 1, 1, null, 120, null, null, null],
  ['Manto das Sombras', 'Tecido que engole a luz.', 'armor', 0, 2, 1, 0, 1, 'vampiro', 150, null, null, null],
  ['Pele de Urso Cinzento', 'Pesada, quente e resistente.', 'armor', 0, 2, 0, 2, 1, 'lobisomem', 150, null, null, null],
  ['Armadura de Couro Batido', 'Camadas reforçadas com placas de ferro.', 'armor', 0, 3, 0, 2, 3, null, 450, null, null, null],
  ['Cota de Malha', 'Milhares de anéis de aço entrelaçados.', 'armor', 0, 6, 0, 3, 7, null, 1800, null, null, null],
  // ----- defensivos
  ['Anel Sombrio', 'Um anel frio que sussurra à noite.', 'defensive', 0, 1, 2, 0, 2, null, 300, null, null, null],
  ['Amuleto da Lua', 'Pende de um fio de prata e pulsa devagar.', 'defensive', 0, 0, 0, 4, 3, null, 450, null, null, null],
  ['Escudo de Ferro', 'Pesado, simples e eficiente.', 'defensive', 0, 4, 0, 0, 4, null, 600, null, null, null],
  ['Talismã Ancestral', 'Guarda a memória de mil batalhas.', 'defensive', 0, 3, 2, 3, 8, null, 2200, null, null, null],
  // ----- poções (consumíveis)
  ['Poção de Energia', 'Restaura 10 pontos de ação na hora.', 'potion', 0, 0, 0, 0, 1, null, 150, 'pa', 10, null],
  ['Poção de Vida', '+3 Vitalidade por 30 minutos.', 'potion', 0, 0, 0, 3, 1, null, 120, 'buff', null, 30],
  ['Poção de Fúria', '+3 Força por 30 minutos.', 'potion', 3, 0, 0, 0, 1, null, 120, 'buff', null, 30],
  ['Elixir de Reflexos', '+3 Agilidade por 30 minutos.', 'potion', 0, 0, 3, 0, 1, null, 120, 'buff', null, 30],
];

const MONSTROS_INICIAIS = [
  // nome, descricao, nivel, for, def, agi, vit, xp, ouro_min, ouro_max
  ['Rato Gigante', 'Infestam os esgotos e mordem qualquer coisa.', 1, 4, 2, 3, 4, 10, 10, 25],
  ['Lobo Faminto', 'Um lobo comum, mas desesperado.', 2, 7, 4, 6, 6, 20, 20, 45],
  ['Cultista Sombrio', 'Fanático armado com uma foice cerimonial.', 3, 9, 6, 7, 8, 35, 40, 80],
  ['Ghoul', 'Devorador de cadáveres, rápido e resistente.', 4, 10, 7, 6, 9, 55, 70, 130],
  ['Caçador de Bruxas', 'Mata o que não entende, com muita pontaria.', 6, 13, 9, 9, 12, 90, 120, 220],
  ['Troll das Cavernas', 'Lento, enorme e muito perigoso.', 8, 17, 12, 6, 16, 140, 200, 350],
] as const;

function colunaExiste(tabela: string, coluna: string): boolean {
  const colunas = db.prepare(`PRAGMA table_info(${tabela})`).all() as Array<{ name: string }>;
  return colunas.some((c) => c.name === coluna);
}

/** Bancos antigos: adiciona colunas novas sem perder dados. */
function migrarColunas(): void {
  const novas: Array<[string, string, string]> = [
    ['personagens', 'pa', 'INTEGER NOT NULL DEFAULT 50 CHECK (pa >= 0)'],
    ['personagens', 'pa_atualizado_em', 'INTEGER NOT NULL DEFAULT 0'],
    ['personagens', 'pontos_livres', 'INTEGER NOT NULL DEFAULT 0 CHECK (pontos_livres >= 0)'],
    ['personagens', 'honra', 'INTEGER NOT NULL DEFAULT 0 CHECK (honra >= 0)'],
    ['personagens', 'avatar', 'TEXT'],
    ['inventario', 'preco_pago', 'INTEGER NOT NULL DEFAULT 0 CHECK (preco_pago >= 0)'],
  ];
  for (const [tabela, coluna, definicao] of novas) {
    if (!colunaExiste(tabela, coluna)) db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
  }
}

/**
 * A tabela `itens` antiga tinha tipos 'arma'/'armadura' num CHECK e a coluna nivel_requerido.
 * SQLite não altera CHECK, então reconstruímos a tabela (procedimento oficial de 12 passos),
 * preservando ids para não quebrar o inventário existente.
 */
const MIGRACAO_ITENS = `
DROP TRIGGER IF EXISTS trg_um_item_por_slot;
DROP TRIGGER IF EXISTS trg_pocao_nao_equipa;
CREATE TABLE itens_novo (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  nome               TEXT NOT NULL UNIQUE,
  descricao          TEXT NOT NULL DEFAULT '',
  tipo               TEXT NOT NULL CHECK (tipo IN ('weapon', 'armor', 'defensive', 'potion')),
  bonus_forca        INTEGER NOT NULL DEFAULT 0,
  bonus_defesa       INTEGER NOT NULL DEFAULT 0,
  bonus_agilidade    INTEGER NOT NULL DEFAULT 0,
  bonus_vitalidade   INTEGER NOT NULL DEFAULT 0,
  nivel_minimo       INTEGER NOT NULL DEFAULT 1 CHECK (nivel_minimo >= 1),
  preco_ouro         INTEGER NOT NULL DEFAULT 0 CHECK (preco_ouro >= 0),
  faccao             TEXT CHECK (faccao IN ('vampiro', 'lobisomem')),
  efeito_tipo        TEXT CHECK (efeito_tipo IN ('pa', 'buff')),
  efeito_valor       INTEGER,
  efeito_duracao_min INTEGER,
  CHECK ((tipo = 'potion') = (efeito_tipo IS NOT NULL))
);
INSERT INTO itens_novo (id, nome, descricao, tipo, bonus_forca, bonus_defesa, bonus_agilidade,
                        bonus_vitalidade, nivel_minimo, preco_ouro, faccao)
SELECT id, nome, descricao,
       CASE tipo WHEN 'arma' THEN 'weapon' WHEN 'armadura' THEN 'armor' ELSE tipo END,
       bonus_forca, bonus_defesa, bonus_agilidade, bonus_vitalidade, nivel_requerido, 0, faccao
  FROM itens;
DROP TABLE itens;
ALTER TABLE itens_novo RENAME TO itens;
`;

function migrarItens(): void {
  if (colunaExiste('itens', 'preco_ouro')) return; // já está no formato novo
  db.pragma('foreign_keys = OFF'); // exigido pelo procedimento; precisa ficar fora da transação
  try {
    db.transaction(() => db.exec(MIGRACAO_ITENS))();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function aplicarCatalogo(): void {
  const upsert = db.prepare(
    `INSERT INTO itens
       (nome, descricao, tipo, bonus_forca, bonus_defesa, bonus_agilidade, bonus_vitalidade,
        nivel_minimo, faccao, preco_ouro, efeito_tipo, efeito_valor, efeito_duracao_min)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(nome) DO UPDATE SET
       descricao = excluded.descricao, tipo = excluded.tipo,
       bonus_forca = excluded.bonus_forca, bonus_defesa = excluded.bonus_defesa,
       bonus_agilidade = excluded.bonus_agilidade, bonus_vitalidade = excluded.bonus_vitalidade,
       nivel_minimo = excluded.nivel_minimo, faccao = excluded.faccao, preco_ouro = excluded.preco_ouro,
       efeito_tipo = excluded.efeito_tipo, efeito_valor = excluded.efeito_valor,
       efeito_duracao_min = excluded.efeito_duracao_min`,
  );
  db.transaction(() => {
    for (const i of CATALOGO) upsert.run(...i);
  })();
}

export function initDatabase(): void {
  db.exec(TABELAS);
  migrarColunas();
  migrarItens();
  db.exec(GATILHOS);
  aplicarCatalogo();

  // Contas criadas antes do Esconderijo ganham o registro agora (a mina começa a produzir a partir deste momento).
  db.exec(`INSERT OR IGNORE INTO esconderijo (personagem_id, acumulado_em)
           SELECT id, CAST(strftime('%s', 'now') AS INTEGER) * 1000 FROM personagens`);

  const { total } = db.prepare('SELECT COUNT(*) AS total FROM monstros').get() as { total: number };
  if (total === 0) {
    const insertMonstro = db.prepare(
      `INSERT INTO monstros
       (nome, descricao, nivel, forca, defesa, agilidade, vitalidade, xp_recompensa, ouro_min, ouro_max)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    db.transaction(() => {
      for (const m of MONSTROS_INICIAIS) insertMonstro.run(...m);
    })();
  }
}
