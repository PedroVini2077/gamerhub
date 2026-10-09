import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[09/10]` PROP QUE O COMPONENTE NÃO DECLARA É IGNORADA — EM SILÊNCIO.
 *
 * ── O caso real, e ele estava em produção ─────────────────────────────────
 *
 * `src/pages/Busca.jsx` chamava:
 *
 *     <Avatar url={p.avatar_url} username={p.username} size={32} />
 *
 * O `Avatar` declara `{ profile, size, className, rankBorder }`. Com `profile`
 * indefinido ele cai no caminho da letra inicial — e `profile?.username?.[0]`
 * também é indefinido, então sai `?`.
 *
 * **Toda pessoa no resultado da busca apareceu sem foto desde o PR #243.**
 *
 * ── Por que nada acusou, e é a parte que importa ─────────────────────────
 *
 * O React **ignora** prop que o componente não usa. Não há erro, não há log,
 * o build passa, o lint passa, a tela renderiza. O único sinal é alguém olhar
 * a busca e achar que ninguém tem foto.
 *
 * É a mesma família do fallback silencioso do §4: a informação existe
 * (`p.avatar_url` estava lá), e o caminho que a leva até a tela simplesmente
 * não é percorrido.
 *
 * ── Por que a trava é por CLASSE ─────────────────────────────────────────
 *
 * Conferir "a `Busca.jsx` passa `profile`" seria consertar o caso. A pergunta
 * que acha o PRÓXIMO é: *algum uso de um componente vigiado passa prop que ele
 * não declara?*
 *
 * ── O que ela NÃO faz, dito antes que alguém confie demais ───────────────
 *
 * Ela cobre uma **lista nomeada** de componentes, não o projeto inteiro.
 * Varrer tudo exigiria entender `{...props}`, HOC e composição — e um varredor
 * que erra vira alarme falso, que é pior (§0.2, 4ª regra). A lista começa pelos
 * que têm muitos pontos de uso e assinatura fechada, que é onde o erro se
 * esconde.
 */

/** Componentes vigiados: assinatura fechada e muitos pontos de uso. */
const VIGIADOS = [
  { nome: 'Avatar', arquivo: 'src/components/ui/Avatar.jsx' },
  { nome: 'TextoFormatado', arquivo: 'src/components/ui/TextoFormatado.jsx' },
];

/** As props que a função do componente desestrutura na assinatura. */
function propsDeclaradas(arquivo) {
  const fonte = readFileSync(arquivo, 'utf8');
  const m = fonte.match(/export default function \w+\(\s*\{([\s\S]*?)\}\s*\)/);
  if (!m) return null;
  return m[1]
    .split(',')
    .map((p) => p.trim().split(/[=:]/)[0].trim())
    .filter((p) => p && !p.startsWith('...'));
}

function arquivosJsx(dir, achados = []) {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '__tests__') continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosJsx(caminho, achados);
    else if (nome.endsWith('.jsx')) achados.push(caminho);
  }
  return achados;
}

describe('ninguém passa prop que o componente não declara', () => {
  it('a extração da assinatura funciona — senão a trava aprova o vazio', () => {
    // Vacuidade de sempre: se o formato da assinatura mudar (um componente
    // vira `const X = (props) => …`), a extração devolve null e o `for`
    // abaixo não compara nada.
    for (const { nome, arquivo } of VIGIADOS) {
      const props = propsDeclaradas(arquivo);
      expect(
        props,
        `não consegui ler as props de \`${nome}\` em ${arquivo}.\n`
        + 'O formato da assinatura mudou, e sem isto a trava passa verde sem\n'
        + 'comparar nada — a vacuidade que o `varrerFontes` existe para fechar.',
      ).not.toBeNull();
      expect(props.length, `\`${nome}\` ficou sem props declaradas.`).toBeGreaterThan(1);
    }
  });

  it('todo uso só passa prop que existe na assinatura', () => {
    const erradas = [];

    for (const { nome, arquivo } of VIGIADOS) {
      const declaradas = new Set(propsDeclaradas(arquivo));

      for (const jsx of arquivosJsx('src')) {
        const fonte = readFileSync(jsx, 'utf8');
        // cada `<Nome ... />` ou `<Nome ...>`, sem casar `<NomeOutraCoisa`
        for (const [, atributos] of fonte.matchAll(new RegExp(`<${nome}(\\s[^>]*?)/?>`, 'gs'))) {
          for (const [, prop] of atributos.matchAll(/(?:^|\s)([a-zA-Z][\w-]*)=/g)) {
            if (prop === 'key' || declaradas.has(prop)) continue;
            erradas.push(`${jsx}: <${nome} ${prop}=…> — \`${prop}\` não existe na assinatura`);
          }
        }
      }
    }

    expect(
      erradas,
      `${erradas.length} uso(s) passando prop que o componente ignora:\n`
      + erradas.map((e) => `  - ${e}`).join('\n')
      + '\n\nO React descarta prop desconhecida SEM ERRO. O componente desenha\n'
      + 'o caminho do valor ausente e ninguém percebe — foi assim que toda foto\n'
      + 'da busca virou "?" por semanas, com build, lint e testes verdes.',
    ).toEqual([]);
  });

  it('a varredura LEU arquivos de verdade', () => {
    // Sem isto, renomear `src/` deixa o teste acima verde para sempre.
    expect(arquivosJsx('src').length).toBeGreaterThan(100);
  });
});
