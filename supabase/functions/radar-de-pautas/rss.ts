// O leitor de RSS — e por que ele é escrito à mão.
//
// Deno não traz parser de XML, e puxar uma biblioteca para ler 5 campos de um
// formato estável custaria mais do que ela resolve. O que se extrai aqui é
// `title`, `link`, `description`/`summary` e a data — presentes em RSS 2.0 e
// em Atom, que são os dois formatos que os 12 feeds medidos usam.
//
// O QUE ESTE PARSER NÃO FAZ, escrito para ninguém descobrir do jeito caro:
// ele não valida XML, não segue `xml:base`, e não entende namespace exótico.
// Feed malformado devolve item a menos — nunca derruba a coleta, porque um
// feed quebrado não pode calar os outros onze.

export type ItemBruto = {
  titulo: string;
  url: string;
  resumo: string;
  publicado_em: string | null;
};

function entidades(t: string): string {
  return t
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");   // por ultimo: senao `&amp;lt;` viraria `<` cedo demais
}

/**
 * Tira CDATA, tag HTML e entidade — o resumo de feed vem cheio dos três.
 *
 * **A ORDEM É O QUE IMPORTA AQUI, e eu errei nela.** A primeira versão tirava
 * as tags antes de decodificar, e o `description` de RSS carrega o HTML
 * *escapado* (`&lt;p&gt;`): o removedor de tags não via tag nenhuma, e o `<p>`
 * aparecia como texto literal no resumo. Foi a trava que pegou, no 1º run.
 *
 * Então são DOIS passes de entidade: um para revelar o HTML escapado, outro
 * para o texto que sobra depois de as tags saírem. É a convenção do formato —
 * o conteúdo vem codificado duas vezes, não uma.
 *
 * O resultado é sempre TEXTO, e só é renderizado como texto: o React escapa,
 * e o projeto segue em zero `dangerouslySetInnerHTML` (INV-TELA-008).
 */
function limpar(texto: string, teto = 400): string {
  const semCdata = texto.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return entidades(entidades(semCdata).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, teto);
}

function pegar(bloco: string, tags: string[]): string {
  for (const tag of tags) {
    const m = bloco.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    if (m?.[1]?.trim()) return m[1];
  }
  return "";
}

/** O `link` do Atom é atributo (`<link href="…"/>`), o do RSS é conteúdo. */
function pegarLink(bloco: string): string {
  const atom = bloco.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (atom?.[1]) return atom[1];
  return limpar(pegar(bloco, ["link", "guid"]), 500);
}

export function lerFeed(xml: string, teto = 15): ItemBruto[] {
  const blocos = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)]
    .map((m) => m[0])
    .slice(0, teto);

  return blocos.flatMap((bloco) => {
    const url = pegarLink(bloco);
    const titulo = limpar(pegar(bloco, ["title"]), 300);
    // Item sem título ou sem endereço não é pauta: é ruído que ocuparia
    // espaço no pedido ao modelo e confundiria a deduplicação.
    if (!titulo || !/^https?:\/\//i.test(url)) return [];

    const data = limpar(pegar(bloco, ["pubDate", "published", "updated", "dc:date"]), 60);
    const quando = data ? new Date(data) : null;

    return [{
      titulo,
      url,
      resumo: limpar(pegar(bloco, ["description", "summary", "content"]), 400),
      publicado_em: quando && !Number.isNaN(quando.getTime()) ? quando.toISOString() : null,
    }];
  });
}

/**
 * `[26/09]` A FATIA JUSTA: escolhe `teto` itens dando vez a cada fonte.
 *
 * ── O defeito que ela conserta, e ele era MEDIDO ───────────────────────────
 *
 * A primeira versão fazia `coletados.slice(0, 60)`. Como `coletados` é
 * preenchido na ordem em que o `Promise.all` termina, quem ganhava vaga eram
 * as fontes mais **rápidas**, não as melhores.
 *
 * O caso real: 13 fontes × 15 itens = até 195 candidatos para 60 vagas.
 * Eurogamer e Rock Paper Shotgun devolvem 100 itens cada; Canaltech, 50. Três
 * fontes rápidas podiam ocupar quase tudo e uma fonte inteira não chegar ao
 * modelo — sem erro, sem log, e com a resposta saindo plausível, só mais
 * pobre. É a "cobertura que não cobre" do §1.5.
 *
 * ── Como ela escolhe ───────────────────────────────────────────────────────
 *
 * Rodízio: o 1º de cada fonte, depois o 2º de cada, e assim por diante. Fonte
 * com poucos itens simplesmente sai do rodízio quando esgota — ela não segura
 * as outras nem perde a vez.
 *
 * A ordem de saída é intencional: os **primeiros de cada fonte** vêm juntos, e
 * num feed o primeiro item é o mais recente. Então o começo da lista que vai
 * ao modelo é o que há de mais novo em toda a rede de fontes.
 *
 * @param itens itens já coletados, em qualquer ordem
 * @param chave como agrupar (a fonte de cada item)
 * @param teto quantos itens no máximo
 */
export function fatiaJusta<T>(itens: T[], chave: (i: T) => string, teto: number): T[] {
  if (teto <= 0) return [];

  const porFonte = new Map<string, T[]>();
  for (const i of itens) {
    const lista = porFonte.get(chave(i));
    if (lista) lista.push(i);
    else porFonte.set(chave(i), [i]);
  }

  const filas = [...porFonte.values()];
  const escolhidos: T[] = [];
  for (let n = 0; escolhidos.length < teto; n++) {
    const antes = escolhidos.length;
    for (const fila of filas) {
      if (escolhidos.length >= teto) break;
      if (n < fila.length) escolhidos.push(fila[n]);
    }
    // Nenhuma fila tinha item na posição `n`: todas esgotaram. Sem esta saída
    // o laço giraria para sempre quando houvesse menos itens do que o teto.
    if (escolhidos.length === antes) break;
  }
  return escolhidos;
}
