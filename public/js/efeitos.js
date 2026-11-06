/* Efeitos: scroll suave (Lenis), entrada (GSAP), partículas, botões magnéticos,
   inclinação e contadores. Tudo é opcional: sem internet, o site funciona igual. */
(function () {
  'use strict';
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const celular = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const g = window.gsap;

  // Scroll suave
  if (!calmo && window.Lenis) {
    const lenis = new Lenis({ lerp: 0.09 });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
  }

  // Partículas luminosas (canvas 2D, pausa fora da tela e com a aba escondida)
  const tela = document.createElement('canvas');
  tela.id = 'fundo';
  tela.setAttribute('aria-hidden', 'true');
  document.body.prepend(tela);
  const c = tela.getContext('2d');
  let w, h, pontos = [], mouse = { x: 0.5, y: 0.5 }, rodando = !calmo;
  function medir() {
    const d = Math.min(devicePixelRatio || 1, 2);
    w = tela.width = innerWidth * d; h = tela.height = innerHeight * d;
    const n = celular ? 35 : 90;
    pontos = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: (0.6 + Math.random() * 1.8) * d, v: (0.04 + Math.random() * 0.14) * d, a: 0.15 + Math.random() * 0.6 }));
  }
  function quadro() {
    c.clearRect(0, 0, w, h);
    for (const p of pontos) {
      p.y -= p.v; if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
      const x = p.x + (mouse.x - 0.5) * p.r * 18;
      c.beginPath(); c.arc(x, p.y, p.r, 0, 6.283);
      c.fillStyle = `rgba(181,255,112,${p.a * 0.55})`; c.fill();
    }
    if (rodando) requestAnimationFrame(quadro);
  }
  medir(); quadro();
  addEventListener('resize', medir);
  addEventListener('pointermove', (e) => { mouse.x = e.clientX / innerWidth; mouse.y = e.clientY / innerHeight; });
  document.addEventListener('visibilitychange', () => { rodando = !document.hidden && !calmo; if (rodando) quadro(); });

  if (!g || calmo) return;

  // Entrada da página inicial: uma única sequência
  const hero = document.querySelector('.hero');
  if (hero) {
    const l = g.timeline({ defaults: { ease: 'power3.out' } });
    l.from('.hero .kicker', { opacity: 0, y: 12, duration: 0.7 })
     .from('.hero h1', { opacity: 0, y: 60, duration: 1.1 }, '-=0.3')
     .from('.hero p', { opacity: 0, y: 20, duration: 0.8 }, '-=0.6')
     .from('.codigo i', { scaleY: 0, transformOrigin: 'bottom', duration: 0.9, stagger: { each: 0.008 } }, '-=0.6')
     .from('.porta', { opacity: 0, y: 40, duration: 0.9, stagger: 0.12 }, '-=0.7');
  }

  if (celular) return;

  // Botões magnéticos
  document.querySelectorAll('.btn').forEach((b) => {
    const x = g.quickTo(b, 'x', { duration: 0.4, ease: 'power3' }), y = g.quickTo(b, 'y', { duration: 0.4, ease: 'power3' });
    b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * 0.3); y((e.clientY - r.top - r.height / 2) * 0.4); });
    b.addEventListener('pointerleave', () => { x(0); y(0); });
  });

  // Inclinação 3D nas portas
  document.querySelectorAll('.porta').forEach((p) => {
    const rx = g.quickTo(p, 'rotationX', { duration: 0.5 }), ry = g.quickTo(p, 'rotationY', { duration: 0.5 });
    g.set(p, { transformPerspective: 900 });
    p.addEventListener('pointermove', (e) => { const r = p.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - 0.5) * 8); rx(-((e.clientY - r.top) / r.height - 0.5) * 8); });
    p.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });

  // Contadores: <span data-contar="1234"></span>
  window.F && (F.contar = (el, alvo) => { const o = { v: 0 }; g.to(o, { v: alvo, duration: 1.6, ease: 'power2.out', onUpdate: () => (el.textContent = F.num(o.v)) }); });
  document.querySelectorAll('[data-contar]').forEach((el) => window.F && F.contar(el, Number(el.dataset.contar)));
})();
