/**
 * As MEDIDAS da arena — os ajudantes que leem a cena dentro do navegador.
 *
 * ── Por que em arquivo próprio ──────────────────────────────────────────────
 *
 * `[11/09]` `e2e/artes-da-arena.mjs` chegou a 369 linhas e o §4 manda dividir
 * o que eu toquei. A separação não é por tamanho, é por responsabilidade: aqui
 * mora **como se mede** (canvas, estilo computado, esperas), e no roteiro fica
 * **o que se exige** (os limites e as mensagens de falha).
 *
 * O corte foi mecânico — nenhum comportamento mudou, só o endereço do código.
 *
 * Tudo recebe a `page` por parâmetro em vez de fechar sobre uma global: é o que
 * permite que estes medidores sejam reaproveitados por outro roteiro sem
 * arrastar junto o ciclo de vida do navegador.
 */

/** Ruído de croma do WebP com perdas. Os valores reais são 0; o bug real, 220+. */
const TOLERANCIA = 30;
/** A borda que encosta na fenda, em fração da largura da arte. */
const BORDA = 0.12;
/** Diferença entre os canais para o pixel ser "nitidamente" de um dos dois. */
const DIFERENCA = 40;

/** Os medidores, amarrados a uma `page` do Playwright. */
export function medidasDaArena(page) {
  /**
   * Desenha cada lutador num canvas e conta os pixels da cor do adversário na
   * borda voltada para a fenda. Roda dentro da página: o canvas é da mesma
   * origem, então `getImageData` não é bloqueado.
   */
  const medir = () => page.evaluate(({ BORDA, DIFERENCA }) => {
    const saida = [];
    for (const img of document.querySelectorAll('img.arena-figura')) {
      const lado = img.closest('.arena-lutador-verde') ? 'verde'
        : img.closest('.arena-lutador-roxo') ? 'roxo' : 'desconhecido';
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) { saida.push({ lado, erro: 'imagem não carregou' }); continue; }

      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0);
      const d = c.getContext('2d').getImageData(0, 0, w, h).data;

      const faixa = Math.round(w * BORDA);
      let invasores = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (d[i + 3] < 40) continue;
          const G = d[i + 1], B = d[i + 2];
          // verde: a borda que encosta na fenda é a DIREITA; roxo: a ESQUERDA.
          if (lado === 'verde' && x >= w - faixa && B > G + DIFERENCA) invasores++;
          if (lado === 'roxo' && x < faixa && G > B + DIFERENCA) invasores++;
        }
      }
      saida.push({ lado, arquivo: img.currentSrc.split('/').pop(), w, h, invasores });
    }
    return saida;
  }, { BORDA, DIFERENCA });

  /**
   * Tira uma foto do MEIO da troca de aba: quantas artes existem de cada lado, e
   * se a faixa das partículas está no mesmo lugar que a fenda.
   *
   * As duas coisas são o mesmo defeito visto de dois ângulos — metade da cena
   * mudando de estalo enquanto a outra metade leva 900 ms.
   */
  const noMeioDaTroca = () => page.evaluate(() => {
    const artes = (lado) =>
      document.querySelectorAll(`.arena-lutador-${lado} .arena-troca`).length;
    const borda = (sel) => getComputedStyle(document.querySelector(sel)).left;
    return {
      artesVerde: artes('verde'),
      artesRoxo: artes('roxo'),
      fenda: borda('.arena-fenda'),
      particulas: borda('.arena-particulas-roxo'),
    };
  });

  /**
   * Espera a moldura ASSENTAR antes de medi-la.
   *
   * `[11/09]` Sem isto, o passo media um quadro da animação de entrada em vez do
   * estado final. Medido: `.arena-moldura-lado` entra com
   * `arenaMolduraAcende 900ms ease-out 420ms backwards`, e `esperarArtes()` já
   * está satisfeita aos **280 ms** — dentro dos 420 ms de espera, onde
   * `backwards` prende a `opacity` em **0**. A moldura só chega em 0,55 aos
   * ~1.665 ms:
   *
   *     t= 280 ms  opacity 0          <- era aqui que o teste media
   *     t= 741 ms  opacity 0.125
   *     t=1665 ms  opacity 0.55
   *
   * **Perguntar ao navegador, e não esperar um tempo fixo.** `getAnimations()`
   * devolve as animações vivas do elemento — a de entrada no login, a transição
   * de `opacity` na troca de aba —, então a condição é o fato, não um palpite que
   * envelhece junto com a duração escrita no CSS.
   *
   * Isso NÃO afrouxa a trava: quem quebrar a moldura de vez continua chegando
   * aqui com a animação terminada e opacidade 0, e o passo reprova igual. A
   * espera separa "ainda está entrando" de "não vai aparecer".
   */
  const esperarMolduraAssentar = () => page.waitForFunction(() => {
    const el = document.querySelector('.arena-moldura-roxo');
    if (!el) return true; // o passo seguinte é quem reclama da ausência
    return el.getAnimations().every((a) => a.playState === 'finished');
  }, null, { timeout: 10000 });

  /** O que a moldura da borda DIREITA está mostrando, pelo estilo computado. */
  const molduraDaDireita = async () => {
    await esperarMolduraAssentar();
    return page.evaluate(() => {
      const el = document.querySelector('.arena-moldura-roxo');
      if (!el) return 'elemento .arena-moldura-roxo nao existe';
      const e = getComputedStyle(el);
      // `[11/09]` Mede VISIBILIDADE EFETIVA, e nao so `display`.
      //
      // A versao anterior so conhecia `display: none`. Quando a moldura passou a
      // sair por `opacity` — porque `display` nao transiciona, e ela sumia de
      // estalo na troca de aba —, o elemento continuou existindo e este passo
      // reprovou uma mudanca correta.
      //
      // Medir opacidade e MAIS forte, nao menos: a versao antiga aprovaria alguem
      // que trocasse a regra por `display: block` com a opacidade de volta em
      // 0,55, porque ela so olhava uma das duas maneiras de aparecer.
      const invisivel = e.display === 'none'
        || Number(e.opacity) < 0.02
        || e.visibility === 'hidden';
      return invisivel ? 'oculta' : e.backgroundImage;
    });
  };

  /**
   * Espera a cena ASSENTAR: o fade cruzado terminou e as duas artes que ficaram
   * estão carregadas.
   *
   * A condição de "terminou" é haver **uma** `.arena-troca` por lado. Durante o
   * cruzamento existem duas de cada — e foi isso que reprovou a contagem quando o
   * cruzamento entrou: o teste media no meio da troca sem querer. Esperar um
   * tempo fixo seria adivinhação; esperar o número certo de artes é o fato.
   */
  /**
   * `[10/09]` A espera era satisfeita por DOIS estados diferentes, e por isso
   * falhava sozinha no CI.
   *
   * A condição era só "existem 2 `.arena-troca`". Logo depois do clique em
   * "Registrar" isso já é verdade — mas com as artes do LOGIN, porque o React
   * ainda não reagiu. A espera passava na hora, o `medir()` rodava, e pegava o
   * cruzamento em curso: **4 artes, esperava 2**.
   *
   * É a família do fallback silencioso (§4), na versão temporal: uma condição
   * que responde "pronto" para "ainda não começou" e para "já terminou".
   *
   * ── O que foi MEDIDO, e o que a medição desmentiu ───────────────────────────
   *
   * A janela vulnerável **existe**: clicando em "Registrar" de dentro da página e
   * lendo a condição na mesma tarefa de JS, ela responde `true` com as artes do
   * LOGIN ainda na tela (`verde-guarda` e `roxo-guarda`). Esse é o estado que
   * produz "4 artes, esperava 2" — o `medir()` roda e pega o cruzamento em curso.
   *
   * **Mas eu não reproduzi a falha aqui, e isso precisa estar escrito.** Medindo
   * pelo caminho real do teste, a condição antiga levou **728 ms** para passar,
   * já com as artes novas: a ida e volta do clique do Playwright é mais lenta do
   * que o primeiro render do React nesta máquina, então o poll cai *depois* da
   * janela. No CI a corrida deu para o outro lado. Rodei 5× aqui depois do
   * conserto e deu 5/5 — o que não prova nada, porque **antes** do conserto também
   * dava 5/5.
   *
   * A prova, então, é estrutural e não estatística: a condição nova **não pode**
   * ser satisfeita pelo estado acima, porque ele tem as artes de antes. Portão que
   * falha sozinho ensina a ignorar o canal (§0.2, 4ª regra), e este me custou uma
   * caçada a uma regressão que não existia.
   *
   * O conserto é dizer O QUE SE ESPERA VER, não quantos elementos: quando a troca
   * de aba tem artes novas, esperar que os `src` sejam **diferentes** dos de
   * antes. Sem isso não há como distinguir os dois estados — o número é o mesmo.
   *
   * @param {string[]} [anteriores] os `src` de antes da troca. Omitido na
   *   primeira carga, quando não existe "antes".
   */
  const esperarArtes = async (anteriores) => {
    await page.waitForSelector('.arena-troca', { timeout: 15000 });
    await page.waitForFunction((antes) => {
      const trocas = document.querySelectorAll('.arena-troca');
      if (trocas.length !== 2) return false;
      const imgs = [...document.querySelectorAll('img.arena-figura')];
      if (imgs.length !== 2) return false;
      if (!imgs.every((i) => i.complete && i.naturalWidth > 0)) return false;
      // A parte que faltava: com `antes` na mão, só está pronto quando NENHUMA
      // das artes na tela é uma das anteriores.
      if (antes?.length) {
        const agora = imgs.map((i) => i.currentSrc || i.src);
        if (agora.some((src) => antes.includes(src))) return false;
      }
      return true;
    }, anteriores ?? null, { timeout: 15000 });
  };

  /** Os `src` que estão na tela agora — a fotografia que a espera compara. */
  const artesNaTela = () => page.evaluate(() =>
    [...document.querySelectorAll('img.arena-figura')].map((i) => i.currentSrc || i.src));

  return {
    TOLERANCIA, BORDA, DIFERENCA,
    medir, noMeioDaTroca, molduraDaDireita, esperarArtes, artesNaTela,
  };
}
