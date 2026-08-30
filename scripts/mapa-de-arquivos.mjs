/**
 * PORTÃO: todo arquivo de `src/` precisa aparecer no `docs/ARQUITETURA.md`.
 *
 * ── Por que este portão existe ──────────────────────────────────────────────
 *
 * Em 29/08 o dono perguntou se a documentação estava mesmo sendo atualizada.
 * Estava — os seis PRs do dia tocaram documentação, e os dois portões que já
 * existiam passavam. Mesmo assim o `ARQUITETURA.md` não conhecia SEIS arquivos
 * criados naquele dia, incluindo uma pasta inteira (`components/sobre/`).
 *
 * Os portões antigos não pegam isso, e não é falha deles:
 *
 *   documentacao-quebrada.mjs   -> documento que cita arquivo INEXISTENTE
 *   documentacao-envelhecida.mjs-> documento atrás do código, pelo TERRITORIO
 *   este                        -> arquivo que EXISTE e nenhum documento cita
 *
 * São as duas direções do mesmo problema. Faltava esta.
 *
 * **Por que isso importa mais do que parece:** o `ARQUITETURA.md` é o mapa que
 * responde "onde mora cada coisa". Arquivo que o mapa não conhece é arquivo que
 * ninguém acha — e o que ninguém acha, ninguém atualiza nem revisa. É onde a
 * próxima brecha vai se esconder (`CLAUDE.md` §0, "organização é pré-requisito").
 *
 * **Por que reprova em vez de avisar:** é determinístico. O nome do arquivo
 * está no documento ou não está; não há julgamento no meio, então não produz
 * alarme falso — e alarme falso ensina a ignorar o canal (§0.2, 4ª regra).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAPA = 'docs/ARQUITETURA.md';

/**
 * O que NÃO precisa estar no mapa, e o porquê de cada um.
 *
 * Esta lista é curta de propósito. Cada linha nova aqui é um pedaço do projeto
 * que deixa de ser exigido no mapa — então ela pede motivo escrito, igual às
 * CITACOES_HISTORICAS do portão irmão.
 */
const DISPENSADOS = [
  // Testes acompanham o arquivo que testam. Listar cada um dobraria o mapa
  // sem dizer nada novo: quem acha `like.js` acha `__tests__/like.test.js`.
  /__tests__\//,
  // Entrada do Vite e folha de estilo já estão descritas no topo do mapa, e
  // não são "peças" que alguém precise localizar.
  /^src\/(main|vite-env)\./,
];

function varrer(dir) {
  return readdirSync(dir).flatMap(nome => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? varrer(caminho) : [caminho];
  });
}

const mapa = readFileSync(MAPA, 'utf8');

const orfaos = varrer('src')
  .filter(f => /\.(js|jsx)$/.test(f))
  .filter(f => !DISPENSADOS.some(re => re.test(f)))
  // O mapa cita pelo NOME do arquivo, não pelo caminho inteiro — é uma árvore
  // desenhada, não uma lista de caminhos. E cita SEM a extensão na maioria dos
  // casos ("UsersPanel, PostsPanel..."), então é o nome puro que se procura.
  // Comparar com a extensão foi o primeiro erro deste script: ele acusou 145
  // arquivos que estavam no mapa o tempo todo. Portão que acusa errado é pior
  // do que portão nenhum (§0.2, 4ª regra).
  .filter(f => !mapa.includes(f.split('/').pop().replace(/\.jsx?$/, '')));

if (orfaos.length > 0) {
  console.error(`\n  ${orfaos.length} arquivo(s) de src/ que o ${MAPA} não conhece:\n`);
  orfaos.forEach(f => console.error(`    ${f}`));
  console.error(`
  Arquivo que o mapa não conhece é arquivo que ninguém acha — e o que ninguém
  acha, ninguém atualiza nem revisa (CLAUDE.md §6.2, regra 5).

  O conserto é acrescentar cada um na árvore de "Estrutura de pastas" do
  ${MAPA}, com uma linha dizendo O QUE ELE FAZ. Não basta o nome: o mapa serve
  para alguém decidir se precisa abrir o arquivo, sem abrir.

  Se algum deles genuinamente não pertence ao mapa, acrescente o padrão em
  DISPENSADOS, neste script, COM O MOTIVO escrito ao lado.
`);
  process.exit(1);
}

console.log(`OK: os ${varrer('src').filter(f => /\.(js|jsx)$/.test(f)).length} arquivos de src/ estão no mapa.`);
