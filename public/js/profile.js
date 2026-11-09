const $ = (id) => document.getElementById(id);

function renderPerfil(p) {
  const { personagem, atributos, derivados } = p;

  document.body.dataset.faccao = personagem.faccao;
  $('btn-ouro-dev').hidden = !p.modoDev;
  $('nome').textContent = personagem.nome;
  const temAvatar = !!personagem.avatar; // a URL vem do catálogo do servidor
  $('avatar').src = personagem.avatar || '/static/images/avatars/default.svg';
  $('avatar').alt = temAvatar ? `Avatar de ${personagem.nome}` : 'Sem avatar';
  $('link-avatar').textContent = temAvatar ? 'Trocar avatar' : 'Escolher avatar';
  $('faccao').textContent = personagem.faccao === 'vampiro' ? 'Vampiro' : 'Lobisomem';
  $('nivel').textContent = personagem.nivel;
  $('xp').textContent = `${personagem.xp} / ${personagem.xpProximoNivel}`;
  $('ouro').textContent = personagem.ouro;
  $('pa').textContent = textoPA(personagem);
  $('honra').textContent = personagem.honra;
  $('barra-xp').style.width = `${Math.min(100, (personagem.xp / personagem.xpProximoNivel) * 100)}%`;

  const aviso = $('aviso-pontos');
  aviso.classList.toggle('oculto', personagem.pontosLivres === 0);
  aviso.textContent = `Você tem ${personagem.pontosLivres} ponto(s) livre(s) de atributo. Use o botão "+1 ponto" sem gastar ouro.`;

  $('atributos').replaceChildren(
    ...atributos.map((a) => {
      const semOuro = personagem.ouro < a.custo;
      return el('div', { class: 'atributo' },
        el('div', {}, a.rotulo, el('span', { class: 'custo' }, `Próximo ponto: ${a.custo} de ouro`)),
        el('div', { class: 'valor' }, a.total, a.bonus > 0 ? el('span', { class: 'bonus' }, `(+${a.bonus} bônus)`) : null),
        el('div', { class: 'acoes-atributo' },
          personagem.pontosLivres > 0
            ? el('button', {
                class: 'btn btn-ponto',
                type: 'button',
                'aria-label': `Usar 1 ponto livre em ${a.rotulo}`,
                onclick: () => gastarPonto(a.chave),
              }, '+1 ponto')
            : null,
          el('button', {
            class: 'btn btn-mais',
            type: 'button',
            'aria-label': `Treinar ${a.rotulo} por ${a.custo} de ouro`,
            title: semOuro ? `Faltam ${a.custo - personagem.ouro} de ouro` : `Custa ${a.custo} de ouro`,
            disabled: semOuro,
            onclick: () => treinar(a.chave),
          }, '+'),
        ),
      );
    }),
  );

  $('derivados').replaceChildren(
    el('div', {}, 'Pontos de vida: ', el('strong', {}, derivados.pv)),
    el('div', {}, 'Ataque: ', el('strong', {}, derivados.ataque)),
    el('div', {}, 'Esquiva: ', el('strong', {}, derivados.esquiva)),
    el('div', {}, 'Redução de dano: ', el('strong', {}, derivados.reducaoDano)),
  );
  renderEfeitos($('efeitos'), p.efeitos || []);
}

function renderInventario(itens) {
  renderInventarioItens($('inventario'), itens, { onEquipar: equipar, onDesequipar: desequipar, onUsar: usar });
}

async function carregarTudo() {
  const [perfil, inv, hist] = await Promise.all([
    api('/api/character'), api('/api/inventory'), api('/api/arena/history'),
  ]);
  renderPerfil(perfil);
  renderInventario(inv.itens);
  renderHistorico($('historico'), hist.batalhas);
}

async function acao(chamada, mensagemOk) {
  try {
    const r = await chamada();
    if (mensagemOk || r.mensagem) aviso(mensagemOk || r.mensagem, 'ok');
  } catch (e) {
    aviso(e.message, 'erro');
  }
  carregarTudo().catch(() => {});
}

const treinar = (atributo) => acao(() => api('/api/character/train', 'POST', { atributo }));
const gastarPonto = (atributo) => acao(() => api('/api/character/spend-point', 'POST', { atributo }));
const equipar = (id) => acao(() => api(`/api/inventory/${id}/equip`, 'POST'));
const desequipar = (id) => acao(() => api(`/api/inventory/${id}/unequip`, 'POST'));
const usar = (id) => acao(() => api(`/api/inventory/${id}/use`, 'POST'));

$('btn-sair').addEventListener('click', async () => {
  const r = await api('/api/auth/logout', 'POST');
  location.href = r.redirect;
});

// Botão de teste: o servidor só o libera fora de produção (campo modoDev).
$('btn-ouro-dev').addEventListener('click', () =>
  acao(() => api('/api/character/dev/gold', 'POST'), '+500 de ouro (modo teste)'));

montarNav('profile');
carregarTudo().catch((e) => aviso(e.message, 'erro'));
