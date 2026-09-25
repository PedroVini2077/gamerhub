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
