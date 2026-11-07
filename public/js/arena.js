const $ = (id) => document.getElementById(id);
const NOME_FACCAO = { vampiro: 'Vampiro', lobisomem: 'Lobisomem' };
let custoPA = 5;
let paAtual = null;

function renderAlvos(alvos) {
  const raiz = $('alvos');
  if (alvos.length === 0) {
    raiz.replaceChildren(el('p', { class: 'vazio' }, 'Ainda não há jogadores da facção inimiga. Crie outra conta e escolha a outra facção para testar.'));
    return;
  }
  raiz.replaceChildren(
    ...alvos.map((a) => {
      const semPA = !paAtual || paAtual.pa < custoPA;
      const emCooldown = a.cooldownSegundos > 0;
      const motivo = emCooldown
        ? `Atacado há pouco: libera em ${formatarTempo(a.cooldownSegundos)}`
        : semPA ? 'Pontos de ação insuficientes' : '';
      return el('div', { class: 'alvo' },
        el('div', {},
          el('div', { class: 'nome' }, a.nome),
          el('div', { class: 'meta' }, `${NOME_FACCAO[a.faccao]} · nível ${a.nivel} · honra ${a.honra}${motivo ? ' · ' + motivo : ''}`),
        ),
        el('button', {
          class: 'btn',
          type: 'button',
          disabled: emCooldown || semPA,
          'aria-label': `Atacar ${a.nome} por ${custoPA} PA`,
          onclick: () => atacar(a.id),
        }, `Atacar (${custoPA} PA)`),
      );
    }),
  );
}

function renderRanking(lista) {
  $('ranking').replaceChildren(
    ...lista.map((r) => el('div', { class: `rank${r.voce ? ' voce' : ''}` },
      el('div', {},
        el('span', { class: 'pos' }, `${r.posicao}.`),
        el('span', { class: 'nome' }, r.nome),
        el('div', { class: 'meta' }, `${NOME_FACCAO[r.faccao]} · nível ${r.nivel}`),
      ),
      el('div', {}, `${r.honra} honra`),
    )),
  );
}

function renderRelatorio(r) {
  const premios = [];
  if (r.xp) premios.push(el('span', {}, 'XP: ', el('strong', {}, sinal(r.xp))));
  premios.push(el('span', { class: r.ouro < 0 ? 'negativo' : '' }, 'Ouro: ', el('strong', {}, sinal(r.ouro))));
  premios.push(el('span', { class: r.honra < 0 ? 'negativo' : '' }, 'Honra: ', el('strong', {}, sinal(r.honra))));

  $('relatorio').replaceChildren(
    el('div', { class: `relatorio ${r.venceu ? 'vitoria' : 'derrota'}` },
      el('h3', {}, r.venceu ? `Você derrotou ${r.defensor.nome}!` : `${r.defensor.nome} derrotou você.`),
      el('p', { class: 'fraco' }, `${NOME_FACCAO[r.defensor.faccao]} de nível ${r.defensor.nivel}`),
      renderBarraVida(r.atacante.nome, r.atacante.hpFinal, r.atacante.hpMax),
      renderBarraVida(r.defensor.nome, r.defensor.hpFinal, r.defensor.hpMax),
      el('div', { class: 'recompensas' }, premios),
      r.muralha && r.muralha.ouroEvitado > 0
        ? el('p', { class: 'fraco' }, `A Muralha de ${r.muralha.de} reduziu o saque em ${r.muralha.reducaoPercentual}% (${r.muralha.ouroEvitado} de ouro poupados).`)
        : null,
      r.niveisGanhos > 0
        ? el('p', { class: 'subiu-nivel' }, `Subiu para o nível ${r.nivelNovo}! Distribua os pontos livres no perfil.`)
        : null,
      renderRounds(r.rounds, r.atacante.nome, r.defensor.nome),
    ),
  );
}

async function carregar() {
  const [d, h] = await Promise.all([api('/api/arena/targets'), api('/api/arena/history')]);
  custoPA = d.custoPA;
  paAtual = d.pa;
  $('pa').textContent = textoPA(d.pa);
  $('regras').textContent = `Cada ataque custa ${d.custoPA} PA. Mesmo alvo: espera de ${d.cooldownMinutos} min.`;
  renderAlvos(d.alvos);
  renderRanking(d.ranking);
  renderHistorico($('historico'), h.batalhas);
}

async function atacar(alvoId) {
  try {
    const { relatorio } = await api('/api/arena/attack', 'POST', { alvoId });
    renderRelatorio(relatorio);
    aviso(relatorio.venceu ? 'Vitória!' : 'Derrota.', relatorio.venceu ? 'ok' : 'erro');
  } catch (e) {
    aviso(e.message, 'erro');
  }
  carregar().catch(() => {}); // atualiza PA, cooldowns, ranking e histórico
}

montarNav('arena');
carregar().catch((e) => aviso(e.message, 'erro'));
