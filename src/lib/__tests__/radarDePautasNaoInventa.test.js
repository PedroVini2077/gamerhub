import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lerFeed, fatiaJusta } from '../../../supabase/functions/radar-de-pautas/rss.ts';

/**
 * `[26/09]` O radar de pautas não pode inventar notícia nem fonte.
 *
 * ── Por que esta trava é diferente das outras de IA ───────────────────────
 *
 * A `redigir-materia` recusa trabalhar sem notas: o editor é obrigado a trazer
 * o fato. O radar **não pode** fazer isso — a função dele é justamente trazer
 * o fato. Então a garantia tem de vir de outro lugar: os fatos entram por RSS
 * de fontes cadastradas, e o modelo só reordena o que entrou.
 *
 * Isso cria uma superfície que a outra não tem: o modelo devolve **endereços**.
 * Nada impede um LLM de escrever `https://www.ign.com/noticia-plausivel` — e
 * uma URL inventada de um site conhecido é indistinguível de apuração, do lado
 * de quem lê. A guarda é conjunto fechado, e esta trava existe para ela.
 */

const CAMINHO = 'supabase/functions/radar-de-pautas/index.ts';
const FONTE = readFileSync(CAMINHO, 'utf8');

if (FONTE.length < 3000) {
  throw new Error(
    `${CAMINHO} tem ${FONTE.length} caracteres — pequeno demais para ser a funcao.\n`
    + '  Ela foi movida ou apagada? Sem esta guarda, as travas deste arquivo\n'
    + '  passariam verde sem ter lido uma linha do que vigiam.');
}

