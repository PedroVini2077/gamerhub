/**
 * O MAPA: cada documento e os caminhos de código que ele descreve.
 *
 * ── Por que virou arquivo próprio em 02/09 ──────────────────────────────────
 *
 * Ele morava dentro de `documentacao-envelhecida.mjs`, que é um **relatório
 * mensal**. Três coisas passaram a precisar dele — o relatório, o portão de
 * cobertura (`territorio-coberto.mjs`) e a lista de leitura por sessão
 * (`documentacao-a-revisar.mjs`) —, e mapa copiado em três lugares diverge:
 * é a regra de fonte única do `CLAUDE.md` §4, que neste projeto já falhou com
 * ícones de log, rótulos de cargo e cores de cargo.
 *
 * ── O que "território" quer dizer ───────────────────────────────────────────
 *
 * Não é "os arquivos que o documento cita". É **o código cuja mudança pode
 * tornar o documento falso**. Mexer ali é motivo para reler aquele documento.
 *
 * Para os arquivos de REGRA (`CLAUDE.md` e `docs/regras/`) a ligação é outra e
 * está explicada onde eles aparecem: o território deles é o **mecanismo que os
 * cumpre**, não o código que descrevem.
 *
 * ── Território vazio é declaração, não esquecimento ─────────────────────────
 *
 * `DECISOES.md` não envelhece por commit — envelhece por reversão, que é coisa
 * que uma pessoa registra e nenhum script detecta. Lista vazia diz "vigiar por
 * commit aqui não faz sentido", e é diferente de estar fora do mapa.
 */
import { SISTEMA } from './territorio/sistema.mjs';
import { PROCESSO } from './territorio/processo.mjs';

/**
 * `[10/10]` O mapa vem de DOIS arquivos, no corte de 401 linhas.
 *
 * O spread remonta na ordem original — `sistema` e depois `processo` —, então
 * a ordem de iteração não mudou e os relatórios saem idênticos. Provado:
 * `territorio-coberto.mjs` e `npm run docs` devolvem a mesma saída de antes.
 *
 * Os consumidores (`documentacao-a-revisar`, `territorio-coberto`,
 * `documentacao-envelhecida`) continuam importando `TERRITORIO` daqui. Ninguém
 * de fora soube do corte.
 */
export const TERRITORIO = { ...SISTEMA, ...PROCESSO };

/**
 * As UNIDADES que precisam ter dono — a granularidade do portão de cobertura.
 *
 * Não é "todo arquivo": seria uma lista de 301 entradas que ninguém mantém, e
 * mapa que ninguém mantém é pior do que mapa nenhum. É a pasta de domínio, que
 * é como uma pessoa pensa o sistema — "a moderação", "o painel", "a landing".
 */
export const GRANULARIDADE = [
  { pasta: 'src/components', tipo: 'subpastas' },
  { pasta: 'src/pages', tipo: 'arquivos' },
  { pasta: 'supabase/functions', tipo: 'subpastas' },
  { pasta: 'src/lib', tipo: 'inteira' },
  { pasta: 'src/hooks', tipo: 'inteira' },
  { pasta: 'src/services', tipo: 'inteira' },
  { pasta: 'scripts', tipo: 'inteira' },
  { pasta: 'e2e', tipo: 'inteira' },
  { pasta: '.github/workflows', tipo: 'inteira' },
];

/**
 * Uma unidade está coberta quando ALGUM território a alcança — em qualquer das
 * duas direções.
 *
 * As duas direções importam e a segunda não é óbvia: o território
 * `src/pages/Admin.jsx` é mais específico do que a unidade `src/pages`, e
 * ainda assim cobre parte dela. Exigir só `unidade.startsWith(territorio)`
 * marcaria `src/pages` como órfã tendo dois documentos cuidando dela.
 */
export function coberta(unidade, caminhos) {
  return caminhos.some(t => unidade === t
    || unidade.startsWith(`${t}/`)
    || t.startsWith(`${unidade}/`));
}
