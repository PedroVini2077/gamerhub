import { editoriaValida } from './editorias';

/**
 * `[02/10]` QUAL EDITORIA O TEXTO SUGERE — e por que isto saiu do assistente.
 *
 * ============================================================================
 * O BUG QUE PRODUZIU ESTE ARQUIVO
 * ============================================================================
 *
 * Uma matéria real do site:
 *
 *     «Diablo IV temporada 15 transforma o jogo em museu dos 30 anos da série»
 *
 * O assistente sugeria **Filmes e Séries**. A regra antiga era uma linha:
 *
 *     if (pista.length > maisLonga) { maisLonga = pista.length; melhor = slug; }
 *
 * `temporada` tem 9 letras e `jogo` tem 4, então `temporada` ganhava. **O
 * tamanho da palavra não tem nada a ver com o quanto ela informa** — foi
 * coincidência que funcionasse, e a coincidência acabou.
 *
 * Medido antes de mexer, nos seis casos que o dono listou: **4 de 6 errados**.
 * E os 2 que acertavam acertavam pelo motivo errado — `Stranger Things ganha
 * nova temporada` dava `filmes-series` por causa de `temporada`, não de
 * `Stranger Things`. `Nova temporada chega em breve`, que não tem assunto
 * nenhum, também devolvia `filmes-series`: palpite com cara de certeza.
 *
 * ============================================================================
 * O MODELO DE DECISÃO — duas camadas, e é só isso
 * ============================================================================
 *
 * Uma pista pode ser de dois tipos, e a diferença é semântica, não de peso:
 *
 *   **DEFINEM**     a palavra pertence a UMA editoria e a nenhuma outra.
 *                   `gpu`, `anime`, `gameplay`, `netflix`.
 *
 *   **ACOMPANHAM**  a palavra aparece em várias editorias. `temporada`,
 *                   `estreia`, `lançamento`, `trailer`, `evento`, `série`.
 *                   Ela diz *o que aconteceu*, nunca *com o quê*.
 *
 * E a regra é uma frase: **palavra que acompanha nunca decide sozinha.** Ela
 * só soma para uma editoria que JÁ tem evidência própria. É isso que torna o
 * resultado contextual sem virar lista de exceções — `temporada` continua
 * valendo em "Netflix anuncia nova temporada", e para de valer em "Diablo IV
 * temporada 15", porque num caso há `netflix` ao lado e no outro há `jogo`.
 *
 * Os pesos são três números, de propósito:
 *
 *   | onde                 | define | acompanha |
 *   | título               |   3    |     1     |
 *   | resumo/corpo         |   1    |     0     |
 *
 * O título pesa mais porque é onde o editor diz do que a matéria trata. O
 * corpo entra porque uma matéria sobre Fortnite dificilmente passa dois
 * parágrafos sem dizer "jogo" — e **palavra que acompanha não conta no corpo**,
 * senão um corpo comprido acumularia ruído até virar sinal.
 *
 * **Empate devolve `null`.** Duas editorias com a mesma evidência não é uma
 * dúvida que eu deva resolver no sorteio: é a resposta "não sei". O princípio
 * é o que o dono escreveu — *melhor não sugerir do que sugerir errado com
 * falsa confiança* —, e ele vale aqui porque a tela mostra a sugestão como um
 * botão que alguém clica, e botão errado ninguém desclica.
 *
 * ============================================================================
 * OS NOMES PRÓPRIOS — a parte que nunca fica completa, dita assim
 * ============================================================================
 *
 * «Fortnite recebe nova temporada» e «Stranger Things ganha nova temporada»
 * têm a MESMA forma. Nenhuma regra lexical distingue as duas sem que alguém
 * diga o que é Fortnite. **Essa parte é vocabulário, e vocabulário acaba.**
 *
 * Então a lista não foi escolhida a dedo: foi **medida em 801 manchetes
 * reais** de `news_items_raw`, pelas que mais aparecem —
 * `xbox` 43 · `ps5` 24 · `steam` 20 · `nintendo` 19 · `playstation` 15 ·
 * `minecraft` 13 · `fortnite` 8 · `netflix` 6 · `intel` 6.
 *
 * O que pode entrar: **nome que só existe num domínio.** `switch` ficou de
 * fora por isso (switch de rede, switch de modo); `marvel` também, porque em
 * `geek` ela é quadrinho e em `filmes-series` é filme — nome ambíguo não é
 * pista que define, por definição.
 *
 * **`diablo` ficou de fora DE PROPÓSITO**, e é o teste mais importante daqui:
 * o caso que originou o conserto tem de passar pela ARQUITETURA (`jogo` define,
 * `temporada` só acompanha) e não pelo nome. Pôr `diablo` na lista resolveria
 * o exemplo e deixaria a classe de erro viva.
 *
 * O que o vocabulário não conhece devolve `null`. É a resposta certa.
 */

