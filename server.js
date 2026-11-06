'use strict';
/*
 * Eco — servidor local.
 * Sem dependências: só Node.js (>=18). Faz três coisas:
 *   1. serve os arquivos da pasta public/
 *   2. faz o login com o Spotify (OAuth com PKCE, sem Client Secret)
 *   3. repassa algumas consultas à API do Spotify (/api/...)
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// ---------- .env mínimo ----------
function carregarEnv(arquivo) {
  let texto;
  try {
    texto = fs.readFileSync(arquivo, 'utf8');
  } catch {
    return; // sem .env, tudo bem
  }
  for (const linha of texto.split(/\r?\n/)) {
    if (linha.trim().startsWith('#')) continue;
    const m = linha.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const valor = m[2].replace(/^["']|["']$/g, '');
    if (!(m[1] in process.env)) process.env[m[1]] = valor;
  }
}
carregarEnv(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT) || 3000;
const CLIENT_ID = (process.env.SPOTIFY_CLIENT_ID || '').trim();
// Na sua máquina: só aceita conexões locais. Online (Render ou HOST=0.0.0.0): aceita de fora.
const HOST = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');
const URL_PUBLICA = (process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
const REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI || (URL_PUBLICA ? `${URL_PUBLICA}/callback` : `http://127.0.0.1:${PORT}/callback`);
const COOKIE_SEGURO = REDIRECT_URI.startsWith('https://') ? '; Secure' : '';
const SCOPES = 'user-top-read user-read-recently-played';
const PUBLIC_DIR = path.join(__dirname, 'public');
const CONFIGURADO = CLIENT_ID !== '' && CLIENT_ID !== 'cole_aqui_o_client_id';

// ---------- sessões em memória ----------
const sessoes = new Map();
const VIDA_SESSAO_MS = 24 * 3600 * 1000;

// Online, qualquer visitante cria uma sessão: limpa as antigas para a memória não crescer.
setInterval(() => {
  const limite = Date.now() - VIDA_SESSAO_MS;
  for (const [sid, s] of sessoes) if ((s.criadaEm || 0) < limite) sessoes.delete(sid);
}, 3600 * 1000).unref();

function pegarSessao(req, res) {
  const cookies = {};
  for (const par of (req.headers.cookie || '').split(';')) {
    const i = par.indexOf('=');
    if (i > 0) cookies[par.slice(0, i).trim()] = par.slice(i + 1).trim();
  }
  let sid = cookies.sid;
  if (!sid || !sessoes.has(sid)) {
    sid = crypto.randomBytes(24).toString('base64url');
    sessoes.set(sid, { criadaEm: Date.now() });
    res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${COOKIE_SEGURO}`);
  }
  return sessoes.get(sid);
}

// ---------- Spotify ----------
async function pedirToken(parametros) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(parametros),
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados.error_description || dados.error || `HTTP ${r.status}`);
  return dados;
}

function guardarTokens(sessao, dados) {
  sessao.accessToken = dados.access_token;
  if (dados.refresh_token) sessao.refreshToken = dados.refresh_token;
  sessao.expiraEm = Date.now() + (dados.expires_in - 60) * 1000;
}

async function tokenValido(sessao) {
  if (!sessao.accessToken) return null;
  if (Date.now() < sessao.expiraEm) return sessao.accessToken;
  if (!sessao.refreshToken) return null;
  try {
    guardarTokens(
      sessao,
      await pedirToken({
        grant_type: 'refresh_token',
        refresh_token: sessao.refreshToken,
        client_id: CLIENT_ID,
      })
    );
    return sessao.accessToken;
  } catch {
    delete sessao.accessToken;
    delete sessao.refreshToken;
    return null;
  }
}

async function consultarSpotify(sessao, caminho) {
  const token = await tokenValido(sessao);
  if (!token) return { status: 401, corpo: { error: 'nao_logado' } };
  const r = await fetch('https://api.spotify.com' + caminho, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const texto = await r.text();
  let corpo;
  try {
    corpo = texto ? JSON.parse(texto) : {};
  } catch {
    corpo = { error: texto.slice(0, 200) };
  }
  return { status: r.status, corpo, retryAfter: r.headers.get('retry-after') };
}

// ---------- utilidades HTTP ----------
function json(res, status, corpo, extras = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extras });
  res.end(JSON.stringify(corpo));
}

function redirecionar(res, url) {
  res.writeHead(302, { Location: url, 'Cache-Control': 'no-store' });
  res.end();
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const PAGINAS = { '/': 'index.html', '/ano': 'ano.html', '/historico': 'historico.html' };

function servirArquivo(res, pathname) {
  const relativo = PAGINAS[pathname] || decodeURIComponent(pathname).replace(/^\/+/, '');
  const alvo = path.normalize(path.join(PUBLIC_DIR, relativo));
  if (!alvo.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end('Acesso negado');
  }
  fs.readFile(alvo, (erro, dados) => {
    if (erro) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Página não encontrada');
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(alvo)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    });
    res.end(dados);
  });
}

// ---------- rotas ----------
const TIPOS_TOP = new Set(['artists', 'tracks']);
const PERIODOS = new Set(['short_term', 'medium_term', 'long_term']);

async function tratar(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const { pathname } = url;

  if (pathname.startsWith('/api/') || pathname === '/login' || pathname === '/callback' || pathname === '/logout') {
    const sessao = pegarSessao(req, res);

    if (pathname === '/login') {
      if (!CONFIGURADO) return redirecionar(res, '/ano?erro=sem_client_id');
      sessao.verificador = crypto.randomBytes(64).toString('base64url');
      sessao.estado = crypto.randomBytes(16).toString('base64url');
      const desafio = crypto.createHash('sha256').update(sessao.verificador).digest('base64url');
      const destino = new URL('https://accounts.spotify.com/authorize');
      destino.search = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI,
        state: sessao.estado,
        code_challenge_method: 'S256',
        code_challenge: desafio,
      }).toString();
      return redirecionar(res, destino.toString());
    }

    if (pathname === '/callback') {
      const codigo = url.searchParams.get('code');
      const estado = url.searchParams.get('state');
      if (url.searchParams.get('error')) return redirecionar(res, '/ano?erro=negado');
      if (!codigo || !sessao.estado || estado !== sessao.estado) return redirecionar(res, '/ano?erro=estado');
      try {
        const dados = await pedirToken({
          grant_type: 'authorization_code',
          code: codigo,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          code_verifier: sessao.verificador,
        });
        guardarTokens(sessao, dados);
        delete sessao.verificador;
        delete sessao.estado;
        return redirecionar(res, '/ano');
      } catch (e) {
        console.error('Falha no login:', e.message);
        return redirecionar(res, '/ano?erro=token');
      }
    }

    if (pathname === '/logout') {
      for (const k of Object.keys(sessao)) delete sessao[k];
      return redirecionar(res, '/');
    }

    if (pathname === '/api/status') {
      return json(res, 200, { configurado: CONFIGURADO, logado: Boolean(await tokenValido(sessao)) });
    }

    let consulta = null;
    if (pathname === '/api/me') consulta = '/v1/me';
    else if (pathname === '/api/recentes') consulta = '/v1/me/player/recently-played?limit=50';
    else {
      const m = pathname.match(/^\/api\/top\/([a-z]+)$/);
      if (m && TIPOS_TOP.has(m[1])) {
        const periodo = url.searchParams.get('periodo') || 'long_term';
        if (!PERIODOS.has(periodo)) return json(res, 400, { error: 'periodo_invalido' });
        consulta = `/v1/me/top/${m[1]}?time_range=${periodo}&limit=50`;
      }
    }
    if (!consulta) return json(res, 404, { error: 'rota_desconhecida' });

    try {
      const r = await consultarSpotify(sessao, consulta);
      const extras = r.retryAfter ? { 'Retry-After': r.retryAfter } : {};
      return json(res, r.status, r.corpo, extras);
    } catch (e) {
      return json(res, 502, { error: 'falha_de_rede', detalhe: e.message });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }
  return servirArquivo(res, pathname);
}

const servidor = http.createServer((req, res) => {
  tratar(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'erro_interno' });
    else res.end();
  });
});

servidor.listen(PORT, HOST, () => {
  console.log(`Eco rodando em http://${HOST}:${PORT}`);
  console.log(`Redirect URI do Spotify: ${REDIRECT_URI}`);
  if (!CONFIGURADO) {
    console.log('Aviso: SPOTIFY_CLIENT_ID não definido. O modo "Toda a vida" funciona; o de 12 meses precisa do .env.');
  }
});
