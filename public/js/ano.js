/* Últimos 12 meses — dados vindos da API do Spotify (via o servidor local). */
(function () {
  'use strict';
  const { el, cor } = F;
  const $ = (s) => document.querySelector(s);

  const PERIODOS = [
    { id: 'short_term', rotulo: '4 semanas', frase: 'nas últimas 4 semanas' },
    { id: 'medium_term', rotulo: '6 meses', frase: 'nos últimos 6 meses' },
    { id: 'long_term', rotulo: '12 meses', frase: 'no último ano' },
  ];
  let periodo = PERIODOS[2];
  let recentes = null;

  const ERROS = {
    sem_client_id: 'O servidor não achou o SPOTIFY_CLIENT_ID. Crie o arquivo .env (veja o README) e reinicie com "npm start".',
    negado: 'Você cancelou o acesso no Spotify. Quando quiser, é só conectar de novo.',
    estado: 'O login expirou antes de terminar. Tente conectar de novo.',
    token: 'O Spotify não aceitou o login. Confira se o Redirect URI do app é exatamente http://127.0.0.1:3000/callback.',
  };

  async function api(caminho) {
    const r = await fetch(caminho);
    const corpo = await r.json().catch(() => ({}));
    if (r.status === 401) throw { codigo: 'login' };
    if (r.status === 429) throw { codigo: 'limite', msg: 'O Spotify pediu para esperar um pouco. Tente de novo em alguns segundos.' };
    if (!r.ok) throw { codigo: 'api', msg: (corpo.error && (corpo.error.message || corpo.error)) || 'Erro ao falar com o Spotify.' };
    return corpo;
  }

  function aviso(texto) {
    const a = $('#aviso');
    a.textContent = texto;
    a.hidden = !texto;
  }

  function mostrar(estado) {
    $('#conectar').hidden = estado !== 'conectar';
    $('#painel').hidden = estado !== 'painel';
  }

  function foto(imagens, minimo) {
    if (!imagens || !imagens.length) return null;
    // Escolhe a menor imagem que ainda tem boa resolução.
    const ordenadas = [...imagens].sort((a, b) => a.width - b.width);
    return (ordenadas.find((i) => i.width >= minimo) || ordenadas[ordenadas.length - 1]).url;
  }

  function linha(pos, imagem, nome, sub, nomeParaCor) {
    const capa = imagem
      ? el('img', { class: 'capa', src: imagem, alt: '', loading: 'lazy', width: 52, height: 52 })
      : el('div', { class: 'capa', style: `background:${cor(nomeParaCor)}` }, nome.charAt(0).toUpperCase());
    return el('li', { class: 'item' }, el('span', { class: 'pos' }, pos), capa, el('div', null, el('div', { class: 'nome' }, nome), el('div', { class: 'sub' }, sub)));
  }

  function renderDestaque(artistas, usuario) {
    const topo = artistas.items[0];
    const alvo = $('#destaque');
    alvo.replaceChildren();
    if (!topo) {
      alvo.append(el('p', { class: 'lead' }, 'O Spotify ainda não tem dados suficientes deste período. Ouça mais um pouco e volte.'));
      return;
    }
    const imagem = foto(topo.images, 600);
    alvo.append(
      el('div', null, el('p', { class: 'quem' }, `${usuario ? usuario + ', seu' : 'Seu'} artista mais ouvido ${periodo.frase}:`), el('h1', null, topo.name)),
      imagem ? el('div', { class: 'foto' }, el('img', { src: imagem, alt: '' })) : null
    );
  }

  function renderArtistas(artistas) {
    const lista = $('#artistas');
    lista.replaceChildren(
      ...artistas.items.slice(0, 20).map((a, i) => linha(i + 1, foto(a.images, 100), a.name, (a.genres || []).slice(0, 2).join(', ') || 'Artista', a.name))
    );
  }

  function renderFaixas(faixas) {
    const lista = $('#faixas');
    lista.replaceChildren(
      ...faixas.items.slice(0, 20).map((t, i) => linha(i + 1, foto(t.album && t.album.images, 100), t.name, `${t.artists.map((a) => a.name).join(', ')} · ${t.album ? t.album.name : ''}`, t.name))
    );
  }

  function renderGeneros(artistas) {
    const alvo = $('#generos');
    const pesos = new Map();
    artistas.items.forEach((a, i) => {
      for (const g of a.genres || []) pesos.set(g, (pesos.get(g) || 0) + (artistas.items.length - i));
    });
    const lista = [...pesos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const bloco = $('#bloco-generos');
    bloco.hidden = lista.length === 0;
    if (!lista.length) return;
    const max = lista[0][1];
    alvo.replaceChildren(...lista.map(([g, v]) => el('div', { class: 'genero' }, el('span', null, g), el('i', { style: `--p:${Math.round((v / max) * 100)}%` }))));
  }

  function renderRecentes() {
    const lista = $('#recentes');
    if (!recentes) return;
    lista.replaceChildren(
      ...recentes.items.slice(0, 15).map((r) => {
        const t = r.track;
        const quando = new Date(r.played_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const capa = foto(t.album && t.album.images, 100);
        return el(
          'li',
          { class: 'item' },
          el('span', { class: 'pos' }, ''),
          capa ? el('img', { class: 'capa', src: capa, alt: '', loading: 'lazy', width: 52, height: 52 }) : el('div', { class: 'capa', style: `background:${cor(t.name)}` }, t.name.charAt(0).toUpperCase()),
          el('div', null, el('div', { class: 'nome' }, t.name), el('div', { class: 'sub' }, t.artists.map((a) => a.name).join(', '))),
          el('span', { class: 'valor' }, quando)
        );
      })
    );
  }

  async function carregarPeriodo() {
    aviso('');
    try {
      const [artistas, faixas] = await Promise.all([api(`/api/top/artists?periodo=${periodo.id}`), api(`/api/top/tracks?periodo=${periodo.id}`)]);
      renderDestaque(artistas, carregarPeriodo.nome);
      renderArtistas(artistas);
      renderFaixas(faixas);
      renderGeneros(artistas);
    } catch (e) {
      tratarErro(e);
    }
  }

  function tratarErro(e) {
    if (e && e.codigo === 'login') return mostrar('conectar');
    aviso((e && e.msg) || 'Algo deu errado. Tente recarregar a página.');
  }

  function montarSeletor() {
    const caixa = $('#periodos');
    caixa.replaceChildren(
      ...PERIODOS.map((p) =>
        el(
          'button',
          {
            type: 'button',
            'aria-pressed': String(p.id === periodo.id),
            onclick: () => {
              periodo = p;
              montarSeletor();
              carregarPeriodo();
            },
          },
          p.rotulo
        )
      )
    );
  }

  async function iniciar() {
    const erro = new URLSearchParams(location.search).get('erro');
    let status;
    try {
      status = await (await fetch('/api/status')).json();
    } catch {
      mostrar('conectar');
      aviso('Não consegui falar com o servidor local. Ele está rodando? Use "npm start".');
      $('#botao-conectar').hidden = true;
      return;
    }
    if (erro) aviso(ERROS[erro] || 'Não foi possível entrar. Tente de novo.');
    if (!status.configurado) {
      mostrar('conectar');
      $('#botao-conectar').hidden = true;
      if (!erro) aviso(ERROS.sem_client_id);
      return;
    }
    if (!status.logado) return mostrar('conectar');

    mostrar('painel');
    montarSeletor();
    try {
      const eu = await api('/api/me');
      carregarPeriodo.nome = (eu.display_name || '').split(' ')[0];
    } catch (e) {
      return tratarErro(e);
    }
    await carregarPeriodo();
    try {
      recentes = await api('/api/recentes');
      renderRecentes();
    } catch (e) {
      /* a lista de recentes é opcional */
    }
  }

  iniciar();
})();
