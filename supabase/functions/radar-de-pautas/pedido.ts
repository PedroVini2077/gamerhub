// O PEDIDO AO MODELO — montagem e leitura da resposta.
//
// ============================================================================
// POR QUE ESTE ARQUIVO EXISTE, e o número que o produziu
// ============================================================================
//
// `[01/10]` O radar estava quebrado em **7 de 7 chamadas** entre 26 e 28/09, e
// o motivo estava gravado em `admin_logs` desde a primeira:
//
//     Request too large for model `openai/gpt-oss-120b` ... service tier
//     `on_demand` on tokens per minute (TPM): Limit 8000, Requested 9231
//
// Não era corpo HTTP grande demais, que é o que `413` costuma significar: é o
// teto de **tokens por minuto** do plano gratuito aplicado a uma requisição
// só. E a Groq soma o `max_tokens` ao que você pediu — os 2.500 reservados
// para a resposta contavam contra o mesmo teto de 8.000.
//
// Medido no banco, com o conteúdo real das fontes de hoje:
//
//     60 itens, formato antigo ....... 27.310 chars  (~6.700 tokens)
//       dos quais só as URLs .......... 6.027 chars
//       dos quais só os resumos ...... 15.171 chars (8.246 se cortados em 160)
//
// ============================================================================
// AS TRÊS MUDANÇAS, e o que cada uma resolve
// ============================================================================
//
// **1. O modelo recebe NÚMERO, e devolve NÚMERO.** A URL saiu da lista: cada
// manchete vai numerada, e a pauta cita `"itens": [3, 17]`. Isso não é só
// economia de 6.027 chars na entrada e de ~500 por pauta na saída — é o que
// torna **impossível** citar fonte inventada. Antes a garantia era um filtro:
// o modelo *podia* escrever `https://www.ign.com/noticia-plausivel` e nós
// descartávamos por não estar no conjunto. Agora não há campo onde escrever
// uma URL: o endereço é resolvido aqui, do item que nós mesmos mandamos.
// *(Guarda que o filtro antigo exercia de verdade: ele pegou 1 endereço
// inventado em produção, em 28/09.)*
//
// **2. O resumo vai cortado em 160 chars PARA O MODELO.** O resumo inteiro
// continua gravado em `news_items_raw` e continua indo nas `notas` do
// rascunho, que é onde ele vale. 160 chars bastam para o modelo saber do que
// a manchete trata e agrupar as repetidas.
//
// **3. O pedido tem ORÇAMENTO, e ele é derivado do teto, não digitado.** A
// lista para de crescer quando o orçamento acaba — mesma filosofia do portão
// de bytes (§0.3): tempo e token oscilam, caractere é determinístico. Se
// amanhã uma fonte começar a devolver resumo três vezes maior, entram menos
// itens; o que não acontece é o pedido estourar de novo em silêncio.
//
// O orçamento é CONSERVADOR de propósito. `CHARS_POR_TOKEN` está em 3,6
// enquanto o conteúdo medido dá ~4,3: errar para baixo manda itens a menos,
// errar para cima manda o radar inteiro para o `413`.

import type { ItemBruto } from "./rss.ts";
import { INSTRUCAO } from "./contrato.ts";

/** Teto de tokens por minuto do plano gratuito, medido no corpo do erro 413. */
export const TPM_DO_PLANO = 8_000;

