import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CAMPOS } from '../../../e2e/editarPerfil.mjs';
import { varrerFontes } from './varrerFontes';

/**
 * `[02/10]` O roteiro que edita o perfil precisa achar os campos.
 *
 * ── O silencio que ela fecha ──────────────────────────────────────────────
 *
 * `e2e/editarPerfil.mjs` encontra os campos por `#bio` e por
 * `getByRole('textbox', { name: 'Discord' })`. Renomear o `aria-label` do
 * campo de Discord, ou tirar o `id` da bio, nao quebra teste nenhum de `src/`
 * — a tela continua certa para quem usa. O que acontece e o E2E comecar a
 * morrer no CI com
 *
 *     TimeoutError: waiting for locator("#bio")
 *
 * que e exatamente a mensagem muda de que o `publicarPost.mjs` reclama no
 * cabecalho dele. Quem esbarrar nisso daqui a seis meses vai procurar o bug no
 * roteiro, e o conserto e uma linha noutro arquivo.
 *
 * ── O que ela NAO prova ───────────────────────────────────────────────────
 *
 * Que o salvamento FUNCIONA — isso e o E2E, num navegador de verdade, e ele
 * exige a conta descartavel que so o CI tem. Esta trava responde uma pergunta
 * so: **os campos que o roteiro procura existem na tela?**
 *
 * ── Provada reinjetando o bug (§2) ───────────────────────────────────────
 *
 * Trocado `aria-label={label}` do `SocialLinksCard` -> falhou nomeando
 * `discord`, a ancora que sumiu e o arquivo onde ela deveria estar.
 */

const PASTA = 'src/components/profile';

describe('o roteiro de editar perfil acha os campos na tela', () => {
  const fontes = varrerFontes(PASTA)
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');

  it('a lista de campos nao esta vazia', () => {
    // Sem isto, exportar `CAMPOS = []` por engano faria o `for` abaixo nao
    // rodar nenhuma vez e o teste ficar verde para sempre.
    expect(CAMPOS.length, '`CAMPOS` veio vazio de e2e/editarPerfil.mjs.').toBeGreaterThan(0);
  });

  for (const campo of CAMPOS) {
    it(`a tela tem o campo \`${campo.nome}\``, () => {
      expect(
        fontes.includes(campo.ancora),
        `o roteiro \`e2e/editarPerfil.mjs\` procura o campo \`${campo.nome}\`\n`
        + `    pela marca  ${campo.ancora}\n`
        + `    e ela nao existe em ${PASTA}/.\n`
        + '\n'
        + '    Se o campo foi renomeado de proposito, ajuste a `ancora` E o\n'
        + '    `seletor` do mesmo item em e2e/editarPerfil.mjs — os dois juntos.\n'
        + '    Sem isso o E2E morre no CI com um `waiting for locator` mudo, e\n'
        + '    quem for investigar vai procurar o bug no roteiro errado.',
      ).toBe(true);
    });
  }
});
