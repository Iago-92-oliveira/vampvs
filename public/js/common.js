// Utilitários compartilhados pelas telas.

async function api(caminho, metodo = 'GET', corpo) {
  const opcoes = { method: metodo, credentials: 'same-origin', headers: {} };
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  } else if (metodo !== 'GET') {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = '{}';
  }
  const res = await fetch(caminho, opcoes);
  let dados = {};
  try { dados = await res.json(); } catch (_) { /* resposta sem corpo */ }

  // Sessão expirada: volta ao login (exceto na própria tela de login).
  if (res.status === 401 && !caminho.startsWith('/api/auth/')) {
    location.href = '/login';
    throw new Error('nao_autenticado');
  }
  if (!res.ok) {
    const erro = new Error(dados.mensagem || 'Erro inesperado.');
    erro.codigo = dados.erro;
    throw erro;
  }
  return dados;
}

// Cria elementos sem innerHTML: nomes de personagem e itens nunca são interpretados como HTML (anti-XSS).
function el(tag, props = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const f of filhos.flat()) {
    if (f == null || f === false) continue;
    n.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return n;
}

let toastTimer;
function aviso(mensagem, tipo = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = mensagem;
  t.className = `visivel ${tipo}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 3500);
}

/* ===================== Componentes compartilhados (perfil, caça, arena) ===================== */

function montarNav(atual) {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const links = [['profile', 'Perfil', '/profile'], ['village', 'Vila', '/village'], ['hideout', 'Esconderijo', '/hideout'], ['hunt', 'Caça', '/hunt'], ['arena', 'Arena', '/arena']];
  nav.replaceChildren(
    ...links.map(([chave, rotulo, href]) =>
      el('a', { href, class: 'nav-link', 'aria-current': chave === atual ? 'page' : false }, rotulo)),
  );
}

function formatarTempo(segundos) {
  if (segundos <= 0) return 'agora';
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

function textoPA(pa) {
  if (pa.pa >= pa.paMax) return `${pa.pa} / ${pa.paMax} (cheio)`;
  return `${pa.pa} / ${pa.paMax} (+1 em ${formatarTempo(pa.segundosProximoPA)})`;
}

function sinal(n) { return n > 0 ? `+${n}` : String(n); }

/** Lista de rounds dentro de um <details>. nomeA = quem iniciou, nomeD = defensor/monstro. */
function renderRounds(rounds, nomeA, nomeD) {
  return el('details', { class: 'rounds' },
    el('summary', {}, `Ver os ${rounds.length} golpes do combate`),
    el('ol', {}, rounds.map((r) => {
      const quem = r.atacante === 'A' ? nomeA : nomeD;
      const alvo = r.atacante === 'A' ? nomeD : nomeA;
      const texto = r.acertou ? `${quem} acerta ${alvo} e causa ${r.dano} de dano.` : `${quem} erra o golpe em ${alvo}.`;
      return el('li', { class: r.acertou ? '' : 'fraco' }, `${texto} (vida: ${nomeA} ${r.hpA}, ${nomeD} ${r.hpD})`);
    })),
  );
}

function renderBarraVida(nome, hp, hpMax) {
  const pct = hpMax > 0 ? Math.round((hp / hpMax) * 100) : 0;
  const barra = el('div', { class: 'barra barra-vida' }, el('span'));
  barra.firstChild.style.width = `${pct}%`;
  return el('div', { class: 'vida' }, el('div', { class: 'vida-texto' }, `${nome}: ${hp} / ${hpMax}`), barra);
}

function renderHistorico(raiz, batalhas) {
  if (batalhas.length === 0) {
    raiz.replaceChildren(el('p', { class: 'vazio' }, 'Nenhuma batalha ainda. Vá caçar ou desafie alguém na arena.'));
    return;
  }
  raiz.replaceChildren(
    ...batalhas.map((b) => {
      const titulo = b.tipo === 'pve'
        ? `Caça: ${b.venceu ? 'venceu' : 'perdeu para'} ${b.oponente}`
        : b.papel === 'atacante'
          ? `Você atacou ${b.oponente} e ${b.venceu ? 'venceu' : 'perdeu'}`
          : `${b.oponente} atacou você e você ${b.venceu ? 'venceu' : 'perdeu'}`;
      const partes = [];
      if (b.xp) partes.push(`${sinal(b.xp)} XP`);
      if (b.ouro) partes.push(`${sinal(b.ouro)} ouro`);
      if (b.honra) partes.push(`${sinal(b.honra)} honra`);
      return el('div', { class: `historico-item ${b.venceu ? 'vitoria' : 'derrota'}` },
        el('div', {}, titulo),
        el('div', { class: 'meta' }, [new Date(b.quando).toLocaleString('pt-BR'), partes.join(' · ')].filter(Boolean).join(' · ')),
      );
    }),
  );
}

/* ===================== Itens e inventário (perfil e vila) ===================== */

const ROTULO_TIPO = { weapon: 'Arma', armor: 'Armadura', defensive: 'Defensivo', potion: 'Poção' };
const ICONE_TIPO = { weapon: '🗡️', armor: '🛡️', defensive: '💍', potion: '🧪' };
const ROTULO_ATRIBUTO = { forca: 'Força', defesa: 'Defesa', agilidade: 'Agilidade', vitalidade: 'Vitalidade' };

function textoBonus(bonus) {
  const partes = Object.entries(bonus).filter(([, v]) => v > 0).map(([k, v]) => `+${v} ${ROTULO_ATRIBUTO[k]}`);
  return partes.join(', ') || 'Sem bônus';
}

function textoEfeito(item) {
  if (!item.efeito) return textoBonus(item.bonus);
  if (item.efeito.tipo === 'pa') return `Restaura ${item.efeito.valor} PA`;
  return `${textoBonus(item.bonus)} por ${item.efeito.duracaoMin} min`;
}

function metaItem(item) {
  const meta = [ROTULO_TIPO[item.tipo]];
  if (item.nivelMinimo > 1) meta.push(`nível ${item.nivelMinimo}`);
  if (item.faccao) meta.push(`exclusivo: ${item.faccao}`);
  return meta.join(' · ');
}

/**
 * Lista de itens do inventário. `acoes`: { onEquipar, onDesequipar, onUsar, onVender } (todas opcionais).
 * Poções iguais são agrupadas ("×3"); cada clique usa/vende uma unidade.
 */
function renderInventarioItens(raiz, itens, acoes) {
  if (itens.length === 0) {
    raiz.replaceChildren(el('p', { class: 'vazio' }, 'Seu inventário está vazio. Visite o mercado da Vila.'));
    return;
  }
  const grupos = [];
  const pocoes = new Map();
  for (const e of itens) {
    if (e.item.tipo === 'potion') {
      const g = pocoes.get(e.item.nome);
      if (g) { g.qtd += 1; continue; }
      const novo = { ...e, qtd: 1 };
      pocoes.set(e.item.nome, novo);
      grupos.push(novo);
    } else {
      grupos.push({ ...e, qtd: 1 });
    }
  }

  raiz.replaceChildren(
    ...grupos.map((e) => {
      const botoes = [];
      if (e.item.tipo === 'potion') {
        if (acoes.onUsar) botoes.push(el('button', { class: 'btn', type: 'button', onclick: () => acoes.onUsar(e.id) }, 'Usar'));
      } else if (e.equipado) {
        if (acoes.onDesequipar) botoes.push(el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => acoes.onDesequipar(e.id) }, 'Desequipar'));
      } else if (acoes.onEquipar) {
        botoes.push(el('button', { class: `btn${e.bloqueio ? ' negado' : ''}`, type: 'button', disabled: !!e.bloqueio, onclick: () => acoes.onEquipar(e.id) }, 'Equipar'));
      }
      if (acoes.onVender && e.valorVenda > 0) {
        botoes.push(el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => acoes.onVender(e) }, `Vender (${e.valorVenda})`));
      }
      return el('div', { class: `item${e.equipado ? ' equipado' : ''}` },
        el('div', {},
          el('div', { class: 'nome' }, `${ICONE_TIPO[e.item.tipo]} ${e.item.nome}`, e.qtd > 1 ? ` ×${e.qtd}` : '', e.equipado ? ' (equipado)' : ''),
          el('div', { class: 'meta' }, metaItem(e.item)),
          el('div', { class: 'bonus-lista' }, textoEfeito(e.item)),
          acoes.onVender && e.item.tipo !== 'potion' && e.valorVenda === 0 ? el('div', { class: 'meta' }, 'Item inicial: não pode ser vendido') : null,
          e.bloqueio ? el('div', { class: 'bloqueio' }, e.bloqueio) : null,
        ),
        el('div', { class: 'acoes-item' }, botoes),
      );
    }),
  );
}

function renderEfeitos(raiz, efeitos) {
  raiz.classList.toggle('oculto', efeitos.length === 0);
  raiz.replaceChildren(
    ...(efeitos.length ? [el('strong', {}, 'Efeitos ativos: ')] : []),
    ...efeitos.map((e) => el('span', { class: 'efeito' }, `${e.nome} (${Math.ceil(e.segundosRestantes / 60)} min)`)),
  );
}
