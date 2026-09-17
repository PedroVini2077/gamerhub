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
 * `TERRITORIO` saiu daqui em 02/09 para `scripts/territorio.mjs`: três coisas
 * passaram a precisar dele — este relatório, o portão de cobertura e a lista de
 * leitura por sessão — e mapa copiado em três lugares diverge (§4).
 *
 * Documento novo sem entrada lá é reportado como **não mapeado**; pasta de
 * código sem dono é reprovada por `territorio-coberto.mjs`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TERRITORIO } from './territorio.mjs';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

/** Quantos commits de código sem o documento acompanhar já merecem um olhar. */
const COMMITS_ATE_AVISAR = 5;


const git = (...args) =>
  execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();

/**
 * RELATÓRIO HISTÓRICO — documento que descreve um dia, não o sistema de hoje.
 *
 * `[02/09]` A distinção que faltava. Um `db/2026-08-21-auditoria.md` conta o
 * que foi encontrado NAQUELE dia; atualizá-lo para o estado atual destruiria a
 * única coisa que ele serve para provar. Ele **deve** envelhecer.
 *
 * Sem esta linha, a cobrança do dono — *"TODAS devem estar atualizadas"* — se
 * aplicaria a eles também, e a resposta certa ali é o contrário.
 */
const HISTORICOS = /^db\/\d{4}-\d{2}-\d{2}-/;

/**
 * Documentos que existem e ninguém mapeou.
 *
 * `[02/09]` Passou a varrer **todo `.md` rastreado pelo git**, e não só
 * `docs/`. Duas correções na mesma linha:
 *
 * - a versão de antes lia `docs/` no primeiro nível, então `docs/regras/` era
 *   invisível — e é lá que moram os splits do `CLAUDE.md`;
 * - depois de corrigido isso, ainda ficavam de fora os READMEs de
 *   `supabase/functions/` e `supabase/migrations/`, que descrevem sistema vivo
 *   e podem apodrecer igual.
 *
 * Encontrado quando o dono cobrou, duas vezes: *"os gatilhos têm que ser feitos
 * para cada documentação do projeto, nenhum deles pode passar"* e, em 02/09,
 * *"toda a documentação do projeto, não falo algumas, todas!"*.
 */
function naoMapeados() {
  return git('ls-files', '*.md').split('\n')
    .filter(Boolean)
    .filter(f => !HISTORICOS.test(f))
    .filter(f => !(f in TERRITORIO));
}

/**
 * `[17/09]` O `npm run numeros` CEGAVA este relatório, e o caso foi real.
 *
 * ── O que acontecia ─────────────────────────────────────────────────────────
 *
 * A data de um documento saía de `git log -1 -- <doc>`: o último commit que
 * **tocou** o arquivo. Só que o `numeros-do-projeto.mjs` toca documento sozinho
 * — ele reescreve o valor dentro de `<!--n:chave-->123<!--/n-->` a cada PR que
 * muda uma contagem, e o commit entra no histórico como qualquer outro.
 *
 * Resultado: todo documento com marcador vivo se **rejuvenescia sozinho**. E
 * são justamente os mais centrais que os têm — `README.md`, `AUDITORIA.md`,
 * `DOCUMENTACAO.md`, `EXECUCAO.md`.
 *
 * ── O caso, medido ──────────────────────────────────────────────────────────
 *
 * O `README.md` anunciava `@react-three/fiber` e `three` como dependências de
 * produção e descrevia a landing como "animada com cena 3D". As duas saíram do
 * `package.json` em **11/09**. O documento nunca apareceu neste relatório,
 * porque em 17/09 ele "foi atualizado" — e a atualização inteira foi:
 *
 *     -  ... <!--n:migrations-->176<!--/n--> migrations que recriam o banco
 *     +  ... <!--n:migrations-->177<!--/n--> migrations que recriam o banco
 *
 * Nenhum humano leu uma linha. Quem encontrou foi o dono, olhando o README no
 * celular.
 *
 * ── A ironia, que é o motivo de isto virar mecanismo e não regra ───────────
 *
 * O `numeros-do-projeto.mjs` termina imprimindo *"Confira o texto EM VOLTA de
 * cada um"* — e, no mesmo ato, apagava o sinal de que alguém precisava
 * conferir. Portão que cega outro portão é §1.5 puro: nada estoura, nada loga,
 * e o documento simplesmente para de ser vigiado.
 *
 * ── Como o conserto decide ──────────────────────────────────────────────────
 *
 * Um commit conta como toque de gente se, **neutralizando os valores dos
 * marcadores**, as linhas removidas ainda diferem das adicionadas. Comparar o
 * conteúdo (e não só procurar `<!--n:`) é o que impede o falso negativo de uma
 * linha que tem marcador E texto reescrito junto.
 */
const MARCADOR = /<!--n:[a-zA-Z0-9._-]+-->[\s\S]*?<!--\/n-->/g;
const semValorDeMarcador = (linha) => linha.replace(MARCADOR, '<!--n-->');

function ultimoToqueDeGente(doc) {
  const shas = git('log', '--format=%H', '--', doc).split('\n').filter(Boolean);

  for (const sha of shas) {
    const diff = git('show', sha, '--unified=0', '--format=', '--', doc);
    const mexidas = diff.split('\n')
      .filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));

    if (mexidas.length === 0) continue;             // merge/rename, sem conteúdo

    const fora = mexidas.filter((l) => l.startsWith('-')).map(semValorDeMarcador).sort();
    const dentro = mexidas.filter((l) => l.startsWith('+')).map(semValorDeMarcador).sort();
    // Só os números mudaram: o texto saiu e voltou igual depois de neutralizar.
    if (fora.length === dentro.length
        && fora.every((l, i) => l.slice(1) === dentro[i].slice(1))) continue;

    return sha;
  }
  // Documento cujo histórico inteiro é marcador: o primeiro commit é a verdade.
  return shas[shas.length - 1] ?? '';
}

const atrasados = [];

for (const [doc, caminhos] of Object.entries(TERRITORIO)) {
  if (caminhos.length === 0) continue;
  if (!existsSync(join(RAIZ, doc))) continue;

  const ultimoDoDoc = ultimoToqueDeGente(doc);
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
