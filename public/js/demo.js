/*
 * Gera um histórico fictício no mesmo formato do arquivo real do Spotify,
 * para você ver o painel funcionando antes de o seu arquivo chegar.
 * Os artistas e músicas são inventados.
 */
(function (raiz) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const PALAVRAS_A = ['Noite', 'Vidro', 'Estrada', 'Satélite', 'Verão', 'Cobre', 'Eco', 'Relâmpago', 'Neon', 'Poeira', 'Maré', 'Fita'];
  const PALAVRAS_B = ['Lenta', 'de Domingo', 'Azul', 'Sem Volta', 'às Três', 'em Silêncio', 'Aberta', 'de Ferro', 'Distante', 'Roxa'];

  // de/ate: anos em que o artista está "em alta" na vida do ouvinte.
  const ARTISTAS = [
    { nome: 'Lua de Ferro', de: 0, ate: 6, peso: 9 },
    { nome: 'Banda Cassete', de: 0, ate: 2, peso: 8 },
    { nome: 'Maré Alta', de: 1, ate: 4, peso: 7 },
    { nome: 'Os Faróis', de: 2, ate: 6, peso: 8 },
    { nome: 'Névoa 91', de: 3, ate: 6, peso: 9 },
    { nome: 'Cinema Mudo', de: 0, ate: 3, peso: 6 },
    { nome: 'Rádio Interferência', de: 4, ate: 6, peso: 10 },
    { nome: 'Coral dos Satélites', de: 5, ate: 6, peso: 8 },
    { nome: 'Alfaiate Elétrico', de: 1, ate: 6, peso: 5 },
    { nome: 'Dunas', de: 2, ate: 5, peso: 6 },
    { nome: 'Trem das Onze', de: 0, ate: 1, peso: 7 },
    { nome: 'Mapa Celeste', de: 3, ate: 6, peso: 5 },
  ];

  function gerarDemo(semente, anosDeHistorico) {
    const rng = mulberry32(semente || 7);
    const anos = anosDeHistorico || 7;
    const fim = new Date();
    const inicio = new Date(fim.getFullYear() - anos + 1, 2, 1);

    const catalogo = ARTISTAS.map((a) => {
      const album = `${PALAVRAS_A[Math.floor(rng() * PALAVRAS_A.length)]} ${PALAVRAS_B[Math.floor(rng() * PALAVRAS_B.length)]}`;
      const faixas = [];
      for (let i = 0; i < 9; i++) {
        faixas.push(`${PALAVRAS_A[Math.floor(rng() * PALAVRAS_A.length)]} ${PALAVRAS_B[Math.floor(rng() * PALAVRAS_B.length)]}`);
      }
      return { ...a, album, faixas: [...new Set(faixas)] };
    });

    const horaPeso = [1, 0.5, 0.3, 0.2, 0.2, 0.4, 1.5, 3, 3.5, 2.5, 2.5, 2.5, 3, 2.5, 2.5, 3, 3.5, 4, 4, 5, 6, 6, 5, 3];
    const somaHora = horaPeso.reduce((a, b) => a + b, 0);

    function sortearHora() {
      let r = rng() * somaHora;
      for (let h = 0; h < 24; h++) {
        r -= horaPeso[h];
        if (r <= 0) return h;
      }
      return 21;
    }

    const saida = [];
    function registrar(data, ms, artista, faixa, album, uri) {
      saida.push({
        ts: data.toISOString(),
        ms_played: ms,
        master_metadata_track_name: faixa,
        master_metadata_album_artist_name: artista,
        master_metadata_album_album_name: album,
        spotify_track_uri: uri,
        skipped: ms < 30000,
      });
    }

    for (let dia = new Date(inicio); dia <= fim; dia.setDate(dia.getDate() + 1)) {
      const idxAno = dia.getFullYear() - inicio.getFullYear();
      const fimDeSemana = dia.getDay() === 0 || dia.getDay() === 6;
      if (rng() < 0.08) continue; // dias sem música
      const qtd = Math.floor((fimDeSemana ? 26 : 18) * (0.4 + rng() * 1.3));

      const pesos = catalogo.map((a) => a.peso * (idxAno >= a.de && idxAno <= a.ate ? 1 : 0.03));
      const soma = pesos.reduce((x, y) => x + y, 0);

      for (let i = 0; i < qtd; i++) {
        let r = rng() * soma;
        let k = 0;
        for (; k < pesos.length - 1; k++) {
          r -= pesos[k];
          if (r <= 0) break;
        }
        const a = catalogo[k];
        const f = Math.floor(Math.pow(rng(), 1.8) * a.faixas.length);
        const quando = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), sortearHora(), Math.floor(rng() * 60), Math.floor(rng() * 60));
        const pulou = rng() < 0.12;
        const ms = pulou ? 4000 + Math.floor(rng() * 22000) : 150000 + Math.floor(rng() * 130000);
        registrar(quando, ms, a.nome, a.faixas[f], a.album, `spotify:track:demo${k}x${f}`);
      }

      // Som de dormir: aparece quase toda noite (é para o filtro de exclusão ter o que mostrar).
      if (rng() < 0.85) {
        const quando = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 23, 30 + Math.floor(rng() * 25), 0);
        registrar(quando, 3600000 + Math.floor(rng() * 5400000), 'White Noise Radiance', 'Chuva no Vidro', 'Sono Profundo', 'spotify:track:demosono');
      }
    }
    return saida;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { gerarDemo };
  else raiz.gerarDemo = gerarDemo;
})(typeof window !== 'undefined' ? window : globalThis);
