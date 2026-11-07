const $ = (id) => document.getElementById(id);
let custoPA = 1;
let paAtual = null;

function atualizarPA(pa) {
  paAtual = pa;
  $('pa').textContent = textoPA(pa);
  $('btn-cacar').disabled = pa.pa < custoPA;
  $('btn-cacar').textContent = `Caçar (${custoPA} PA)`;
  $('dica').textContent = pa.pa < custoPA
    ? `Sem pontos de ação. O próximo chega em ${formatarTempo(pa.segundosProximoPA)}.`
    : 'O monstro é sorteado pelo servidor. Seus atributos e equipamentos decidem o combate.';
}

function renderMonstros(lista) {
  $('monstros').replaceChildren(
    ...lista.map((m) => el('div', { class: `monstro${m.disponivel ? '' : ' bloqueado'}` },
      el('div', {},
        el('div', { class: 'nome' }, `${m.nome} (nível ${m.nivel})`),
        el('div', { class: 'meta' }, m.descricao),
        el('div', { class: 'meta' },
          `Força ${m.forca} · Defesa ${m.defesa} · Agilidade ${m.agilidade} · Vitalidade ${m.vitalidade}`),
      ),
      el('div', { class: 'meta' },
        m.disponivel ? `${m.xp} XP · ${m.ouroMin}-${m.ouroMax} ouro` : 'Nível insuficiente'),
    )),
  );
}

function renderResultado(r) {
  const premios = [];
  if (r.vitoria) {
    premios.push(el('span', {}, 'XP: ', el('strong', {}, `+${r.xp}`)));
    premios.push(el('span', {}, 'Ouro: ', el('strong', {}, `+${r.ouro}`)));
  }
  $('resultado').replaceChildren(
    el('div', { class: `relatorio ${r.vitoria ? 'vitoria' : 'derrota'}` },
      el('h3', {}, r.vitoria ? `Vitória contra ${r.monstro.nome}!` : `Derrota para ${r.monstro.nome}.`),
      el('p', { class: 'fraco' }, `${r.monstro.descricao} (nível ${r.monstro.nivel})`),
      renderBarraVida(r.jogador.nome, r.jogador.hpFinal, r.jogador.hpMax),
      renderBarraVida(r.monstro.nome, r.monstro.hpFinal, r.monstro.hpMax),
      r.vitoria
        ? el('div', { class: 'recompensas' }, premios)
        : el('p', {}, 'Você perdeu o ponto de ação desta caçada. Treine seus atributos ou equipe itens melhores e tente de novo.'),
      r.niveisGanhos > 0
        ? el('p', { class: 'subiu-nivel' },
            `Subiu para o nível ${r.nivelNovo}! Você ganhou ${r.pontosGanhos} ponto(s) livre(s) para distribuir no perfil.`)
        : null,
      renderRounds(r.rounds, r.jogador.nome, r.monstro.nome),
    ),
  );
}

async function carregar() {
  const d = await api('/api/hunt/monsters');
  custoPA = d.custoPA;
  atualizarPA(d.pa);
  renderMonstros(d.monstros);
}

$('btn-cacar').addEventListener('click', async () => {
  $('btn-cacar').disabled = true;
  try {
    const { relatorio, perfil } = await api('/api/hunt', 'POST');
    renderResultado(relatorio);
    atualizarPA({ pa: perfil.personagem.pa, paMax: perfil.personagem.paMax, segundosProximoPA: perfil.personagem.segundosProximoPA });
    if (relatorio.niveisGanhos > 0) carregar().catch(() => {}); // novos monstros podem ter sido liberados
  } catch (e) {
    aviso(e.message, 'erro');
    carregar().catch(() => {});
  }
});

montarNav('hunt');
carregar().catch((e) => aviso(e.message, 'erro'));