/**
 * `[01/10]` O ESPAÇO DO RACIOCÍNIO — e ele é a causa do `json_validate_failed`.
 *
 * ── A regressão, e ela foi minha, no mesmo dia ──────────────────────────────
 *
 * De manhã eu baixei a reserva de saída de 2.500 para 1.300 para matar o `413`.
 * O `413` morreu. À tarde apareceu, de forma INTERMITENTE:
 *
 *     HTTP 400 · code: json_validate_failed
 *     "Failed to validate JSON. Please adjust your prompt."
 *     failed_generation: ""        <- VAZIO
 *
 * **`failed_generation` vazio não é JSON ruim: é NENHUMA saída.** Prompt ruim
 * produz JSON malformado; aqui o modelo não escreveu caractere nenhum.
 *
 * ── O mecanismo ────────────────────────────────────────────────────────────
 *
 * O `gpt-oss-120b` é modelo de RACIOCÍNIO. Ele gasta tokens de cadeia de
 * pensamento — a documentação da Groq dá `reasoning_effort` só para os GPT-OSS,
 * e relatos convergentes medem **300 a 900 tokens** antes da resposta — e esses
 * tokens saem do MESMO `max_tokens`.
 *
 * O JSON de 8 pautas citando números custa ~900 tokens. 900 + 900 = 1.800, e a
 * reserva era 1.300: fica **em cima da fronteira**, e é por isso que falhava
 * "às vezes" em vez de sempre. Quando o raciocínio ganha a corrida, o `content`
 * sai vazio e o validador de JSON da Groq recusa o pedido inteiro.
 *
 * ── Eu apertei o lado ERRADO, e o número prova ─────────────────────────────
 *
 * No `429` de cinco minutos depois a Groq disse `Requested 4364` contra teto de
 * 8.000 — e 4364 − 1300 = **3.064 tokens de entrada**. Sobravam ~3.600 tokens
 * sem uso. O pedido nunca esteve apertado; só a saída estava.
 */
export const RESERVA_DE_RACIOCINIO = 900;

/** O JSON de `TETO_DE_PAUTAS` pautas, medido pelo tamanho dos campos. */
export const RESERVA_DA_RESPOSTA = 1_000;

/**
 * `max_tokens`: a resposta **mais** o raciocínio, que dividem o mesmo teto.
 *
 * Os 500 de sobra existem porque `reasoning_effort: "low"` reduz a cadeia de
 * pensamento mas não a elimina, e porque o modelo pode alongar um ângulo.
 */
export const RESERVA_DE_SAIDA = RESERVA_DA_RESPOSTA + RESERVA_DE_RACIOCINIO + 500;

/**
 * `[01/10]` MEDIDO, e não mais chutado para baixo.
 *
 * Era 3,6 — escolhido conservador quando eu não tinha número. A Groq entregou
 * um: `Requested 4364` com `max_tokens` 1.300 e uma lista de 14.527 chars dá
 * 3.064 tokens de entrada, ou seja **4,74 chars/token** neste conteúdo.
 *
 * 4,3 mantém ~9% de margem abaixo do medido. A conservadoria de 3,6 custava
 * 26% do orçamento à toa — e era ela que não deixava espaço para a saída
 * crescer sem a lista encolher.
 */
export const CHARS_POR_TOKEN = 4.3;

/** Usar só 3/4 do teto. O que sobra absorve a variação de tokenização. */
export const FOLGA = 0.75;

/** Quanto de cada resumo o modelo vê. O inteiro continua indo nas notas. */
export const RESUMO_PARA_O_MODELO = 160;

export type ItemDoRadar = ItemBruto & { fonte_id: string; fonte_nome: string };

/**
 * Quantos caracteres de lista cabem, descontando instrução e resposta.
 *
 * Derivado e não digitado: um número escrito à mão aqui envelheceria calado
 * no dia em que a instrução crescesse ou o teto do plano mudasse — e o
 * sintoma seria exatamente o `413` que isto existe para impedir.
 */
export function orcamentoDaLista(instrucao: string): number {
  const tetoEmTokens = TPM_DO_PLANO * FOLGA;
  const daInstrucao = Math.ceil(instrucao.length / CHARS_POR_TOKEN);
  const sobra = tetoEmTokens - RESERVA_DE_SAIDA - daInstrucao;
  return Math.max(0, Math.floor(sobra * CHARS_POR_TOKEN));
}

