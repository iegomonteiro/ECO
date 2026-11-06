# Eco

Um painel pessoal da sua música no Spotify, em dois modos:

- **12 meses**: seus artistas, músicas e gêneros mais ouvidos e as últimas reproduções, direto da API do Spotify.
- **Toda a vida**: lê o seu histórico estendido de streaming (o arquivo que o Spotify manda por e-mail) e mostra tudo desde o primeiro dia: favoritos de todos os tempos, ano a ano, mês a mês, horários, recordes e um "código de barras" com uma linha para cada dia da sua vida.

Não tem dependências: só Node.js 18 ou mais novo. Não precisa de `npm install`.

## Rodando

```bash
git clone <seu-repositorio>
cd eco
npm start
```

Abra http://127.0.0.1:3000.

O modo **Toda a vida** já funciona assim, inclusive com dados de exemplo. O modo **12 meses** precisa de um Client ID (próxima seção).

## Modo 12 meses: criar o app no Spotify

1. Entre em https://developer.spotify.com/dashboard e clique em **Create app**.
2. Dê um nome, marque **Web API** e, em **Redirect URI**, coloque exatamente:
   `http://127.0.0.1:3000/callback`
3. Copie o **Client ID**.
4. Copie `.env.example` para `.env` e cole o Client ID:
   ```
   SPOTIFY_CLIENT_ID=seu_client_id
   ```
5. Reinicie com `npm start` e clique em **Conectar com o Spotify**.

Não existe Client Secret neste projeto. O login usa OAuth com PKCE, feito para apps que rodam na máquina do próprio usuário.

> Use `127.0.0.1`, não `localhost`. O Spotify exige o endereço IP nos Redirect URIs locais.

### Limites da API

O Spotify só devolve o top dos últimos ~12 meses e as 50 últimas reproduções. Para ver mais do que isso, use o modo Toda a vida.

## Modo Toda a vida: pedir o histórico

1. Acesse https://www.spotify.com/account/privacy e faça login.
2. Em **Baixar seus dados**, marque **Histórico de streaming estendido** e peça os dados.
3. Confirme pelo e-mail que o Spotify enviar. O arquivo chega em até 30 dias.
4. Na página Toda a vida, escolha o `.zip` inteiro ou todos os arquivos `Streaming_History_Audio_*.json`.

Tudo é lido no navegador. Nada é enviado para nenhum servidor.

### Ignorar artistas

O campo **Ignorar artistas** tira nomes das contagens (por exemplo, sons de dormir ou ruído branco que tocam a noite toda). A lista fica salva no navegador.

### O que conta como reprodução

Só entram músicas tocadas por 30 segundos ou mais, como no Spotify. Podcasts e audiolivros ficam de fora. O formato antigo (`StreamingHistory*.json`) também é aceito, mas ele só cobre o último ano.

## Estrutura

```
server.js            servidor local: arquivos, login com PKCE e rotas /api
public/
  index.html         início
  ano.html           painel de 12 meses
  historico.html     painel de toda a vida
  css/style.css      visual
  js/analise.js      leitura e cálculos do histórico (puro, roda no Node também)
  js/demo.js         gerador de dados de exemplo (artistas inventados)
  js/historico.js    interface do histórico
  js/ano.js          interface dos 12 meses
  js/util.js         funções compartilhadas
  js/home.js         animação do início
```

## Testes rápidos

```bash
npm run check        # confere a sintaxe de todos os arquivos
```

A lógica de `analise.js` e `demo.js` não depende do navegador, então dá para testar com `node` direto.

## Privacidade

- O servidor só aceita conexões da própria máquina (`127.0.0.1`).
- Os tokens do Spotify ficam só na memória do servidor e somem quando você o desliga.
- O `.gitignore` já bloqueia o `.env` e os arquivos de histórico, para eles não irem para o GitHub por acidente.

## Licença

MIT

## Visual e animações

O tema "Obsidiana" fica em `public/css/tema.css` (só sobrescreve as cores e fontes do `style.css`) e as animações em `public/js/efeitos.js`: scroll suave (Lenis), entrada (GSAP), partículas, botões magnéticos e inclinação 3D. As bibliotecas vêm de CDN; sem internet, o site funciona sem os efeitos. Quem prefere movimento reduzido no sistema não vê animações.
