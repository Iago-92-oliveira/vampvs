const $ = (id) => document.getElementById(id);
const ICONES = { cripta: '⚰️', muralha: '🧱', mina: '⛏️', tesouro: '💰', altar: '🕯️' };

// Foto da mina no momento da carga. O número na tela é extrapolado a cada segundo só para
// acompanhar a produção; o ouro realmente coletado é sempre calculado pelo servidor.
let mina = null;
let cargaEm = 0;

function ouroEstimado() {
  if (!mina) return 0;
  const horas = (Date.now() - cargaEm) / 3_600_000;
  return Math.min(mina.capacidade, mina.acumulado + horas * mina.porHora);
}

function atualizarMina() {
  if (!mina) return;
  const atual = ouroEstimado();
  const inteiro = Math.floor(atual);
  const cheia = atual >= mina.capacidade;
  $('acumulado').textContent = inteiro;
  $('barra-mina').style.width = `${Math.min(100, (atual / mina.capacidade) * 100)}%`;
  $('btn-coletar').classList.toggle('oculto', inteiro < 1);
  $('btn-coletar').textContent = `Coletar ${inteiro} de ouro`;
  $('mina-dica').textContent = cheia
    ? 'A mina está cheia e parou de produzir. Colete o ouro ou aumente o Tesouro.'
    : inteiro < 1
      ? 'A mina ainda não produziu ouro suficiente para coletar.'
      : `Cheia em cerca de ${formatarTempo(Math.ceil(((mina.capacidade - atual) / mina.porHora) * 3600))}.`;
}

function renderEstruturas(lista) {
  $('estruturas').replaceChildren(
    ...lista.map((e) => {
      const bloqueado = !!e.bloqueio;
      const semOuro = e.custo !== null && e.bloqueio && e.bloqueio.startsWith('Faltam');
      return el('div', { class: `cartao-item${bloqueado ? ' indisponivel' : ''}` },
        el('div', { class: 'nome' }, `${ICONES[e.chave]} ${e.nome}`, el('span', { class: 'nivel-tag' }, `nível ${e.nivel} / ${e.nivelMax}`)),
        el('div', { class: 'descricao' }, e.descricao),
        el('div', { class: 'bonus-lista' }, `Agora: ${e.bonusAtual}`),
        e.bonusProximo ? el('div', { class: 'meta' }, `Próximo nível: ${e.bonusProximo}`) : el('div', { class: 'meta' }, 'Nível máximo alcançado'),
        el('div', { class: 'aviso-bloqueio bloqueio' }, e.bloqueio && e.bloqueio !== 'Nível máximo' ? e.bloqueio : ''),
        el('div', { class: 'rodape' },
          el('span', { class: `preco${semOuro ? ' sem-ouro' : ''}` }, e.custo === null ? '—' : `${e.custo} ouro`),
          el('button', {
            class: `btn btn-compra${bloqueado ? ' negado' : ''}`,
            type: 'button',
            disabled: bloqueado,
            'aria-label': e.custo === null ? `${e.nome} no nível máximo` : `Evoluir ${e.nome} por ${e.custo} de ouro`,
            onclick: () => evoluir(e.chave),
          }, e.custo === null ? 'Máximo' : 'Evoluir'),
        ),
      );
    }),
  );
}

function render(d) {
  $('ouro').textContent = d.ouro;
  $('por-hora').textContent = d.mina.porHora;
  $('capacidade').textContent = d.mina.capacidade;
  mina = d.mina;
  cargaEm = Date.now();
  atualizarMina();
  renderEstruturas(d.estruturas);
}

async function carregar() {
  const perfil = await api('/api/character'); // só para o tema da facção
  document.body.dataset.faccao = perfil.personagem.faccao;
  render(await api('/api/hideout'));
}

async function acao(chamada) {
  try {
    const r = await chamada();
    aviso(r.mensagem, 'ok');
    render(r.esconderijo);
  } catch (e) {
    aviso(e.message, 'erro');
    api('/api/hideout').then(render).catch(() => {}); // reconcilia com o servidor
  }
}

const evoluir = (estrutura) => acao(() => api('/api/hideout/upgrade', 'POST', { estrutura }));
$('btn-coletar').addEventListener('click', () => acao(() => api('/api/hideout/collect', 'POST')));

montarNav('hideout');
setInterval(atualizarMina, 1000);
carregar().catch((e) => aviso(e.message, 'erro'));
