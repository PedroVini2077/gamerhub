/**
 * O PAINEL onde uma sobreposição de cena mora.
 *
 * ── A regra que ele existe para impor `[12/09]` ─────────────────────────────
 *
 * A sobreposição é uma **camada própria**, nunca um remendo colado em cima de
 * um detalhe desenhado dentro da arte. Alinhar um contador ao contador que já
 * existe no quadro seria frágil por construção: a composição larga e a de
 * retrato têm enquadramentos diferentes, e o dono pode regerar qualquer arte —
 * no dia em que ele regerar, o remendo fica apontando para o vazio, e nada
 * acusa.
 *
 * Então o painel é um objeto do GamerHub **pousado** na cena, e ele se posiciona
 * por uma regra, não por coordenadas medidas na imagem.
 *
 * ── A regra de posição, e por que ela muda de eixo ──────────────────────────
 *
 * | | onde o painel fica | por quê |
 * | --- | --- | --- |
 * | computador | do lado OPOSTO ao texto, centrado na vertical | é a metade da arte que o véu deixou limpa |
 * | celular, cena PRESA | no alto | a cena está grudada no topo da tela, então "alto" é sempre logo abaixo da barra |
 * | celular, cena SOLTA | no meio | a cena ROLA: um recuo fixo a partir do topo dela passa por baixo da barra fixa enquanto sobe |
 *
 * **A distinção acima é conserto, não teoria.** Na primeira versão as cinco
 * usavam o mesmo recuo do topo, e no print de celular o painel do feed aparecia
 * cortado pela barra — a primeira publicação sumia atrás dela. O painel estava
 * onde eu mandei; o que eu não tinha considerado é que a âncora certa depende
 * de a cena prender ou não.
 *
 * Como o `lado` do texto alterna entre as cenas, o painel alterna junto — sem
 * ninguém precisar decidir cena a cena.
 *
 * ── Vidro, e não cartão opaco ───────────────────────────────────────────────
 *
 * `bg-dark-900/80` + `backdrop-blur-sm`: a arte continua aparecendo por baixo,
 * o que é a diferença entre "uma interface acontecendo dentro daquele mundo" e
 * "um cartão colado por cima da foto". O `.card` do site é opaco de propósito —
 * ele vive sobre fundo escuro liso, não sobre arte.
 *
 * `pointer-events-none`: nada aqui é clicável. É cenário, e um cenário que
 * intercepta clique é uma armadilha silenciosa.
 *
 * ── `vidro={false}`, e por que a opção existe ──────────────────────────────
 *
 * Duas das cinco sobreposições **não** são uma interface: a constelação da
 * comunidade e a coleção de cartas das keys são desenho, e desenho dentro de um
 * cartão de vidro vira captura de tela de um app. Elas usam só a REGRA DE
 * POSIÇÃO daqui e dispensam o cartão — o que não pode divergir entre as cinco é
 * onde a camada pousa, não se ela tem borda.
 *
 * ── `[12/09]` O painel CRESCE com a tela, e antes ele não crescia ───────────
 *
 * Ele viu testando no computador: *"ficou pequeno demais os elementos pra uma
 * tela grande"*. Estava certo, e a causa era uma só — `w-[15.5rem]` são **248
 * pixels fixos**, os mesmos num telefone de 390 e num monitor de 1440. O painel
 * não encolheu; a tela cresceu em volta dele. Ele ocupava 63% da largura no
 * celular e **17%** no computador.
 *
 * **A correção é `scale`, e não uma escada de larguras, e isso é deliberado.**
 * Aumentar só a largura esticaria o cartão e deixaria o texto, os avatares e os
 * ícones no mesmo tamanho — o painel ficaria grande e vazio, com um texto
 * miúdo dentro. O que precisa crescer é a **camada inteira**, proporcional.
 *
 * E `scale` mora AQUI, num lugar só. A alternativa era escrever `md:` e `lg:`
 * em cada tamanho de cada uma das cinco sobreposições — algumas dezenas de
 * classes que divergiriam na primeira vez que alguém ajustasse uma delas, e que
 * a sexta sobreposição não herdaria (§4).
 *
 * **A origem da transformação é a borda de que o painel se aproxima**, e essa é
 * a mesma lição dos chips do ATO 0: crescer a partir do centro empurraria
 * metade do painel para fora, porque ele mora a 5% da borda. Crescendo da borda
 * para dentro, ele avança sobre a arte — que é onde há espaço.
 *
 * @param {boolean} [props.vidro] Desenhar o cartão. `false` deixa só o
 *   posicionamento.
 * @param {'topo'|'meio'} [props.ancora] Onde o painel se apoia NO CELULAR.
 *   `topo` para cena presa, `meio` para cena que rola.
 */
export default function PainelDaCena({
  lado = 'esquerda', largura = 'w-[15.5rem]', vidro = true, ancora = 'meio', children,
}) {
  const textoNaEsquerda = lado === 'esquerda';
  const noCelular = ancora === 'topo' ? 'items-start pt-16' : 'items-center pb-32';
  const chrome = vidro
    ? `rounded-xl border border-white/10 bg-dark-900/80 backdrop-blur-sm p-3.5
       shadow-[0_8px_32px_rgba(0,0,0,0.55)]`
    : '';

  // O celular fica em 1: lá o painel já ocupa 63% da largura, e crescer o
  // deixaria maior que a arte que ele deveria pousar em cima.
  const crescimento = 'md:scale-[1.3] lg:scale-[1.55] xl:scale-[1.75]';
  const origem = textoNaEsquerda ? 'md:origin-right' : 'md:origin-left';

  return (
    <div
      aria-hidden
      className={`absolute inset-0 pointer-events-none flex justify-center ${noCelular}
                  md:items-center md:pt-0 md:pb-0
                  ${textoNaEsquerda ? 'md:justify-end md:pr-[5%]' : 'md:justify-start md:pl-[5%]'}`}
    >
      <div className={`${largura} max-w-[86vw] ${chrome} ${crescimento} ${origem}`}>
        {children}
      </div>
    </div>
  );
}