export const ORCAMENTO_DA_LISTA = orcamentoDaLista(INSTRUCAO);

/**
 * Monta a lista numerada respeitando o orçamento.
 *
 * Devolve também `usados`: os itens que de fato entraram, **na ordem da
 * numeração**. É essa lista que `resolverPautas` indexa — por isso ela sai
 * daqui junto com o texto, e não é recalculada depois. Duas listas que
 * precisam concordar são duas listas que vão divergir (§4).
 */
export function montarPedido(itens: ItemDoRadar[], orcamento: number): {
  lista: string;
  usados: ItemDoRadar[];
  chars: number;
} {
  const linhas: string[] = [];
  const usados: ItemDoRadar[] = [];
  let chars = 0;

  for (const item of itens) {
    const resumo = (item.resumo ?? "").slice(0, RESUMO_PARA_O_MODELO);
    const linha = `${usados.length + 1}. [${item.fonte_nome}] ${item.titulo}\n   ${resumo}`;
    if (chars + linha.length + 1 > orcamento) break;
    chars += linha.length + 1;
    linhas.push(linha);
    usados.push(item);
  }

  return { lista: linhas.join("\n"), usados, chars };
}

export type Pauta = {
  titulo: string;
  angulo: string;
  editoria: string;
  por_que_agora: string;
  urls: string[];
  notas: string;
};

/**
 * Lê a resposta do modelo e resolve os números em itens reais.
 *
 * `foraDaLista` conta tudo que o modelo citou e não existe: número fora da
 * faixa, texto no lugar de número, lista vazia. Não é erro fatal — é o sinal
 * de que o prompt parou de segurar, e quem o descarta calado esconde a
 * degradação (§1.5). Quem chama grita.
 */
export function resolverPautas(
  resposta: unknown,
  usados: ItemDoRadar[],
  teto: number,
): { pautas: Pauta[]; foraDaLista: number } {
  const cruas = Array.isArray((resposta as { pautas?: unknown })?.pautas)
    ? (resposta as { pautas: unknown[] }).pautas
    : [];
  let foraDaLista = 0;

  const pautas = cruas.slice(0, teto).flatMap((bruta): Pauta[] => {
    const p = (bruta ?? {}) as Record<string, unknown>;
    const citados = Array.isArray(p.itens) ? p.itens : [];

    const escolhidos = citados.flatMap((n: unknown): ItemDoRadar[] => {
      // `"3"` e `3` chegam os dois: `json_object` não garante o tipo de dentro.
      const indice = typeof n === "number" ? n : Number.parseInt(String(n), 10);
      const item = Number.isInteger(indice) ? usados[indice - 1] : undefined;
      if (!item) { foraDaLista++; return []; }
      return [item];
    });

    // O mesmo número citado duas vezes não vira fonte duas vezes.
    const unicos = [...new Map(escolhidos.map((i) => [i.url, i])).values()].slice(0, 5);

    // Pauta sem nenhuma fonte válida não é pauta: é afirmação sem lastro, e
    // chegaria na tela com título e ângulo, parecendo apurada.
    if (!unicos.length) return [];

    return [{
      titulo:        String(p.titulo ?? "").slice(0, 200),
      angulo:        String(p.angulo ?? "").slice(0, 500),
      editoria:      String(p.editoria ?? "").slice(0, 40),
      por_que_agora: String(p.por_que_agora ?? "").slice(0, 300),
      // As URLs são NOSSAS, do item que nós mandamos — o modelo não as escreve.
      urls: unicos.map((i) => i.url),
      // Aqui vai o resumo INTEIRO, não o cortado: as notas são o que a
      // `redigir-materia` exige para escrever, e ela precisa do fato completo.
      notas: unicos.map((i) => `[${i.fonte_nome}] ${i.titulo}\n${i.resumo}\n${i.url}`)
        .join("\n\n"),
    }];
  });

  return { pautas, foraDaLista };
}
