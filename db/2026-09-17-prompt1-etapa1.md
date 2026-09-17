# `[17/09]` PROMPT 1 · ETAPA 1 — console, robots, sitemap, llms

Primeira etapa da auditoria técnica que ele pediu. O formato é o dele:
**diagnóstico → decisão → implementação → validação**, uma camada por vez.

## O diagnóstico

| Item | Estado medido | Problema? | Ação |
| --- | --- | --- | --- |
| `robots.txt` | não existia; produção devolvia **HTTP 200 `text/html`** | 🔴 sim | criado |
| `sitemap.xml` | idem | 🟠 sim | criado |
| `llms.txt` | idem | ⚪ não é defeito | criado, versão pequena |
| console | **0 erros do código** nas 5 rotas, medido local | ⚠️ **indeterminado em produção** | ver abaixo |

## 🔴 Os três arquivos existiam como HTTP 200 mentindo

```
/robots.txt   ->  HTTP 200 · text/html
/sitemap.xml  ->  HTTP 200 · text/html
/llms.txt     ->  HTTP 200 · text/html
```

Nenhum existia em `public/`. O `vercel.json` tem
`"rewrites": [{ "source": "/(.*)", "destination": "/" }]`, que **captura tudo** —
então o rastreador pedia o `robots.txt` e recebia **o HTML do site**.

**É pior do que 404.** O 404 diz *"não existe"* e o rastreador segue com as
regras padrão. O 200 com HTML diz *"existe"* e entrega algo que não é robots —
e o comportamento a partir daí depende de como cada rastreador reage a lixo.
Nada estoura, nada vai para log, nenhum teste falhava (§1.5).

### A premissa foi MEDIDA, não assumida

Pôr os arquivos em `public/` só resolve se estático vencer o rewrite. Em vez de
confiar na documentação, conferi com um arquivo que **já estava lá**:

```
/manifest.webmanifest  ->  HTTP 200 · application/manifest+json
```

Ele está em `public/`, e produção o serve como manifest — não como HTML. Logo,
a Vercel checa o sistema de arquivos **antes** do rewrite.

### O que entrou em cada um

**`robots.txt`** — permite o rastreamento do que é público, desautoriza a área
de conta (mesma casca de HTML para todo mundo, nada público dentro: rastrear
ali é desperdício dos dois lados) e o fluxo de entrada. Aponta o sitemap com
**URL absoluta**. O arquivo começa dizendo, em comentário, que **não é
mecanismo de segurança** — quem protege é a autenticação.

**`sitemap.xml`** — **seis** URLs, e nenhuma inventada: saíram do router em
`src/App.jsx`. Ficaram de fora, de propósito, tudo atrás de `RequireAuth`, os
painéis de equipe e `/login` + `/auth/*`.

**`llms.txt`** — versão curta: o que o GamerHub é, o aviso de que o conteúdo
real exige conta, e links para as três páginas públicas e os três documentos.
Sem inventar nada, sem virar documentação do projeto.

## ⚠️ O console: o que eu SEI e o que não consegui medir

**O que é fato:** o código do app não produz erro nenhum. Medido em navegador
real (Chromium, 1280×900) nas rotas `/`, `/sobre`, `/login`, `/privacidade`,
`/termos` e uma inexistente: **zero** erros de console, fora dois artefatos do
meu ambiente.

**Os dois artefatos, e por que não são defeito:**

| O que apareceu | Por que não conta |
| --- | --- |
| os dois scripts de analytics em `/_vercel/…` → **404** | são injetados pela Vercel **em produção**. Conferido lá: os dois respondem **HTTP 200 `application/javascript`** |
| `ERR_CERT_AUTHORITY_INVALID` e o WebSocket do realtime | o proxy TLS do sandbox reassina tudo. Some com `--ignore-certificate-errors` |

**O que NÃO consegui medir, e é limitação minha:** o console **em produção**.
Duas tentativas, as duas barradas pelo ambiente:

1. navegador contra `gamerhub-nine.vercel.app` → `net::ERR_TOO_MANY_RETRIES`,
   que é o proxy do sandbox, não o site;
2. API do PageSpeed Insights → **HTTP 429**, cota diária da chave anônima
   compartilhada, estourada.

**Então este item fica ABERTO**, e depende dele: quando rodar o PageSpeed de
novo, o que estiver em *"Browser errors were logged to the console"* é o dado
que falta. Registrar "não achei erro" com base numa medição que eu sei estar
contaminada seria dizer que verifiquei o que não verifiquei (§1.1).

## A trava — `robotsSitemapLlms.test.js`

Cinco asserções. As quatro que importam foram provadas reinjetando o bug:

| Bug reinjetado | A trava disse |
| --- | --- |
| `/blog` no sitemap (rota que não existe) | *"lista rota que NAO existe no router: /blog"* |
| `/admin` no sitemap | *"lista rota que exige LOGIN: /admin"* |
| `robots.txt` sem a linha `Sitemap:` | *"perdeu a linha `Sitemap:` com URL ABSOLUTA"* |
| `llms.txt` apontando para `/keys` | *"aponta para rota que nao e publica: /keys"* |

Ela lê as rotas do **router** e as compara com os arquivos — então o dia em que
uma página pública nascer, o sitemap desatualizado deixa de ser silêncio.

**O que ela NÃO garante, escrito de propósito:** que a Vercel sirva os arquivos.
Isso é produção, e quem verifica é `curl` depois do deploy.

## Validação

- servidos localmente com o tipo certo: `robots.txt` → `text/plain`,
  `sitemap.xml` → `text/xml`, `llms.txt` → `text/plain`
- `/sobre` continua caindo no SPA (`text/html`) — o rewrite não foi quebrado
- o sitemap parseia como XML: 6 URLs
- build limpo · lint 0 erros · testes verdes

## O que a Etapa 1 NÃO fez

Nada de SEO estrutural — `title`, meta description, canonical e JSON-LD são a
Etapa 2, e o formato dele manda uma etapa por vez. Nada de performance: é a
Etapa 4, e só com evidência.
