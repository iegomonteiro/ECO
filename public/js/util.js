/* Utilidades compartilhadas pelas páginas. Tudo fica em window.F. */
(function () {
  'use strict';
  const nf = new Intl.NumberFormat('pt-BR');

  const F = {
    num: (n) => nf.format(Math.round(n)),

    horas(ms) {
      const h = ms / 3600000;
      if (h >= 100) return nf.format(Math.round(h)) + ' h';
      return h.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' h';
    },

    hue(texto) {
      let h = 0;
      for (const c of String(texto)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      return h % 360;
    },

    cor(texto, luz = 62) {
      return `hsl(${F.hue(texto)} 62% ${luz}%)`;
    },

    // Monta elementos sem innerHTML (nomes vindos de arquivos nunca viram HTML).
    el(tag, attrs, ...filhos) {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs || {})) {
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
      for (const f of filhos.flat()) {
        if (f == null || f === false) continue;
        e.append(f.nodeType ? f : document.createTextNode(String(f)));
      }
      return e;
    },

    // Dica flutuante: primeira linha em negrito.
    dica(evento, linhas) {
      let d = document.getElementById('dica');
      if (!d) {
        d = document.createElement('div');
        d.id = 'dica';
        document.body.append(d);
      }
      d.replaceChildren(...linhas.map((l, i) => (i === 0 ? F.el('b', null, l) : F.el('span', null, l, F.el('br')))));
      d.style.display = 'block';
      const largura = d.offsetWidth;
      const x = Math.min(evento.clientX + 14, window.innerWidth - largura - 8);
      d.style.left = Math.max(8, x) + 'px';
      d.style.top = evento.clientY + 16 + 'px';
    },

    esconderDica() {
      const d = document.getElementById('dica');
      if (d) d.style.display = 'none';
    },
  };

  window.F = F;
})();
