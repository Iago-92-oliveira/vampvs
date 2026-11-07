(async function () {
  const raiz = document.getElementById('faccoes');
  const { faccoes } = await api('/api/faction/options');

  for (const f of faccoes) {
    const botao = el('button', {
      class: 'metade',
      type: 'button',
      'data-faccao': f.chave,
      onclick: () => escolher(f),
    },
      el('h2', {}, f.titulo),
      el('p', {}, f.descricao),
      el('ul', {}, f.bonus.map((b) => el('li', {}, `+${b.valor} de ${b.atributo}`))),
      el('span', { class: 'escolher' }, `Tornar-me ${f.titulo.toLowerCase()}`),
    );
    raiz.append(botao);
  }

  async function escolher(f) {
    if (!confirm(`Tornar-se ${f.titulo} é permanente. Confirmar?`)) return;
    try {
      const r = await api('/api/faction/choose', 'POST', { faccao: f.chave });
      location.href = r.redirect;
    } catch (e) {
      aviso(e.message, 'erro');
    }
  }
})().catch((e) => aviso(e.message, 'erro'));