describe('a fonte de cada pauta e REAL', () => {
  it('a funcao monta um conjunto fechado com os enderecos coletados', () => {
    expect(FONTE, 'o conjunto `enderecosValidos` sumiu da Edge Function. Ele e o '
      + 'que impede o modelo de citar uma URL que ele mesmo escreveu: sem ele, '
      + '"fontes confiaveis" vira promessa do prompt, e basta o modelo inventar '
      + 'um endereco plausivel de um site conhecido para ele chegar na tela.')
      .toMatch(/enderecosValidos\s*=\s*new Set\(/);
    expect(FONTE, 'o conjunto existe mas ninguem o consulta').toMatch(/enderecosValidos\.has\(/);
  });

  it('pauta que perdeu todas as fontes e DESCARTADA', () => {
    // Deixar passar a pauta sem URL seria pior do que nao ter guarda nenhuma:
    // ela chegaria na tela com titulo e angulo, parecendo apurada, e sem nada
    // que o editor pudesse abrir para conferir.
    expect(FONTE, 'a pauta sem nenhuma fonte valida voltou a ser aceita').
      toMatch(/if\s*\(!urls\.length\)\s*return \[\]/);
  });

  it('o descarte GRITA em vez de acontecer em silencio', () => {
    // Modelo inventando endereco e sinal de que o prompt parou de segurar.
    // Descartar calado esconderia a degradacao (§1.5).
    expect(FONTE).toMatch(/inventados\s*>\s*0[\s\S]{0,200}gritar\(/);
  });
});

describe('a porta e o pedido', () => {
  it('exige `is_staff()`, nao so estar logado', () => {
    expect(FONTE).toMatch(/rpc\(\s*"is_staff"\s*\)/);
    expect(FONTE).toMatch(/ehEquipe\s*!==\s*true[\s\S]{0,200}?403/);
  });

  it('a instrucao proibe assunto fora da lista coletada', () => {
    expect(FONTE).toMatch(/SOMENTE com as manchetes da lista/);
    expect(FONTE).toMatch(/nao invente\s*\n?endereco|nao invente endereco/i);
  });

  it('uma fonte que falha nao derruba as outras', () => {
    // Doze feeds de terceiros: um estar fora do ar e o caso NORMAL, nao a
    // exceção. Se a falha de um abortasse a coleta, o radar so funcionaria
    // nos dias em que os doze estivessem de pe.
    expect(FONTE).toMatch(/comFalha\.push\(/);
    expect(FONTE).toMatch(/Promise\.all\(/);
  });
});

describe('o leitor de RSS', () => {
  const RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
    <item>
      <title><![CDATA[Jogo X ganha data de lançamento]]></title>
      <link>https://exemplo.com/jogo-x</link>
      <description>&lt;p&gt;O estúdio anunciou &amp;amp; confirmou.&lt;/p&gt;</description>
      <pubDate>Fri, 26 Sep 2026 10:00:00 GMT</pubDate>
    </item>
    <item><title>Sem link</title><description>nada</description></item>
    <item><title>Link relativo</title><link>/interno</link></item>
  </channel></rss>`;

  const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
    <entry>
      <title>Console Y baixa de preço</title>
      <link href="https://exemplo.org/console-y" rel="alternate"/>
      <summary>Corte de 20% anunciado.</summary>
      <updated>2026-09-26T09:00:00Z</updated>
    </entry>
  </feed>`;

  it('le RSS 2.0, com CDATA e entidade', () => {
    const [primeiro] = lerFeed(RSS);
    expect(primeiro.titulo).toBe('Jogo X ganha data de lançamento');
    expect(primeiro.url).toBe('https://exemplo.com/jogo-x');
    // CDATA desfeito, tag removida, entidade resolvida — nessa ordem.
    expect(primeiro.resumo).toBe('O estúdio anunciou & confirmou.');
    expect(primeiro.publicado_em).toMatch(/^2026-09-26T/);
  });

  it('le Atom, onde o link e ATRIBUTO e nao conteudo', () => {
    // Os dois formatos convivem entre as 12 fontes. Ler so RSS deixaria as
    // de Atom devolvendo zero item — em silencio, porque feed vazio e um
    // estado legitimo.
    const [e] = lerFeed(ATOM);
    expect(e.titulo).toBe('Console Y baixa de preço');
    expect(e.url).toBe('https://exemplo.org/console-y');
  });

  it('descarta item sem endereco ABSOLUTO, e nao o inventa', () => {
    // Item sem link ou com link relativo viraria pauta sem fonte abrivel.
    // Completar a URL com o dominio do feed seria adivinhar.
    const urls = lerFeed(RSS).map((i) => i.url);
    expect(urls).toEqual(['https://exemplo.com/jogo-x']);
  });

  it('feed quebrado devolve lista vazia em vez de estourar', () => {
    expect(lerFeed('isto nao e xml')).toEqual([]);
    expect(lerFeed('')).toEqual([]);
  });

  it('respeita o teto de itens por feed', () => {
    const muitos = `<rss>${'<item><title>t</title><link>https://a.com/x</link></item>'.repeat(40)}</rss>`;
    expect(lerFeed(muitos, 15)).toHaveLength(15);
  });
});

describe('a fatia que vai ao modelo e JUSTA entre as fontes', () => {
  // O defeito era `slice(0, 60)` sobre uma lista preenchida na ordem em que o
  // `Promise.all` termina: as fontes RAPIDAS comiam as vagas das boas. Nada
  // estourava — a resposta saia plausivel, so mais pobre.
  const criar = (fonte, n) => Array.from({ length: n }, (_, i) => ({ fonte, i }));

  it('a fonte GRANDE nao engole a vaga da pequena', () => {
    const itens = [...criar('gigante', 100), ...criar('pequena', 3)];
    const fatia = fatiaJusta(itens, (x) => x.fonte, 10);

    const daPequena = fatia.filter((x) => x.fonte === 'pequena').length;
    expect(daPequena, 'a fonte pequena perdeu lugar para a grande. Era o bug: '
      + 'Eurogamer e RPS devolvem 100 itens cada, e tres fontes rapidas podiam '
      + 'ocupar as 60 vagas antes de as outras dez chegarem.').toBe(3);
    expect(fatia).toHaveLength(10);
  });

  it('os PRIMEIROS de cada fonte vem primeiro — sao os mais recentes', () => {
    const itens = [...criar('a', 5), ...criar('b', 5), ...criar('c', 5)];
    const fatia = fatiaJusta(itens, (x) => x.fonte, 6);
    // rodizio: a0 b0 c0 a1 b1 c1 — e nao a0 a1 a2 a3 a4 b0
    expect(fatia.map((x) => `${x.fonte}${x.i}`)).toEqual(['a0', 'b0', 'c0', 'a1', 'b1', 'c1']);
  });

  it('nao gira para sempre quando ha menos itens que o teto', () => {
    // Sem a saida do laco isto travaria a Edge Function — e travar e pior do
    // que devolver pouco.
    expect(fatiaJusta(criar('a', 2), (x) => x.fonte, 50)).toHaveLength(2);
    expect(fatiaJusta([], (x) => x.fonte, 50)).toEqual([]);
    expect(fatiaJusta(criar('a', 9), (x) => x.fonte, 0)).toEqual([]);
  });
});
