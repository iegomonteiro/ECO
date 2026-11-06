/* Início: as barras decorativas que crescem uma única vez ao abrir a página. */
(function () {
  'use strict';
  const caixa = document.getElementById('codigo-decorativo');
  if (!caixa) return;

  // Alturas pseudo-aleatórias, sempre as mesmas (nada de piscar a cada visita).
  let semente = 11;
  function proximo() {
    semente = (semente * 1664525 + 1013904223) >>> 0;
    return semente / 4294967296;
  }

  const total = 96;
  for (let i = 0; i < total; i++) {
    const onda = 0.5 + 0.5 * Math.sin(i / 7) * Math.cos(i / 17);
    const altura = 12 + Math.round(88 * (0.25 * proximo() + 0.75 * onda * (0.4 + 0.6 * proximo())));
    const barra = document.createElement('i');
    barra.style.height = altura + '%';
    barra.style.opacity = (0.35 + 0.65 * (altura / 100)).toFixed(2);
    barra.style.setProperty('--i', i);
    caixa.append(barra);
  }
})();
