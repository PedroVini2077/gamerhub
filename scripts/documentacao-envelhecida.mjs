#!/usr/bin/env node
/**
 * Relatório (NÃO portão): quais documentos ficaram para trás do código.
 *
 * ── Por que este é relatório e o outro é portão ─────────────────────────────
 *
 * `documentacao-quebrada.mjs` reprova o PR porque a pergunta dele é objetiva:
 * o arquivo existe ou não existe. A pergunta **deste** é de julgamento — "o
 * texto ainda descreve o sistema?" — e nenhum script responde isso.
 *
 * O que ele sabe fazer é apontar **onde olhar**: se `src/services/
 * moderationService.js` mudou em 6 commits desde a última vez que
 * `docs/MODERACAO.md` foi tocado, o documento provavelmente envelheceu. É um
 * indício forte, não uma prova — e por isso ele abre issue em vez de reprovar
 * build. Portão que grita por indício vira ruído, e ruído ensina a ignorar o
 * canal (`CLAUDE.md` §0.2, 4ª regra).
 *
 * ── Como manter o mapa ──────────────────────────────────────────────────────
 *
 * `TERRITORIO` é fonte única: cada documento com os caminhos de código que ele
 * descreve. Documento novo sem entrada aqui é reportado como **não mapeado** —
 * senão a lista envelheceria em silêncio, que é o problema que ela resolve.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

/** Quantos commits de código sem o documento acompanhar já merecem um olhar. */
const COMMITS_ATE_AVISAR = 5;

const TERRITORIO = {
  // `[02/09]` Privacidade. O território é onde o dado pessoal ENTRA no sistema
  // e por onde ele sai: o cadastro (que coleta data de nascimento e estado), o
  // perfil (que decide o que é público), o cliente do banco, o monitoramento
  // (o que o Sentry recebe) e o `App.jsx`, onde a analítica é montada. Mexer
  // em qualquer um destes muda o que o documento afirma.
  'docs/PRIVACIDADE.md': [
    'src/components/auth/RegisterForm.jsx',
    'src/components/profile',
    'src/hooks/useProfileForm.js',
    'src/lib/monitoring.js',
    'src/lib/supabase.js',
    'src/App.jsx',
  ],
  'docs/MODERACAO.md': [
    'src/services/moderationService.js',
    'src/components/moderation',
    'supabase/functions/moderate-links',
  ],
  // A política por categoria e os limiares moram nas Edge Functions de mídia —
  // é lá que um piso muda de valor sem ninguém lembrar do documento.
  'docs/MODERACAO-IA.md': [
    'supabase/functions/moderate-image',
    'supabase/functions/moderate-text',
    'src/lib/framesDeVideo.js',
    // O cliente das Edge Functions de IA saiu do `moderationService` em 29/08.
    // É por ele que o relato de falha de vídeo chega ao `admin_logs`.
    'src/services/moderationAiService.js',
  ],
  'docs/BANCO.md': ['supabase/migrations'],
  'docs/SEGURANCA.md': ['supabase/functions', 'src/hooks/useAuth.jsx', 'src/lib/roles.js'],
  'docs/ARQUITETURA.md': ['src/App.jsx', 'src/services', 'src/hooks'],
  'docs/FUNCIONALIDADES.md': ['src/pages', 'src/components/landing', 'src/components/feed'],
  // O que a equipe opera. O território dele são os painéis e o caminho de ban.
  'docs/PAINEIS.md': ['src/pages/Admin.jsx', 'src/pages/Owner.jsx', 'src/components/admin'],
  'docs/OPERACAO.md': ['.github/workflows', 'scripts'],
  // Investigação de desempenho: envelhece quando o que ela mede muda de forma —
  // a cena 3D, o orçamento de bytes e o build.
  'docs/DESEMPENHO.md': [
    'src/components/landing/scene3d',
    'src/lib/resolucaoDaCena.js',
    'scripts/orcamento-de-bytes.mjs',
    'vite.config.js',
  ],
  // Decisão não envelhece por commit; envelhece por reversão — e reversão é
  // coisa que uma pessoa registra, não que um script detecta.
  'docs/DECISOES.md': [],
  'docs/DECISOES-FERRAMENTAL.md': [],
  'docs/MANIFESTO.md': [],
  'README.md': [],
  'BACKLOG.md': [],

  // ── `[02/09]` O CLAUDE.md e os splits dele ────────────────────────────────
  //
  // Os cinco estavam de fora do portão: o `CLAUDE.md` com território VAZIO (na
  // lista só para não ser acusado de não mapeado, mas nunca conferido), e os
  // quatro `docs/regras/` invisíveis porque o varredor não entrava em
  // subpasta. São os arquivos que comandam todo o resto, e eram os únicos sem
  // vigilância nenhuma.
  //
  // O território deles não é "o código que descrevem" — é **o mecanismo que os
  // cumpre**. Uma regra sobre banco envelhece quando o portão do banco muda;
  // uma regra sobre documentação envelhece quando os portões de documentação
  // mudam. É essa a ligação que interessa vigiar.
  'CLAUDE.md': [
    'scripts/inicio-de-sessao.sh',
    'scripts/fim-de-sessao.mjs',
    '.github/workflows/ci.yml',
  ],
  'docs/regras/POSTURA.md': [
    'e2e/portas-fechadas.mjs',
    'e2e/portas-do-banco.mjs',
    'src/lib/tabelasSemUpdate.js',
  ],
  'docs/regras/BANCO.md': [
    'supabase/migrations',
    'e2e/portas-do-banco.mjs',
    'src/lib/tabelasSemUpdate.js',
  ],
  'docs/regras/AUDITORIA.md': [
    'scripts/mapa-de-arquivos.mjs',
    'scripts/segredos-vazados.mjs',
    'src/lib/__tests__/varrerFontes.js',
  ],
  'docs/regras/DOCUMENTACAO.md': [
    'scripts/documentacao-quebrada.mjs',
    'scripts/documentacao-envelhecida.mjs',
    'scripts/mapa-de-arquivos.mjs',
  ],
};

