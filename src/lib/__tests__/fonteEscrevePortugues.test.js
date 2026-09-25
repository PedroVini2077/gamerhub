import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FONTES_CONFERIDAS, FONTES_REPROVADAS } from '../fontesConferidas';

/**
 * `[26/09]` A fonte do site precisa saber escrever português.
 *
 * Parece óbvio e não é: a Orbitron ficou no ar escrevendo *"nào"* em todo
 * título até o dono ver num print. O glifo existia, o arquivo estava certo, e
 * nada acusava — o defeito era o desenho do til.
 *
 * **O que esta trava NÃO faz**, e está escrito para ninguém confiar demais
 * nela: ela não olha pixel. O defeito é perceptual e nenhuma medição barata o
 * pega (o raciocínio inteiro está em `lib/fontesConferidas.js`). O que ela faz
 * é impedir que uma fonte **não conferida** entre em produção sem alguém ter
 * renderizado e olhado.
 */

const TAILWIND = readFileSync('tailwind.config.js', 'utf8');
const FONTES_CSS = readFileSync('src/estilos/fontes.css', 'utf8');

/** As famílias declaradas no `fontFamily` do Tailwind. */
function familiasDoTailwind() {
  const bloco = TAILWIND.match(/fontFamily:\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  return [...bloco.matchAll(/["']'([^']+)'["']/g)].map((m) => m[1]);
}

describe('toda fonte do site foi conferida para o português', () => {
  it('a extração acha as famílias — senão a trava aprova o vazio', () => {
    const familias = familiasDoTailwind();
    expect(familias.length, 'nao achei nenhuma familia no `fontFamily` do '
      + 'tailwind.config.js. O formato mudou? Sem isto a trava passa verde sem '
      + 'olhar nada — a mesma vacuidade que o `varrerFontes` fecha.')
      .toBeGreaterThanOrEqual(3);
  });

  it('nenhuma família do Tailwind está fora da lista de conferidas', () => {
    const naoConferidas = familiasDoTailwind()
      .filter((f) => !Object.hasOwn(FONTES_CONFERIDAS, f));

    expect(naoConferidas, 'estas fontes entraram no `tailwind.config.js` sem '
      + 'passar pela conferencia de portugues:\n'
      + `  ${naoConferidas.join(', ')}\n\n`
      + '  A Orbitron ficou no ar escrevendo "nao" como "nao" com CRASE ate o '
      + 'dono ver num print — o glifo existia e nada acusava.\n'
      + '  Antes de acrescentar: renderize "nao opcoes CORACAO" (com os acentos) '
      + 'no tamanho REAL dos titulos, olhe, e registre em '
      + 'src/lib/fontesConferidas.js com a data e o metodo.')
      .toEqual([]);
  });

  it('nenhuma fonte REPROVADA voltou para o CSS', () => {
    // O caminho realista de a Orbitron voltar não é alguém decidir: é alguém
    // copiar um trecho velho de CSS, ou pedir a uma IA "a fonte gamer padrão".
    const voltaram = Object.keys(FONTES_REPROVADAS)
      .filter((f) => FONTES_CSS.includes(f) && !FONTES_CSS.includes(`A ${f} SAIU`));

    expect(voltaram, 'fonte REPROVADA de volta no `src/estilos/fontes.css`:\n'
      + voltaram.map((f) => `  ${f}: ${FONTES_REPROVADAS[f]}`).join('\n'))
      .toEqual([]);
  });

  it('a fonte de display tem `@font-face` e arquivo local', () => {
    // `[03/09]` As fontes moram no nosso domínio, não no Google — achado da
    // auditoria de privacidade. Trocar de fonte não pode reabrir isso.
    const display = familiasDoTailwind()[0];
    expect(FONTES_CSS, `a familia de display (${display}) nao tem @font-face em `
      + 'src/estilos/fontes.css. Sem ele o navegador cai no fallback do sistema '
      + '— ou, pior, alguem a traz do Google e todo visitante volta a entregar '
      + 'o IP para la (docs/PRIVACIDADE.md).')
      .toMatch(new RegExp(`font-family:\\s*'${display}'`));
    expect(FONTES_CSS).toMatch(/url\('\/fonts\/[^']+\.woff2'\)/);
  });
});
