/* Toda a vida — lê o histórico estendido de streaming direto no navegador. */
(function () {
  'use strict';
  const { el, num, horas, cor, dica, esconderDica } = F;
  const A = window.Analise;
  const $ = (s) => document.querySelector(s);

  const CHAVE_EXCLUIDOS = 'frequencia.excluidos';
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const DIAS_PLURAL = ['domingos', 'segundas', 'terças', 'quartas', 'quintas', 'sextas', 'sábados'];

  let plays = [];
  let resultado = null;
  const estado = { entidade: 'artistas', metrica: 'ms' };

  // ---------- leitura dos arquivos ----------
  function lerExcluidos() {
    try {
      const v = localStorage.getItem(CHAVE_EXCLUIDOS);
      if (v !== null) return v;
    } catch {
      /* sem armazenamento: usa o padrão */
    }
    return 'White Noise Radiance';
  }

  function salvarExcluidos(v) {
    try {
      localStorage.setItem(CHAVE_EXCLUIDOS, v);
    } catch {
      /* tudo bem */
    }
  }

  function avisar(texto) {
    const a = $('#aviso');
    a.textContent = texto || '';
    a.hidden = !texto;
  }

  function lerJson(texto, nome) {
    try {
      const dados = JSON.parse(texto);
      return Array.isArray(dados) ? dados : [];
    } catch {
      throw new Error(`Não consegui ler ${nome}: o arquivo não é um JSON válido.`);
    }
  }

  function carregarJSZip() {
    if (window.JSZip) return Promise.resolve();
    return new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = ok;
      s.onerror = () => falha(new Error('Não consegui carregar o leitor de .zip. Descompacte o arquivo e escolha os .json de dentro.'));
      document.head.append(s);
    });
  }

  async function lerZip(arquivo) {
    await carregarJSZip();
    const zip = await window.JSZip.loadAsync(arquivo);
    const saida = [];
    for (const nome of Object.keys(zip.files)) {
      if (!/(Streaming_?History_?Audio|StreamingHistory)[^/]*\.json$/i.test(nome)) continue;
      for (const item of lerJson(await zip.files[nome].async('string'), nome)) saida.push(item);
    }
    return saida;
  }

  async function lerArquivos(arquivos) {
    avisar('');
    const entradas = [];
    try {
      let i = 0;
      for (const f of arquivos) {
        i += 1;
        $('#estado-leitura').textContent = `Lendo ${i} de ${arquivos.length}: ${f.name}`;
        if (/\.zip$/i.test(f.name)) for (const x of await lerZip(f)) entradas.push(x);
        else if (/\.json$/i.test(f.name)) for (const x of lerJson(await f.text(), f.name)) entradas.push(x);
      }
    } catch (e) {
      $('#estado-leitura').textContent = '';
      return avisar(e.message);
    }
    $('#estado-leitura').textContent = '';
    abrir(entradas);
  }

  function abrir(entradas) {
    plays = A.normalizarTudo(entradas);
    if (!plays.length) {
      return avisar('Não encontrei músicas nesses arquivos. Procure os que começam com "Streaming_History_Audio" e escolha todos de uma vez.');
    }
    $('#entrada').hidden = true;
    $('#painel').hidden = false;
    $('#excluidos').value = lerExcluidos();
    recalcular();
    window.scrollTo(0, 0);
  }

  function recalcular() {
    const lista = $('#excluidos').value.split(',');
    resultado = A.analisar(plays, lista);
    if (!resultado) {
      avisar('Com esses filtros não sobrou nenhuma música. Tire alguém da lista de exclusão.');
      return;
    }
    avisar('');
    renderResumo();
    desenharCodigo();
    renderTop();
    renderAnos();
    renderMeses();
    renderCalor();
    renderRecordes();
  }

  // ---------- resumo ----------
  function renderResumo() {
    const r = resultado;
    const h = r.totalMs / 3600000;
    const anos = r.spanDias / 365.25;
    const periodo = anos >= 1.5 ? `${anos.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} anos` : `${num(r.spanDias)} dias`;
    $('#resumo').textContent = `Você ouviu ${num(h)} horas de música em ${periodo}. São ${num(h / 24)} dias inteiros de som.`;
    $('#resumo-sub').textContent = `${num(r.total)} reproduções de ${num(r.artistas.length)} artistas e ${num(r.faixas.length)} músicas, de ${A.dataExtenso(r.primeiroDia)} até ${A.dataExtenso(r.ultimoDia)}.`;
  }

  // ---------- código de barras ----------
  let colunas = [];

  function desenharCodigo() {
    const canvas = $('#codigo');
    const larg = canvas.clientWidth;
    const alt = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(larg * dpr);
    canvas.height = Math.round(alt * dpr);
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);
    g.clearRect(0, 0, larg, alt);

    const serie = resultado.serie;
    const passo = Math.max(1, Math.ceil(serie.length / larg));
    colunas = [];
    for (let i = 0; i < serie.length; i += passo) {
      let melhor = serie[i];
      for (let j = i; j < Math.min(i + passo, serie.length); j++) if (serie[j].ms > melhor.ms) melhor = serie[j];
      colunas.push(melhor);
    }
    const ordenados = colunas.map((c) => c.ms).sort((a, b) => a - b);
    const teto = ordenados[Math.floor(ordenados.length * 0.97)] || 1;
    const lc = larg / colunas.length;

    colunas.forEach((c, i) => {
      const h = Math.max(c.ms > 0 ? 3 : 1, Math.min(1, c.ms / teto) * alt);
      g.fillStyle = c.ms > 0 ? cor(c.artista, 60) : 'rgba(143,152,171,0.25)';
      g.fillRect(i * lc, alt - h, Math.max(lc - (lc > 3 ? 1 : 0), 0.8), h);
    });
  }

  function ligarDicaDoCodigo() {
    const canvas = $('#codigo');
    canvas.addEventListener('mousemove', (ev) => {
      if (!colunas.length) return;
      const caixa = canvas.getBoundingClientRect();
      const i = Math.min(colunas.length - 1, Math.max(0, Math.floor(((ev.clientX - caixa.left) / caixa.width) * colunas.length)));
      const c = colunas[i];
      const minutos = Math.round(c.ms / 60000);
      dica(ev, [A.dataExtenso(c.dia), c.ms ? `${minutos >= 60 ? (minutos / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' h' : minutos + ' min'} de música` : 'Nenhuma música', c.artista ? `Mais ouvido: ${c.artista}` : '']);
    });
    canvas.addEventListener('mouseleave', esconderDica);
    let espera;
    window.addEventListener('resize', () => {
      clearTimeout(espera);
      espera = setTimeout(() => resultado && desenharCodigo(), 150);
    });
  }

  // ---------- favoritos ----------
  function renderTop() {
    const r = resultado;
    const fonte = { artistas: r.artistas, faixas: r.faixas, albuns: r.albuns }[estado.entidade];
    const chave = estado.metrica === 'ms' ? 'ms' : 'plays';
    const topo = [...fonte].sort((a, b) => b[chave] - a[chave]).slice(0, 25);
    const maximo = topo[0] ? topo[0][chave] : 1;
    $('#top-lista').replaceChildren(
      ...topo.map((x, i) => {
        const sub = estado.entidade === 'artistas' ? (estado.metrica === 'ms' ? `${num(x.plays)} reproduções` : horas(x.ms)) : x.artista;
        const valor = estado.metrica === 'ms' ? horas(x.ms) : `${num(x.plays)} vezes`;
        return el(
          'li',
          { class: 'item', style: `--p:${Math.round((x[chave] / maximo) * 100)}%` },
          el('span', { class: 'pos' }, i + 1),
          el('div', { class: 'capa', style: `background:${cor(x.artista || x.nome)}` }, (x.nome || '?').charAt(0).toUpperCase()),
          el('div', null, el('div', { class: 'nome' }, x.nome), el('div', { class: 'sub' }, sub)),
          el('span', { class: 'valor' }, valor)
        );
      })
    );
    for (const b of document.querySelectorAll('[data-entidade]')) b.setAttribute('aria-pressed', String(b.dataset.entidade === estado.entidade));
    for (const b of document.querySelectorAll('[data-metrica]')) b.setAttribute('aria-pressed', String(b.dataset.metrica === estado.metrica));
  }

  // ---------- ano a ano ----------
  function renderAnos() {
    $('#anos-lista').replaceChildren(
      ...resultado.anos.map((a) =>
        el('div', { class: 'ano' }, el('div', { class: 'y' }, a.ano), el('div', { class: 'tops' }, a.top.map((t) => el('span', null, t.nome))), el('div', { class: 'h' }, horas(a.ms)))
      )
    );
  }

  // ---------- mês a mês ----------
  function renderMeses() {
    const meses = resultado.meses;
    const max = Math.max(...meses.map((m) => m.ms)) || 1;
    const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    $('#meses-barras').replaceChildren(
      ...meses.map((m) => el('i', { style: `height:${Math.max(1, Math.round((m.ms / max) * 100))}%`, title: `${nomes[m.mes]} de ${m.ano}: ${horas(m.ms)}` }))
    );
    const eixo = $('#meses-eixo');
    eixo.replaceChildren(
      ...meses
        .map((m, i) => (m.mes === 0 || i === 0 ? el('span', { style: `left:${(i / meses.length) * 100}%` }, m.ano) : null))
        .filter(Boolean)
    );
  }

  // ---------- horários ----------
  function renderCalor() {
    const calor = resultado.calor;
    const max = Math.max(...calor.flat()) || 1;
    const celulas = [el('span', null)];
    for (let h = 0; h < 24; h++) celulas.push(el('span', { class: 'rot' }, h % 6 === 0 ? h + 'h' : ''));
    calor.forEach((linha, d) => {
      celulas.push(el('span', { class: 'rot' }, DIAS[d]));
      linha.forEach((v, h) => {
        const a = 0.06 + 0.94 * Math.pow(v / max, 0.6);
        celulas.push(el('span', { class: 'c', style: `--a:${a.toFixed(2)}`, title: `${DIAS_PLURAL[d]}, ${h}h: ${horas(v)} no total` }));
      });
    });
    $('#calor').replaceChildren(...celulas);
  }

  // ---------- recordes ----------
  function renderRecordes() {
    const r = resultado.recordes;
    const min = Math.round(r.diaCheio.ms / 60000);
    $('#recordes').replaceChildren(
      item('Dia mais cheio', `${(min / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} horas`, `${A.dataExtenso(r.diaCheio.dia)}${r.diaCheio.artista ? ' · mais ouvido: ' + r.diaCheio.artista : ''}`),
      item('Música mais repetida', r.repetida.nome, `${r.repetida.artista} · ${num(r.repetida.plays)} vezes`),
      item('Maior sequência', `${num(r.sequencia.n)} dias seguidos`, `${A.dataExtenso(r.sequencia.ini)} até ${A.dataExtenso(r.sequencia.fim)}`),
      item('Hora favorita', `${r.horaFavorita}h`, `E, no geral, você ouve mais às ${DIAS_PLURAL[r.semanaFavorita]}.`)
    );
  }

  function item(titulo, valor, sub) {
    return el('div', null, el('dt', null, titulo), el('dd', null, valor, el('small', null, sub)));
  }

  // ---------- eventos ----------
  function iniciar() {
    const entrada = $('#entrada .solta');
    const seletor = $('#arquivos');

    $('#escolher').addEventListener('click', () => seletor.click());
    seletor.addEventListener('change', () => seletor.files.length && lerArquivos([...seletor.files]));
    $('#demo').addEventListener('click', () => abrir(window.gerarDemo()));

    entrada.addEventListener('dragover', (e) => {
      e.preventDefault();
      entrada.classList.add('sobre');
    });
    entrada.addEventListener('dragleave', () => entrada.classList.remove('sobre'));
    entrada.addEventListener('drop', (e) => {
      e.preventDefault();
      entrada.classList.remove('sobre');
      if (e.dataTransfer.files.length) lerArquivos([...e.dataTransfer.files]);
    });

    $('#aplicar').addEventListener('click', () => {
      salvarExcluidos($('#excluidos').value);
      recalcular();
    });
    $('#excluidos').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#aplicar').click();
    });
    $('#trocar').addEventListener('click', () => {
      $('#painel').hidden = true;
      $('#entrada').hidden = false;
      $('#arquivos').value = '';
      plays = [];
      resultado = null;
    });

    for (const b of document.querySelectorAll('[data-entidade]')) {
      b.addEventListener('click', () => {
        estado.entidade = b.dataset.entidade;
        renderTop();
      });
    }
    for (const b of document.querySelectorAll('[data-metrica]')) {
      b.addEventListener('click', () => {
        estado.metrica = b.dataset.metrica;
        renderTop();
      });
    }
    ligarDicaDoCodigo();
    if (new URLSearchParams(location.search).has('demo')) abrir(window.gerarDemo());
  }

  iniciar();
})();
