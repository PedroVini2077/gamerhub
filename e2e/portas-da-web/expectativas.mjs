/**
 * O que a BORDA HTTP tem de ser — as quatro listas do portão, e a regra de
 * deploy pendente.
 *
 * `[10/10]` Separadas do roteiro no corte de `portas-da-web.mjs` (375 linhas,
 * acima do teto de 300 do §4). O corte é por responsabilidade: aqui está a
 * EXPECTATIVA (o que se exige da borda) e lá ficou a VERIFICAÇÃO (ir buscar e
 * comparar).
 *
 * **Este arquivo é o alvo de duas travas, e isso é o ponto.** Elas existem
 * porque portão de lista vazia não falha nunca e continua imprimindo "nenhuma
 * falha": `portasDaWebNaoEsvaziam` reprova se qualquer uma das listas encolher,
 * e `deployPendenteNaoEhAfrouxamento` executa a `aguardandoDeploy` de verdade
 * para garantir que a tolerância só aceite produção MAIS restrita do que o
 * esperado — invertida, ela viraria carimbo.
 *
 * As duas passaram a ler este arquivo junto com o roteiro no mesmo corte.
 */

/**
 * Cabeçalhos que PRECISAM estar ligados, com o valor que o `vercel.json` manda.
 *
 * O valor é comparado, não só a presença: `X-Frame-Options: SAMEORIGIN` no
 * lugar de `DENY` é uma proteção enfraquecida que a checagem de presença
 * aprovaria sorrindo.
 */
const CABECALHOS = [
  ['x-content-type-options',   'nosniff',                            'sniffing de MIME'],
  ['x-frame-options',          'DENY',                               'clickjacking'],
  ['referrer-policy',          'strict-origin-when-cross-origin',    'vazamento de URL no Referer'],
  ['permissions-policy',       'camera=(self), microphone=(self), geolocation=()', 'câmera/mic/GPS'],
  ['strict-transport-security', /max-age=\d{7,}/,                    'downgrade para HTTP'],
  // O valor e julgado em CSP_TRAVADAS; aqui so se pergunta se AINDA e uma CSP.
  ['content-security-policy',  /script-src/,                         'XSS e injecao de script'],
];

/**
 * Diretivas da CSP cujo valor e TRAVADO — comparado inteiro, nao "contem".
 *
 * ── Por que so ALGUMAS, e nao a politica inteira ────────────────────────────
 *
 * Comparar a politica inteira com a do `vercel.json` seria a fonte unica ideal
 * (§4) e um portao que se auto-bloqueia: este roteiro bate na **producao**,
 * entao o PR que soma uma origem nova ao `connect-src` reprovaria a si mesmo,
 * porque a producao ainda serve a politica antiga. Portao que reprova o
 * caminho correto ensina a ignora-lo (§0.2, 4a regra).
 *
 * As diretivas abaixo sao as que **nao tem motivo legitimo de crescer**:
 * afrouxar qualquer uma delas e sempre uma decisao de seguranca, nunca
 * manutencao de rotina. `connect-src`, `frame-src`, `img-src` e `font-src`
 * ficam de fora de proposito — eles crescem quando entra um servico novo.
 *
 * A comparacao e por IGUALDADE, e e isso que pega o afrouxamento silencioso:
 * `script-src 'self' 'unsafe-inline'` passaria numa checagem de "contem
 * 'self'" sorrindo, e e exatamente o XSS que a CSP existe para barrar.
 */
/**
 * `[08/10]` O valor no ar e um SUBCONJUNTO do esperado?
 *
 * Se for, a mudanca AFROUXOU e a producao apenas nao recebeu o deploy ainda —
 * ela esta mais restrita do que mandamos, o que nao abre porta nenhuma.
 *
 * Se NAO for (o esperado e que e subconjunto, ou os dois divergem), a producao
 * tem algo que nos nao autorizamos. Isso reprova, como sempre reprovou.
 */
function aguardandoDeploy(noAr, esperado) {
  const partes = (v) => v.trim().split(/\s+/).filter(Boolean);
  const alvo = new Set(partes(esperado));
  return partes(noAr).every((t) => alvo.has(t));
}

const CSP_TRAVADAS = [
  ['default-src',     "'self'", 'o piso de tudo que a politica nao nomeia'],
  // `[08/10]` A Cloudflare entrou por DECISAO DELE, nao por manutencao. O
  // `/contato` usa o Turnstile, e a politica o bloqueava: o script nunca
  // carregava e a tela caia no teto de 12s do `lib/turnstile.js` — falha
  // elegante, e por isso invisivel por quem sabe quanto tempo.
  // O que se autoriza aqui e a Cloudflare EXECUTAR SCRIPT no site. A
  // alternativa era um formulario publico sem defesa nenhuma contra robo.
  ['script-src',      "'self' https://challenges.cloudflare.com", 'XSS inline e script de origem arbitraria'],
  ['object-src',      "'none'", 'plugin legado (Flash/PDF) usado como vetor'],
  ['base-uri',        "'self'", 'sequestro de todo caminho relativo via <base>'],
  ['frame-ancestors', "'none'", 'clickjacking — a versao moderna do X-Frame-Options'],
  ['form-action',     "'self'", 'formulario do site postando credencial em outro dominio'],
];

/** Caminhos que, por causa do rewrite, DEVEM devolver o app — nunca conteúdo. */
const NAO_PODEM_VAZAR = ['/.env', '/.env.local', '/.git/config', '/package.json'];

/**
 * `[01/10]` Caminhos de MÁQUINA que NÃO podem receber o app.
 *
 * É o oposto exato da lista de cima, e a diferença é quem pergunta. Rota de
 * app recebe o `index.html` porque uma PESSOA pode digitá-la e o router
 * desenha a tela certa (inclusive o 404). O `/.well-known/` é namespace
 * reservado pela RFC 8615: ninguém navega até lá, e quem pede é uma
 * ferramenta que vai TENTAR INTERPRETAR o que voltar.
 *
 * O que isso custou, medido com o Lighthouse 13.5.0 de verdade sobre o nosso
 * `dist`, trocando só o que este caminho responde:
 *
 *     200 com HTML  ->  ard-schema score=0  "Malformed JSON: Unexpected '<'"
 *     404           ->  ard-schema notApplicable
 *
 * Catálogo ausente não reprova; catálogo que não carrega, sim. A auditoria
 * estava vermelha porque o site DIZIA que o arquivo existia.
 *
 * A trava de unidade (`rewriteNaoMenteSobreCaminho.test.js`) lê a expressão do
 * `vercel.json` e prova a intenção. Só este arquivo prova que **a Vercel a
 * honra** — regex certa que o fornecedor interpreta de outro jeito continua
 * sendo um site que mente.
 */
const NAO_PODEM_RECEBER_O_APP = [
  '/.well-known/ai-catalog.json',
  '/.well-known/ard.json',
  '/.well-known/security.txt',
  '/.well-known/change-password',
  '/.well-known/assetlinks.json',
];




export {
  CABECALHOS,
  CSP_TRAVADAS,
  NAO_PODEM_VAZAR,
  NAO_PODEM_RECEBER_O_APP,
  aguardandoDeploy,
};