/**
 * `definem` → a palavra pertence a esta editoria e a nenhuma outra.
 * `acompanham` → a palavra é desta família, mas sozinha não prova nada.
 *
 * Nenhuma palavra pode estar em dois `definem`, nem em `definem` e
 * `acompanham` ao mesmo tempo: `editoriaProvavelNaoChuta.test.js` reprova.
 */
export const PISTAS = {
  gaming: {
    definem: ['jogo', 'jogos', 'game', 'games', 'gameplay', 'dlc', 'patch', 'jogador', 'jogadores',
      'steam', 'playstation', 'ps5', 'xbox', 'nintendo', 'fortnite', 'minecraft', 'roblox', 'call of duty'],
    acompanham: ['lançamento', 'beta', 'trailer'],
  },
  hardware: {
    definem: ['gpu', 'cpu', 'placa', 'processador', 'ssd', 'monitor', 'console', 'notebook', 'setup',
      'nvidia', 'amd', 'intel'],
    acompanham: [],
  },
  tecnologia: {
    definem: ['app', 'software', 'android', 'windows', 'linux', 'navegador'],
    acompanham: ['atualização', 'sistema'],
  },
  ia: {
    definem: ['ia', 'inteligência artificial', 'chatgpt', 'gemini', 'copilot', 'llm'],
    acompanham: ['modelo'],
  },
  internet: {
    definem: ['rede social', 'streaming', 'youtube', 'twitch', 'discord', 'tiktok', 'creator', 'viral'],
    acompanham: [],
  },
  geek: {
    definem: ['quadrinho', 'quadrinhos', 'hq', 'anime', 'mangá', 'colecionável', 'cosplay'],
    acompanham: [],
  },
  'cultura-pop': {
    definem: ['cultura pop', 'música', 'show', 'celebridade', 'meme'],
    acompanham: [],
  },
  'filmes-series': {
    definem: ['filme', 'filmes', 'séries', 'cinema', 'netflix', 'disney', 'hbo', 'prime video',
      'stranger things'],
    acompanham: ['temporada', 'estreia', 'série', 'evento'],
  },
  industria: {
    definem: ['demissão', 'aquisição', 'receita', 'bilhão', 'milhão', 'ceo', 'estúdio'],
    acompanham: ['processo'],
  },
};

/** Quanto cada tipo de pista vale, e onde. Três números, e nenhum é fração. */
export const PESOS = { defineNoTitulo: 3, defineNoCorpo: 1, acompanhaNoTitulo: 1 };

/** Sem acento e em minúscula, para a pista casar com o que a pessoa digitou. */
const normalizar = (t) => (typeof t === 'string' ? t : '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Palavra INTEIRA: "ia" não pode casar dentro de "familia". */
const contem = (texto, pista) =>
  new RegExp(`(^|[^a-z0-9])${normalizar(pista)}([^a-z0-9]|$)`).test(texto);

/**
 * A evidência de cada editoria, por extenso.
 *
 * Exportada porque é ela que torna a decisão **explicável**: o teste e quem
 * for depurar conseguem ver POR QUE uma editoria ganhou, em vez de olhar um
 * número solto. A tela não usa — e não deve: para o editor, a sugestão é um
 * botão, não um relatório.
 */
export function evidenciasPara(titulo, apoio = '') {
  const noTitulo = ` ${normalizar(titulo)} `;
  const noCorpo = ` ${normalizar(apoio)} `;
  const placar = {};

  for (const [slug, { definem, acompanham }] of Object.entries(PISTAS)) {
    const achadas = definem.filter((p) => contem(noTitulo, p));
    const noCorpoSo = definem.filter((p) => !achadas.includes(p) && contem(noCorpo, p));
    const fracas = acompanham.filter((p) => contem(noTitulo, p));

    // Sem nenhuma pista que DEFINE, a editoria não entra no páreo — por mais
    // palavras de apoio que o texto tenha. É esta linha que conserta o bug.
    if (!achadas.length && !noCorpoSo.length) continue;

    placar[slug] = {
      definem: [...achadas, ...noCorpoSo],
      acompanham: fracas,
      pontos: achadas.length * PESOS.defineNoTitulo
        + noCorpoSo.length * PESOS.defineNoCorpo
        + fracas.length * PESOS.acompanhaNoTitulo,
    };
  }
  return placar;
}

/**
 * A editoria que o texto sugere — ou `null` quando não dá para dizer.
 *
 * @param {string} titulo   o título da matéria
 * @param {string} [apoio]  resumo e/ou corpo, quando existirem. Opcional de
 *                          propósito: a assinatura antiga continua valendo.
 */
export function sugerirEditoria(titulo, apoio = '') {
  const placar = Object.entries(evidenciasPara(titulo, apoio))
    .sort(([, a], [, b]) => b.pontos - a.pontos);

  if (!placar.length) return null;
  // Empate no topo é "não sei", e "não sei" se diz calando.
  if (placar.length > 1 && placar[0][1].pontos === placar[1][1].pontos) return null;

  const [slug] = placar[0];
  return editoriaValida(slug) ? slug : null;
}
