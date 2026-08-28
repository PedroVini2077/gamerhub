import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Trava do bug de 28/08/2026: `too_many_images`.
 *
 * ── O que aconteceu ────────────────────────────────────────────────────────
 *
 * A `moderate-image` mandava as imagens do post todas de uma vez, num `input`
 * só. A API `omni-moderation-latest` aceita **uma imagem por requisição** e
 * respondia:
 *
 *     400 too_many_images — "Number of images (4) exceeds maximum of 1"
 *
 * O efeito não era degradação, era TUDO OU NADA: post de 1 imagem era
 * analisado; post de 2 ou mais **não era analisado de forma nenhuma**. E a
 * moderação de vídeo, que nasceu mandando vários quadros numa chamada só,
 * nunca funcionou um único dia.
 *
 * ── Por que ninguém percebeu ───────────────────────────────────────────────
 *
 * Porque o caminho é fire-and-forget: o site dispara e não espera resposta.
 * Do lado de quem publica, "moderação não achou nada" e "moderação nunca
 * rodou" são exatamente a mesma tela. O `gritar()` em `admin_logs` foi o que
 * tornou o bug visível — e mesmo assim ele só dizia "provedor não respondeu",
 * porque o 400 morria num `console.error` (§1.5, fonte 7).
 *
 * ── Por que um teste de contrato, e não um teste de unidade ────────────────
 *
 * O erro não estava numa lógica que dá para chamar de dentro do Vitest: estava
 * no FORMATO de uma requisição HTTP para um serviço externo, dentro de código
 * Deno. O que dá para travar é a forma como o corpo é montado no fonte — do
 * mesmo jeito que `tiposDeConteudo.test.js` confronta o mapa `FONTES` da
 * `moderate-text`.
 *
 * Provado injetando o bug de volta: com `input: urls.map(...)` no lugar, este
 * arquivo falha nomeando `too_many_images`.
 */

const EDGE = join(
  import.meta.dirname, '../../../supabase/functions/moderate-image/index.ts',
);

const fonte = readFileSync(EDGE, 'utf8');

/** O corpo da função que fala com a OpenAI. */
function corpoDoViaOpenAI() {
  const m = fonte.match(/async function viaOpenAI[\s\S]*?\n}/);
  return m ? m[0] : '';
}

describe('moderate-image — uma imagem por requisição da OpenAI', () => {
  const corpo = corpoDoViaOpenAI();

  it('acha a função (guarda contra o regex quebrar em silêncio)', () => {
    expect(corpo, 'não consegui ler viaOpenAI de moderate-image/index.ts').toContain('OPENAI_URL');
  });

  it('declara o limite de 1 imagem por requisição', () => {
    const m = fonte.match(/MAX_IMAGENS_POR_REQUISICAO\s*=\s*(\d+)/);
    expect(m, 'a constante que documenta o limite da API sumiu').not.toBeNull();
    expect(
      Number(m[1]),
      'A `omni-moderation-latest` aceita no máximo 1 imagem por chamada.\n'
      + 'Se a OpenAI passar a aceitar mais, mude aqui E no corpo da requisição —\n'
      + 'mudar só um dos dois é a deriva que este teste existe para pegar.',
    ).toBe(1);
  });

  it('monta o input a partir do LOTE, nunca da lista inteira de uma vez', () => {
    const linhaInput = corpo.match(/input:.*/)?.[0] ?? '';

    expect(
      linhaInput,
      'O `input` da moderação voltou a receber a lista de imagens de uma vez.\n'
      + 'A API responde 400 too_many_images e o post inteiro passa SEM ANÁLISE —\n'
      + 'não é análise pior, é análise nenhuma, e em silêncio.\n'
      + 'O certo é fatiar `urls` em lotes de MAX_IMAGENS_POR_REQUISICAO; a\n'
      + 'agregação por pior caso em `decidir()` dá o mesmo resultado final.',
    ).not.toMatch(/urls\.map/);

    expect(linhaInput, 'esperava o `input` montado a partir do lote').toMatch(/lote/);
  });

  it('fatia as URLs pelo tamanho declarado do lote', () => {
    expect(
      corpo,
      'Sem o laço, só a primeira imagem do post seria analisada. E o passo tem\n'
      + 'que ser a constante: um passo escrito à mão diverge dela no dia em que\n'
      + 'a API mudar (§4, fonte única).',
    ).toMatch(/i \+= MAX_IMAGENS_POR_REQUISICAO/);
    expect(corpo).toMatch(/urls\.slice\(i, i \+ MAX_IMAGENS_POR_REQUISICAO\)/);
  });

  it('trata "nenhuma imagem respondeu" como NÃO ANALISADO, não como limpo', () => {
    expect(
      corpo,
      'Devolver um veredito vazio aqui diria "analisei e está limpo" sobre imagem\n'
      + 'que ninguém olhou. Quem chama precisa receber `null` para gritar em\n'
      + '`admin_logs` (§1.5).',
    ).toMatch(/if\s*\(analisadas === 0\)\s*return null/);
  });

  it('a análise parcial vira aviso na trilha de auditoria', () => {
    expect(
      fonte,
      'Com uma requisição por imagem, 3 de 4 podem responder. Sem este aviso, a\n'
      + 'imagem que ficou de fora é indistinguível de imagem aprovada.',
    ).toMatch(/analise parcial/);
  });
});
