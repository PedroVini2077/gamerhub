import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * `[09/10]` A MIGRAÇÃO PARA O TAILWIND 4 NÃO PODE MUDAR A APARÊNCIA.
 *
 * ── O combinado ───────────────────────────────────────────────────────────
 *
 * Ela foi feita por UM advisory sem conserto (`braces`). Não é redesenho — e
 * o §7 é explícito: não mudar comportamento nem visual por conta própria.
 *
 * ── Os três padrões que o v4 mudou, e o que cada um custaria ──────────────
 *
 * | o que mudou | v3 | v4 | aqui |
 * | --- | --- | --- | --- |
 * | borda sem classe de cor | `gray-200` | `currentColor` | 218 `border` nus |
 * | cursor do `<button>` | mãozinha | seta | 274 botões, 26 com `cursor-pointer` |
 * | cor do `placeholder` | `gray-400` | texto a 50% | 9 declaram; o resto herdava |
 *
 * **Nenhum deles quebra nada.** Cada um deixa o site um pouco diferente, em
 * silêncio, em centenas de lugares ao mesmo tempo — e a borda foi a única que
 * o codemod oficial cuidou sozinho.
 *
 * ── Por que isto é trava e não comentário ─────────────────────────────────
 *
 * `compatibilidade-do-v3.css` parece um arquivo de sobra: é CSS que "desfaz" o
 * framework, o tipo de coisa que a próxima faxina apaga achando que limpou.
 * Apagá-lo é uma mudança visual em 200+ pontos que **nenhum teste e nenhum
 * portão acusam** — o build passa, o lint passa, o orçamento de bytes até
 * melhora.
 *
 * ── O que ela NÃO cobre, dito antes que alguém confie demais ──────────────
 *
 * Ela lê o ARQUIVO, não a tela. Que o cursor realmente apareça como mãozinha
 * num navegador é coisa de roteiro E2E — e os três são padrão de Preflight,
 * então o que importa aqui é a regra existir e chegar ao CSS final.
 */

const COMPAT = 'src/estilos/compatibilidade-do-v3.css';
const TAILWIND = 'src/estilos/tailwind.css';

const fonte = () => readFileSync(COMPAT, 'utf8');

describe('o Tailwind 4 não mudou a aparência do site', () => {
  it('a folha de compatibilidade é importada — senão ela não existe', () => {
    // `[09/10]` Esta vem primeiro de propósito: um arquivo perfeito que
    // ninguém importa é o caso mais silencioso dos três. Ele continua no
    // repositório, continua passando nas checagens abaixo, e não chega ao
    // navegador.
    expect(
      /@import\s+'\.\/compatibilidade-do-v3\.css'/.test(readFileSync(TAILWIND, 'utf8')),
      'a folha de compatibilidade deixou de ser importada.\n'
      + 'O arquivo continua lá, os testes abaixo continuam verdes, e NADA dele\n'
      + 'chega ao site: borda, cursor e placeholder voltam ao padrão do v4 de\n'
      + 'uma vez.',
    ).toBe(true);
  });

  it('a cor da BORDA continua a do v3', () => {
    expect(
      /border-color:\s*var\(--color-gray-200/.test(fonte()),
      'a compatibilidade da cor da borda sumiu.\n'
      + 'No v4 `border` sem classe de cor vira `currentColor` — a borda passa a\n'
      + 'ter a cor do TEXTO. São 218 `border` nus no projeto, e o resultado é\n'
      + 'contorno neon em caixa que devia ter contorno discreto.',
    ).toBe(true);
  });

  it('o BOTÃO continua com a mãozinha', () => {
    expect(
      /button:not\(:disabled\)[\s\S]{0,80}cursor:\s*pointer/.test(fonte()),
      'o `cursor: pointer` dos botões sumiu.\n'
      + 'O v4 passou a seguir o padrão do navegador (`default`). São 274 botões\n'
      + 'no site e só 26 têm `cursor-pointer` escrito: os outros 248 deixam de\n'
      + 'parecer clicáveis. Moderar, curtir, publicar e abrir painel são tudo\n'
      + 'botão — é regressão de uso, não de estilo.',
    ).toBe(true);

    // `:not(:disabled)` importa: mãozinha em botão desligado promete uma ação
    // que não vai acontecer.
    expect(
      /:not\(:disabled\)/.test(fonte()),
      'o cursor voltou a valer para botão DESABILITADO.\n'
      + 'Mãozinha em botão que não responde promete uma ação que não acontece.',
    ).toBe(true);
  });

  it('o PLACEHOLDER continua com cor própria', () => {
    expect(
      /::placeholder[\s\S]{0,120}color:/.test(fonte()),
      'a cor do placeholder sumiu.\n'
      + 'O v4 usa a cor do texto a 50% de opacidade. Num tema ESCURO de texto\n'
      + 'claro, isso deixa o placeholder mais claro que o conteúdo digitado —\n'
      + 'o contrário do que ele precisa comunicar.',
    ).toBe(true);
  });

  it('o arquivo diz QUANDO pode ser removido', () => {
    // Sem isso ele vira dívida eterna: ninguém sabe se ainda é necessário, e
    // a resposta segura passa a ser "não mexe", para sempre.
    expect(
      /Quando REMOVER/.test(fonte()),
      'a folha de compatibilidade perdeu a condição de saída.\n'
      + 'É a mesma regra da lista de advisories aceitos: sem a linha que diz o\n'
      + 'que a torna desnecessária, "temporário" vira permanente e ninguém\n'
      + 'nunca mais tem base para apagar.',
    ).toBe(true);
  });
});
