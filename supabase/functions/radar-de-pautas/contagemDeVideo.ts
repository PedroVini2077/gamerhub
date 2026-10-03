// O SINAL DE VÍDEO, do lado da CONTAGEM — e por que ele é um arquivo próprio.
//
// `[02/10]` Saiu do `youtube.ts` quando ele passou de 300 linhas (§4), e o
// corte caiu na junta certa: aquele arquivo fala com a API do Google (URL,
// HTTP, cota, formato da resposta) e **este não toca em rede**. Tudo aqui é
// função pura sobre uma lista de vídeos que já chegou.
//
// É o que torna a parte mais delicada — "quantos vídeos falam DESTA pauta" —
// exercitável sem chave e sem rede, que é justamente onde os dois defeitos
// reais apareceram.

import type { Video } from "./youtube.ts";

/** Tira acento e caixa: "Pokemon" tem de casar com "Pokémon". */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * `[02/10]` Os termos que DISTINGUEM uma pauta das outras.
 *
 * ── O defeito que isto conserta, visto no 2º clique real ─────────────────
 *
 * Duas pautas marcaram **exatamente 15 vídeos** — "hacking e emulação do PS5"
 * e "Nacon lança controlador para PS5". As duas trazem o termo `ps5`, que casa
 * com qualquer vídeo de PlayStation publicado no dia.
 *
 * O número não estava errado: ele estava **respondendo outra pergunta**. "15
 * vídeos falam de PS5" não é "15 vídeos falam do controle da Nacon" — e quem
 * lê a tela decide a pauta achando que é a segunda.
 *
 * ── A regra, e ela já existe neste projeto ───────────────────────────────
 *
 * É a mesma do `editoriaProvavel`: palavra que serve a várias categorias não
 * sustenta nenhuma sozinha. Aqui, termo que aparece em **mais de uma pauta**
 * sai da CONTAGEM.
 *
 * **Ele continua na CONSULTA**, de propósito: `ps5` traz vídeos que os termos
 * específicos não trariam, e um deles pode mencionar "Nacon" no título. Tirar
 * da busca perderia material; tirar da contagem é o que torna o número
 * honesto.
 *
 * ── O que se perde, dito com todas as letras ─────────────────────────────
 *
 * Pauta cujos termos são TODOS genéricos fica sem sinal. É a resposta certa:
 * não dá para distinguir, então não se afirma nada. Melhor sem selo do que
 * com um número que mede o vizinho.
 */
export function termosQueDistinguem(pautas: { termos: string[] }[]): Set<string> {
  const emQuantasPautas = new Map<string, number>();
  for (const p of pautas) {
    // `new Set` por pauta: termo repetido DENTRO da mesma pauta nao a torna
    // generica — "gta" e "gta 6" sao a mesma pauta falando duas vezes.
    for (const t of new Set(p.termos.map((x) => normalizar(x.trim())))) {
      emQuantasPautas.set(t, (emQuantasPautas.get(t) ?? 0) + 1);
    }
  }
  return new Set([...emQuantasPautas].filter(([, n]) => n === 1).map(([t]) => t));
}

/**
 * Quantos dos vídeos recentes falam desta pauta.
 *
 * Casa por SUBSTRING no título normalizado, e o termo precisa de 3 caracteres
 * — mesma régua do sinal de aceleração, e pelo mesmo motivo: termo de duas
 * letras casa com tudo e o número vira ruído com cara de medida.
 *
 * **Conta VÍDEO, não casamento.** Um vídeo cujo título bate com três termos da
 * mesma pauta é um vídeo, não três — senão a pauta com mais sinônimos ganharia
 * sozinha, que é exatamente o erro do "score mágico" que o plano recusa.
 */
export function contarVideosDaPauta(
  termos: string[], videos: Video[], queDistinguem?: Set<string>,
): number {
  const alvos = [...new Set(
    termos.map((t) => normalizar(t.trim()))
      .filter((t) => t.length >= 3)
      // Sem o conjunto, conta com tudo — e o chamador real sempre o manda.
      .filter((t) => !queDistinguem || queDistinguem.has(t)),
  )];
  if (!alvos.length) return 0;
  return videos.filter((v) => {
    const t = normalizar(v.titulo);
    return alvos.some((a) => t.includes(a));
  }).length;
}

/**
 * O rótulo. **Lista fechada e número refazível**, como o da aceleração: quem
 * lê "3 videos hoje" consegue conferir contando, e "87 de relevância" não.
 *
 * Um vídeo só não vira rótulo: um canal qualquer postando sobre o assunto não
 * é sinal de nada, e rótulo que aparece sempre deixa de informar.
 */
export function rotuloDeVideo(quantos: number): string {
  if (quantos < 2) return "";
  return `${quantos} videos hoje`;
}