const git = (...args) =>
  execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();

/**
 * Documentos que existem e ninguém mapeou.
 *
 * `[02/09]` Passou a entrar em SUBPASTAS, e o motivo é grave: a versão antiga
 * lia só `docs/` no primeiro nível, então **`docs/regras/` era invisível** —
 * e é lá que moram os splits do `CLAUDE.md`, as regras que comandam todo o
 * resto. Os quatro arquivos mais importantes do projeto eram os únicos que o
 * portão não enxergava.
 *
 * Encontrado quando o dono cobrou: *"os gatilhos têm que ser feitos para cada
 * documentação do projeto, nenhum deles pode passar, inclusive o CLAUDE.md"*.
 */
function naoMapeados() {
  const dir = join(RAIZ, 'docs');
  if (!existsSync(dir)) return [];

  const varrer = (relativo) => readdirSync(join(RAIZ, relativo), { withFileTypes: true })
    .flatMap((entrada) => {
      const caminho = `${relativo}/${entrada.name}`;
      if (entrada.isDirectory()) return varrer(caminho);
      return entrada.name.endsWith('.md') ? [caminho] : [];
    });

  return varrer('docs').filter(f => !(f in TERRITORIO));
}

const atrasados = [];

for (const [doc, caminhos] of Object.entries(TERRITORIO)) {
  if (caminhos.length === 0) continue;
  if (!existsSync(join(RAIZ, doc))) continue;

  const ultimoDoDoc = git('log', '-1', '--format=%H', '--', doc);
  if (!ultimoDoDoc) continue;

  const existentes = caminhos.filter(c => existsSync(join(RAIZ, c)));
  if (existentes.length === 0) continue;

  const depois = git(
    'log', '--format=%h %s', `${ultimoDoDoc}..HEAD`, '--', ...existentes,
  );
  const commits = depois ? depois.split('\n') : [];
  if (commits.length >= COMMITS_ATE_AVISAR) {
    atrasados.push({ doc, commits });
  }
}

const orfaos = naoMapeados();

if (atrasados.length === 0 && orfaos.length === 0) {
  console.log('OK: nenhum documento visivelmente atrás do código.');
  process.exit(0);
}

if (orfaos.length) {
  console.log('### Documentos sem território mapeado\n');
  for (const d of orfaos) console.log(`- \`${d}\` — acrescentar em \`TERRITORIO\`, em \`scripts/documentacao-envelhecida.mjs\``);
  console.log('');
}

for (const { doc, commits } of atrasados) {
  console.log(`### \`${doc}\` — ${commits.length} commits de código desde a última atualização\n`);
  for (const c of commits.slice(0, 10)) console.log(`- ${c}`);
  if (commits.length > 10) console.log(`- …e mais ${commits.length - 10}`);
  console.log('');
}

console.log(
  'Isto é um **indício**, não um veredito: o documento pode continuar correto.\n'
  + 'O que se pede é abrir cada um e conferir contra o sistema (`CLAUDE.md` §1.4).',
);
