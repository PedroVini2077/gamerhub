/**
 * PORTÃO: nenhum segredo entra no repositório.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 *
 * A auditoria de gatilhos de 01/09 varreu as áreas do projeto uma a uma e
 * encontrou **configuração/segredo sem portão nenhum**. O `.gitignore` cobre
 * `.env` e `.env.local`, e hoje não há nada sensível commitado — mas
 * `.gitignore` é convenção, não trava: `git add -f`, um arquivo com nome novo,
 * ou uma chave colada dentro de um `.js` passam sem ninguém ver.
 *
 * E segredo vazado é o erro com a pior curva de conserto do projeto inteiro:
 * apagar o arquivo NÃO resolve, porque a chave continua no histórico do git e
 * o repositório é PÚBLICO. O conserto é rotacionar a chave no fornecedor.
 *
 * ── Por que ele procura POUCA coisa, e de propósito ─────────────────────────
 *
 * Só padrões de sinal alto. A `anon key` NÃO é procurada: ela é pública por
 * construção — vai no bundle do navegador, e a segurança real está na RLS
 * (`CLAUDE.md` §3). Marcar a anon key como vazamento seria alarme falso em
 * todo PR, e alarme falso ensina a ignorar o canal (§0.2, 4ª regra).
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const rastreados = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n').filter(Boolean);

/** Arquivo de ambiente rastreado é vazamento por definição. */
const ARQUIVOS_PROIBIDOS = /(^|\/)(\.env(\..*)?|.*\.pem|.*\.p12|id_rsa.*)$/;

/**
 * Padrões dentro do conteúdo. Cada um vem com o que fazer, porque "achei um
 * segredo" sem o próximo passo deixa a pessoa paralisada no pior momento.
 */
const PADROES = [
  {
    nome: 'chave privada',
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    acao: 'remova o arquivo E gere um par novo — a chave antiga vazou no histórico.',
  },
  {
    nome: 'service_role do Supabase',
    // O JWT do service_role carrega "role":"service_role" no payload. Procurar
    // o texto literal pega tanto o JWT quanto a variável com o valor colado.
    re: /service_role["\s]*[:=][\s"']*ey[A-Za-z0-9_-]{20,}/,
    acao: 'ROTACIONE a chave no painel do Supabase agora. Ela ignora RLS inteira.',
  },
  {
    nome: 'token do GitHub',
    re: /gh[pousr]_[A-Za-z0-9]{30,}/,
    acao: 'revogue o token no GitHub e gere outro.',
  },
  {
    nome: 'senha em texto no código',
    // `[05/09]` A ASPA ANTES E A ASPA DEPOIS TÊM QUE SER A MESMA (`\1`), e essa
    // regra nasceu de um falso positivo real: o portão reprovou o
    // `CampoDeSenha.jsx` por causa de
    //
    //     aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
    //
    // O padrão antigo lia `senha' : '` como "chave, dois-pontos, valor" — mas
    // aquilo é um TERNÁRIO: a aspa fecha um texto e o `:` é do `?:`.
    //
    // Com a referência de volta, a palavra só conta como chave se as aspas
    // estiverem equilibradas em torno dela: `senha:`, `senha =` e
    // `"password":` continuam casando; `... senha' : '...` não casa mais,
    // porque ali a aspa aparece SÓ depois.
    //
    // Consertar o padrão em vez de dispensar o arquivo é deliberado: pôr o
    // arquivo na lista de dispensados cegaria o portão para uma senha de
    // verdade escrita ali dentro, para sempre. E portão que grita à toa vira
    // ruído, que ensina a ignorar o canal (§0.2, quarta regra).
    re: /(["'`]?)\b(?:senha|password|passwd)\1\s*[:=]\s*["'][^"'{$\n]{8,}["']/i,
    acao: 'tire do código. Se for de conta real, troque a senha também.',
  },
];

/**
 * O próprio portão contém os padrões que procura — senão ele se acusaria.
 * Fixtures de teste declaram valores falsos de propósito.
 */
const DISPENSADOS = new Set([
  'scripts/segredos-vazados.mjs',
  'e2e/portas-fechadas.mjs',   // manda assinatura FALSA de propósito
]);

const achados = [];

for (const arquivo of rastreados) {
  if (ARQUIVOS_PROIBIDOS.test(arquivo)) {
    achados.push([arquivo, 'arquivo de ambiente/chave RASTREADO pelo git',
      'tire do índice (`git rm --cached`) e rotacione o que estava dentro.']);
    continue;
  }
  if (DISPENSADOS.has(arquivo)) continue;
  if (!/\.(js|jsx|ts|tsx|json|md|yml|yaml|sh|mjs|sql|env.*)$/.test(arquivo)) continue;

  let conteudo;
  try { conteudo = readFileSync(arquivo, 'utf8'); } catch { continue; }

  for (const p of PADROES) {
    if (p.re.test(conteudo)) achados.push([arquivo, p.nome, p.acao]);
  }
}

if (achados.length > 0) {
  console.error(`\n  ${achados.length} possível(is) segredo(s) no repositório:\n`);
  for (const [arquivo, tipo, acao] of achados) {
    console.error(`  ─ ${arquivo}`);
    console.error(`      o que é: ${tipo}`);
    console.error(`      o que fazer: ${acao}\n`);
  }
  console.error('  APAGAR O ARQUIVO NAO BASTA: o repositorio e publico e a chave');
  console.error('  fica no historico do git. O conserto e rotacionar no fornecedor.\n');
  process.exit(1);
}

console.log(`OK: ${rastreados.length} arquivos rastreados, nenhum segredo aparente.`);
