const $ = (id) => document.getElementById(id);

/* ----- abas ----- */
function abrirAba(qual) {
  const mercado = qual === 'mercado';
  $('aba-mercado').classList.toggle('oculto', !mercado);
  $('aba-inventario').classList.toggle('oculto', mercado);
  $('aba-btn-mercado').setAttribute('aria-selected', String(mercado));
  $('aba-btn-inventario').setAttribute('aria-selected', String(!mercado));
}
$('aba-btn-mercado').addEventListener('click', () => abrirAba('mercado'));
$('aba-btn-inventario').addEventListener('click', () => abrirAba('inventario'));

/* ----- mercado ----- */
function renderMercado(d) {
  $('mercado').replaceChildren(
    ...d.itens.map((i) => {
      const bloqueado = !!i.bloqueio;
      const semOuro = d.ouro < i.preco;
      return el('div', { class: `cartao-item${bloqueado ? ' indisponivel' : ''}` },
        el('div', { class: 'nome' }, `${ICONE_TIPO[i.tipo]} ${i.nome}`),
        el('div', { class: 'meta' }, metaItem(i)),
        el('div', { class: 'bonus-lista' }, textoEfeito(i)),
        el('div', { class: 'descricao' }, i.descricao),
        el('div', { class: 'aviso-bloqueio bloqueio' }, i.bloqueio || ''),
        el('div', { class: 'rodape' },
          el('span', { class: `preco${semOuro ? ' sem-ouro' : ''}` }, `${i.preco} ouro`),
          el('button', {
            class: `btn btn-compra${bloqueado ? ' negado' : ''}`,
            type: 'button',
            disabled: bloqueado,
            'aria-label': `Comprar ${i.nome} por ${i.preco} de ouro`,
            onclick: () => comprar(i.id),
          }, 'Comprar'),
        ),
      );
    }),
  );
}

/* ----- carga e ações ----- */
async function carregarTudo() {
  const [shop, inv, perfil] = await Promise.all([
    api('/api/shop'), api('/api/inventory'), api('/api/character'),
  ]);
  document.body.dataset.faccao = perfil.personagem.faccao;
  $('btn-ouro-dev').hidden = !perfil.modoDev;
  $('ouro').textContent = shop.ouro;
  $('nivel').textContent = shop.nivel;
  $('mochila').textContent = `${shop.ocupados} / ${shop.limiteInventario}`;
  renderMercado(shop);
  renderInventarioItens($('inventario'), inv.itens, {
    onEquipar: equipar, onDesequipar: desequipar, onUsar: usar, onVender: vender,
  });
  renderEfeitos($('efeitos'), perfil.efeitos || []);
}

async function acao(chamada, mensagemOk) {
  try {
    const r = await chamada();
    aviso(mensagemOk || r.mensagem || 'Pronto.', 'ok');
  } catch (e) {
    aviso(e.message, 'erro');
  }
  carregarTudo().catch(() => {}); // sempre reconcilia com o estado real do servidor
}

const comprar = (itemId) => acao(() => api('/api/shop/buy', 'POST', { itemId }));
const equipar = (id) => acao(() => api(`/api/inventory/${id}/equip`, 'POST'), 'Item equipado.');
const desequipar = (id) => acao(() => api(`/api/inventory/${id}/unequip`, 'POST'), 'Item desequipado.');
const usar = (id) => acao(() => api(`/api/inventory/${id}/use`, 'POST'));

function vender(entrada) {
  const extra = entrada.equipado ? ' Ele está equipado e perderá o bônus.' : '';
  if (!confirm(`Vender ${entrada.item.nome} por ${entrada.valorVenda} de ouro?${extra}`)) return;
  acao(() => api(`/api/inventory/${entrada.id}/sell`, 'POST'));
}

$('btn-ouro-dev').addEventListener('click', () =>
  acao(() => api('/api/character/dev/gold', 'POST'), '+500 de ouro (modo teste)'));

montarNav('village');
carregarTudo().catch((e) => aviso(e.message, 'erro'));
