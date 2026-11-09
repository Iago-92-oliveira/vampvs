const $ = (id) => document.getElementById(id);
const TEXTO_FACCAO = {
  vampiro: 'Escolha o rosto do seu vampiro. Os avatares de outras facções não estão disponíveis para você.',
  lobisomem: 'Escolha o rosto do seu lobisomem. Os avatares de outras facções não estão disponíveis para você.',
};

let avatares = [];
let atual = null;      // avatar já salvo (null no primeiro acesso)
let escolhido = null;  // seleção na tela

function render() {
  $('grade').replaceChildren(
    ...avatares.map((a) => el('button', {
      class: `avatar-opcao${a.id === escolhido ? ' selecionado' : ''}`,
      type: 'button',
      role: 'radio',
      'aria-checked': String(a.id === escolhido),
      onclick: () => { escolhido = a.id; render(); },
    },
      el('img', { src: a.url, alt: '', width: '256', height: '256' }),
      el('span', { class: 'avatar-nome' }, a.nome),
    )),
  );
  const sel = avatares.find((a) => a.id === escolhido);
  $('selecionado-nome').textContent = sel ? `Selecionado: ${sel.nome}` : 'Clique em uma imagem para escolher.';
  $('btn-salvar').disabled = !sel;
}

async function carregar() {
  const d = await api('/api/avatar');
  document.body.dataset.faccao = d.faccao;
  avatares = d.avatares;
  atual = d.atual;
  escolhido = d.atual;
  $('subtitulo').textContent = TEXTO_FACCAO[d.faccao];
  $('link-voltar').classList.toggle('oculto', !atual); // quem já tem avatar pode desistir de trocar
  render();
}

$('btn-salvar').addEventListener('click', async () => {
  $('btn-salvar').disabled = true;
  try {
    // O servidor valida de novo se o avatar pertence à facção do personagem.
    const r = await api('/api/avatar', 'POST', { avatarId: escolhido });
    location.href = r.redirect || '/profile';
  } catch (e) {
    aviso(e.message, 'erro');
    $('btn-salvar').disabled = false;
  }
});

carregar().catch((e) => aviso(e.message, 'erro'));
