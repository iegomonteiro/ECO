/*
 * Análise do histórico estendido de streaming do Spotify.
 * Código puro (sem DOM): roda no navegador e também no Node, para testes.
 */
(function (raiz) {
  'use strict';

  // O Spotify só conta como "reprodução" o que passou de 30 segundos.
  const MIN_MS = 30000;

  function lerData(texto) {
    if (!texto) return NaN;
    const s = String(texto).replace(' ', 'T');
    if (/Z$|[+-]\d\d:\d\d$/.test(s)) return Date.parse(s);
    return Date.parse(s.length === 16 ? s + ':00Z' : s + 'Z'); // formato padrão: "2023-01-01 12:34" (UTC)
  }

  // Aceita o formato estendido (Streaming_History_Audio_*.json)
  // e o formato antigo (StreamingHistory*.json).
  function normalizar(e) {
    if (!e || typeof e !== 'object') return null;
    if ('master_metadata_track_name' in e) {
      if (!e.master_metadata_track_name) return null; // podcasts e audiolivros ficam de fora
      return {
        t: lerData(e.ts),
        ms: Number(e.ms_played) || 0,
        artist: e.master_metadata_album_artist_name || 'Desconhecido',
        track: e.master_metadata_track_name,
        album: e.master_metadata_album_album_name || '',
        uri: e.spotify_track_uri || '',
      };
    }
    if ('trackName' in e && 'endTime' in e) {
      return {
        t: lerData(e.endTime),
        ms: Number(e.msPlayed) || 0,
        artist: e.artistName || 'Desconhecido',
        track: e.trackName,
        album: '',
        uri: '',
      };
    }
    return null;
  }

  function normalizarTudo(entradas) {
    const vistos = new Set();
    const saida = [];
    for (const e of entradas) {
      const p = normalizar(e);
      if (!p || !Number.isFinite(p.t) || p.ms < MIN_MS) continue;
      const chave = p.t + '|' + (p.uri || p.track);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      saida.push(p);
    }
    saida.sort((a, b) => a.t - b.t);
    return saida;
  }

  // Número do dia (no fuso local) — facilita achar dias seguidos.
  function numeroDoDia(t) {
    const d = new Date(t);
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  }

  function dataExtenso(num) {
    return new Date(num * 864e5).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function acumular(mapa, chave, ms, criar) {
    let o = mapa.get(chave);
    if (!o) {
      o = criar();
      o.ms = 0;
      o.plays = 0;
      mapa.set(chave, o);
    }
    o.ms += ms;
    o.plays += 1;
    return o;
  }

  function maisFrequente(mapa) {
    let melhor = null;
    let valor = -1;
    for (const [k, v] of mapa) {
      if (v > valor) {
        valor = v;
        melhor = k;
      }
    }
    return melhor;
  }

  function analisar(plays, excluidos) {
    const ex = new Set((excluidos || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean));
    const artistas = new Map();
    const faixas = new Map();
    const albuns = new Map();
    const dias = new Map();
    const anos = new Map();
    const meses = new Map();
    const calor = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let totalMs = 0;
    let total = 0;
    let minDia = Infinity;
    let maxDia = -Infinity;

    for (const p of plays) {
      if (ex.has(p.artist.toLowerCase())) continue;
      const d = new Date(p.t);
      const num = numeroDoDia(p.t);
      const ano = d.getFullYear();
      total += 1;
      totalMs += p.ms;
      if (num < minDia) minDia = num;
      if (num > maxDia) maxDia = num;

      acumular(artistas, p.artist, p.ms, () => ({ nome: p.artist }));
      acumular(faixas, p.artist + '\u0001' + p.track, p.ms, () => ({ nome: p.track, artista: p.artist }));
      if (p.album) acumular(albuns, p.artist + '\u0001' + p.album, p.ms, () => ({ nome: p.album, artista: p.artist }));

      let dd = dias.get(num);
      if (!dd) dias.set(num, (dd = { ms: 0, art: new Map() }));
      dd.ms += p.ms;
      dd.art.set(p.artist, (dd.art.get(p.artist) || 0) + p.ms);

      let yy = anos.get(ano);
      if (!yy) anos.set(ano, (yy = { ms: 0, art: new Map() }));
      yy.ms += p.ms;
      yy.art.set(p.artist, (yy.art.get(p.artist) || 0) + p.ms);

      const chaveMes = ano * 12 + d.getMonth();
      meses.set(chaveMes, (meses.get(chaveMes) || 0) + p.ms);
      calor[d.getDay()][d.getHours()] += p.ms;
    }

    if (!total) return null;

    // Uma entrada por dia, do primeiro ao último.
    const serie = [];
    for (let n = minDia; n <= maxDia; n++) {
      const dd = dias.get(n);
      serie.push({ dia: n, ms: dd ? dd.ms : 0, artista: dd ? maisFrequente(dd.art) : null });
    }

    // Maior sequência de dias seguidos com música.
    let seq = { n: 0, ini: 0, fim: 0 };
    let atual = { n: 0, ini: 0 };
    for (const s of serie) {
      if (s.ms > 0) {
        if (atual.n === 0) atual.ini = s.dia;
        atual.n += 1;
        if (atual.n > seq.n) seq = { n: atual.n, ini: atual.ini, fim: s.dia };
      } else {
        atual.n = 0;
      }
    }

    const diaCheio = serie.reduce((a, b) => (b.ms > a.ms ? b : a), serie[0]);
    const repetida = [...faixas.values()].reduce((a, b) => (b.plays > a.plays ? b : a));

    const porHora = new Array(24).fill(0);
    const porSemana = new Array(7).fill(0);
    calor.forEach((linha, dia) =>
      linha.forEach((v, hora) => {
        porHora[hora] += v;
        porSemana[dia] += v;
      })
    );

    const listaAnos = [...anos.entries()]
      .map(([ano, y]) => ({
        ano,
        ms: y.ms,
        top: [...y.art.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([nome, ms]) => ({ nome, ms })),
      }))
      .sort((a, b) => b.ano - a.ano);

    const chaves = [...meses.keys()];
    const primeiraChave = Math.min(...chaves);
    const ultimaChave = Math.max(...chaves);
    const serieMeses = [];
    for (let k = primeiraChave; k <= ultimaChave; k++) {
      serieMeses.push({ ano: Math.floor(k / 12), mes: k % 12, ms: meses.get(k) || 0 });
    }

    return {
      total,
      totalMs,
      primeiroDia: minDia,
      ultimoDia: maxDia,
      spanDias: maxDia - minDia + 1,
      diasComMusica: dias.size,
      artistas: [...artistas.values()],
      faixas: [...faixas.values()],
      albuns: [...albuns.values()],
      serie,
      anos: listaAnos,
      meses: serieMeses,
      calor,
      recordes: {
        diaCheio,
        repetida,
        sequencia: seq,
        horaFavorita: porHora.indexOf(Math.max(...porHora)),
        semanaFavorita: porSemana.indexOf(Math.max(...porSemana)),
      },
    };
  }

  const API = { MIN_MS, normalizar, normalizarTudo, analisar, dataExtenso, numeroDoDia };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.Analise = API;
})(typeof window !== 'undefined' ? window : globalThis);
