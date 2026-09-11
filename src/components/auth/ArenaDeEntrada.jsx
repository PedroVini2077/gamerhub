import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { ARTES_POR_MODO, TAMANHOS } from '../../lib/artesDaArena';

/**
 * O fundo do login e do cadastro — dois lutadores na paleta do site, verde de
 * um lado, roxo do outro, e a fenda entre eles.
 *
 * ── `[04/09]` A cena era FOGO x GELO, e virou VERDE x ROXO ──────────────────
 *
 * O dono parou a rodada anterior com a frase certa: *"eu não sei o que tava
 * passando na minha cabeça de fazer personagem de gelo e fogo, não tem nada a
 * ver com o site"*. Ele estava certo, e a cobrança que veio junto também:
 * *"você tinha que ter me avisado isso, né?"*.
 *
 * **Tinha.** A paleta do site é verde neon, roxo e ciano — está em
 * `estilos/base.css` desde o começo. Laranja de lava e azul de gelo são outra
 * linguagem visual, e eu executei três rodadas sem levantar isso. É o §7 na
 * letra: discordar ANTES de executar, não depois de entregar.
 *
 * Fica registrado aqui, e não só no `DECISOES.md`, porque quem abrir este
 * arquivo para trocar a arte de novo precisa saber que a cor **não é escolha
 * livre**: ela é a identidade do site.
 *
 * ── Os personagens são ARTE, e não desenho meu ──────────────────────────────
 *
 * Eu tentei três vezes desenhar silhuetas em SVG e o dono me parou: *"tava ruim
 * demais, os personagens estavam parecendo mais formas geométricas do que
 * personagem mesmo"*. O §1.2 já mandava parar depois de duas tentativas sem
 * convergir. As artes são dele; o recorte, a otimização e a montagem são meus.
 *
 * ── Cada arte vem com os DOIS lutadores, e separá-los é por COR ─────────────
 *
 * A fronteira entre eles não é uma reta escolhida a olho: é a cor do pixel. No
 * lado verde descarta-se o que é nitidamente roxo, no roxo o que é nitidamente
 * verde, e o alfa cai por rampa nas últimas colunas para o halo não terminar
 * num corte.
 *
 * Nas artes desta rodada existe folga de verdade — **6 colunas** no login,
 * **120** no cadastro —, então a regra de cor quase não precisa opinar. Ela
 * fica porque na rodada anterior não havia folga nenhuma (os dois se sobrepunham
 * por 75 colunas) e o corte em reta levou pedaço do adversário duas vezes. A
 * trava é `e2e/artes-da-arena.mjs`.
 *
 * ── O custo, medido antes de entrar ─────────────────────────────────────────
 *
 * A escolha do arquivo é por **densidade de tela**, não por aparelho:
 *
 *     par de 340 px ....  84 KB (login) ·  64 KB (cadastro)  — telas 1x
 *     par de 720 px ... 282 KB (login) · 218 KB (cadastro)  — telas 2x e 3x
 *
 * **Celular comum cai no de 720**, e isso foi medido, não suposto: em 390×844
 * com DPR 3 o navegador tem 3 pixels físicos para cada CSS. Dizer "no celular
 * são 84 KB" seria confortável e falso.
 *
 * ── Celular e PC são composições DIFERENTES ─────────────────────────────────
 *
 *     PC ......... os dois de pé nas laterais, altos, se olhando
 *     celular .... os dois GRANDES no alto, se encontrando no meio, saindo
 *                  pelas laterais e dissolvendo antes do formulário
 *
 * Mesmo DOM nos dois; quem decide é `@media` no CSS. Sem ramo em JavaScript:
 * `window.innerWidth` lido no render erra na primeira pintura e não acompanha o
 * giro do aparelho.
 */
/** O cruzamento das artes. Mais lento que a troca do formulário de propósito:
 *  o fundo é o que dá a sensação de cena mudando, e cena não corta. */
const CRUZAMENTO = { duration: 0.55, ease: [0.4, 0, 0.2, 1] };

export default function ArenaDeEntrada({ modo = 'login' }) {
  // Posições fixas, calculadas uma vez. `Math.random()` a cada render faria as
  // partículas saltarem de lugar a cada tecla digitada no formulário.
  const faiscas = useMemo(() => semente(12, 7), []);
  const estilhacos = useMemo(() => semente(12, 23), []);

  // No cadastro o verde domina: a fenda sai do eixo, o roxo vira de costas e
  // recua. É o "character selected" que o dono descreveu.
  const cadastro = modo === 'register';
  const eixo = cadastro ? '68%' : '50%';

  // As artes vêm de `lib/artesDaArena.js`, que é a mesma lista que o preparo por
  // intenção usa. Duas listas divergiriam em silêncio — ver o módulo.
  const { verde, roxo } = ARTES_POR_MODO[modo] ?? ARTES_POR_MODO.login;


  return (
    <div
      className={`arena ${cadastro ? 'arena-selecionado' : ''}`}
      style={{ '--eixo': eixo }}
      aria-hidden="true"
    >
      <div className="arena-lado arena-verde" />
      <div className="arena-lado arena-roxo" />

      {/* ── A moldura: circuito verde numa borda, roxo na outra ───────────────

          Ela substituiu efeitos que eu desenhava em CSS, a pedido do dono. No
          CADASTRO fica **só a do verde, com a borda direita vazia** — o roxo
          está de costas e recuado ali, e moldura acesa do lado dele contaria que
          ele ainda está em cena. Ver `.arena-selecionado .arena-moldura-roxo`. */}
      <div className="arena-moldura">
        <span className="arena-moldura-lado arena-moldura-verde" />
        <span className="arena-moldura-lado arena-moldura-roxo" />
      </div>

      {/* Cada lado tem o SEU contêiner de partículas, e ele anda junto com a
          fenda. Antes as partículas liam o `--eixo` direto e pulavam para a
          posição nova enquanto a fenda ainda estava viajando — na volta do
          cadastro, isso punha estilhaço roxo em cima do lado verde por 900 ms.
          O porquê inteiro está em `estilos/arena/efeitos.css`. */}
      <div className="arena-particulas arena-particulas-verde">
        {faiscas.map((p, i) => (
          <span key={`b${i}`} className="arena-particula arena-faisca" style={p} />
        ))}
      </div>
      <div className="arena-particulas arena-particulas-roxo">
        {estilhacos.map((p, i) => (
          <span key={`c${i}`} className="arena-particula arena-estilhaco" style={p} />
        ))}
      </div>

      {/* ── Os lutadores ─────────────────────────────────────────────────────
          `fetchPriority="low"`: é enfeite. O que precisa chegar primeiro é o
          formulário, e o navegador só sabe disso se alguém disser.

          A troca de arte é um FADE CRUZADO, não uma troca de `src`. Achado do
          dono: *"os personagens simplesmente aparecem, sem nenhum fade in ou
          fade out, tanto na ida e volta, eles simplesmente brotam"*. Trocar o
          `src` do mesmo `<img>` não tem transição nenhuma — o navegador pinta
          a imagem nova no quadro em que ela chega.

          A opacidade do cruzamento fica no ENVOLTÓRIO, não na imagem: a imagem
          já carrega a opacidade de desenho (0,6 no celular; 0,46 no roxo do
          cadastro), e as duas precisam se multiplicar. Se o Framer escrevesse
          `opacity` na própria imagem, ele apagaria a de desenho. */}
      <Lutador lado="verde" arte={verde} />
      <Lutador lado="roxo" arte={roxo} />

      {/* A fenda vem depois das partículas para ficar por cima delas. */}
      <div className="arena-fenda" />

      {/* O VS. É o elemento que responde "o que raios é isso?" sem uma palavra
          de explicação — cada metade na cor do seu lado. */}
      <div className="arena-vs">
        <span className="arena-vs-verde">V</span>
        <span className="arena-vs-roxo">S</span>
      </div>
    </div>
  );
}

/** Teto absoluto da espera pela arte nova. Ver `Lutador`. */
const TETO_DA_ESPERA = 2500;

/**
 * Um lutador, com fade cruzado quando a arte troca.
 *
 * `AnimatePresence` sem `mode="wait"`: as duas artes precisam existir ao mesmo
 * tempo para se cruzarem. Com `wait`, a que sai termina antes de a que entra
 * começar — e aí não é cruzamento, é piscada.
 *
 * ── `[11/09]` O BURACO da primeira troca de aba, e por que ele existia ──────
 *
 * Relato do dono: *"ao entrar no login e clicar na aba cadastro, aquele problema
 * da transição aparece, mas quando volto pra aba do login funciona... é apenas
 * quando o usuário entra pela primeira vez"*.
 *
 * **O sintoma era dele, a causa não.** Ele atribuiu à moldura roxa, que foi o
 * que consertamos por último. Medi a `opacity` computada dela quadro a quadro:
 * ela rampa liso em 17 quadros, dentro e fora da janela da animação de entrada.
 * A moldura estava certa.
 *
 * O que estava errado é que `roxo-costas` e `verde-frente` **só começam a ser
 * baixados no clique** — medido: numa visita ao login eles nunca aparecem na
 * lista de recursos. Filmado a 1,5 Mbps, o lado roxo ficava **vazio** 300 ms
 * depois do clique e só voltava a ter figura perto de 1,4 s. Na segunda troca
 * as artes já estão no cache e a figura nova está lá em 300 ms — que é
 * exatamente o "na volta funciona" que ele descreveu.
 *
 * A causa raiz é uma assimetria que eu mesmo escrevi: o `ArteCruzada` faz a
 * arte NOVA esperar o `load` (certo), mas a VELHA saía na hora. Segurar uma
 * ponta e soltar a outra não é cruzamento — é apagar e depois acender.
 *
 * ── A correção ─────────────────────────────────────────────────────────────
 *
 * A arte velha fica na tela até a nova estar **decodificada**. Só então as duas
 * trocam, e aí o cruzamento é de verdade: nunca existe um quadro sem figura.
 * Custo: **zero byte** — é a mesma imagem, só que esperada antes de trocar.
 *
 * **O teto de 2,5 s é obrigatório** (§0.3, regra 3): se a arte nunca chegar —
 * rede caiu, arquivo sumiu —, sem teto o fundo ficaria preso na pose do login
 * para sempre, com o formulário de cadastro na frente. Enfeite que trava calado
 * é §1.5. Estourado o teto, a troca acontece assim mesmo: volta a ser o defeito
 * antigo, que é ruim, mas é melhor do que uma cena mentindo sobre o modo.
 */
function Lutador({ lado, arte }) {
  // A arte que está NA TELA — não necessariamente a que o modo pede.
  const [exibida, setExibida] = useState(arte);

  useEffect(() => {
    if (arte.g === exibida.g) return undefined;

    let vivo = true;
    const trocar = () => { if (vivo) setExibida(arte); };

    const img = new Image();
    img.sizes = TAMANHOS;
    img.srcset = `${arte.p} 340w, ${arte.g} 720w`;
    img.src = arte.g;

    // `decode()` e não só `onload`: `load` diz que os bytes chegaram, não que a
    // imagem está pronta para pintar. Trocar entre os dois põe a decodificação
    // no primeiro quadro do fade, que é onde ela aparece como engasgo.
    if (img.decode) img.decode().then(trocar, trocar);
    else { img.onload = trocar; img.onerror = trocar; }

    const teto = setTimeout(trocar, TETO_DA_ESPERA);
    return () => { vivo = false; clearTimeout(teto); };
  }, [arte, exibida.g]);

  return (
    <div className={`arena-lutador arena-lutador-${lado}`}>
      <AnimatePresence initial={false}>
        <ArteCruzada key={exibida.g} arte={exibida} />
      </AnimatePresence>
    </div>
  );
}

/**
 * Uma arte, que só COMEÇA a aparecer quando terminou de carregar.
 *
 * ── Por que não basta o fade ────────────────────────────────────────────────
 *
 * Na primeira troca de aba a arte nova ainda está vindo pela rede. Um fade que
 * começa na hora do clique desvaneceria para uma caixa vazia e a figura
 * apareceria de estalo quando chegasse — que é exatamente o defeito relatado,
 * só que mais tarde.
 *
 * ── E por que NÃO pré-carregar o outro par ──────────────────────────────────
 *
 * Foi a primeira solução que eu escrevi, e a medição a derrubou: buscar o par
 * que não está na tela custa **215 KB** e, medido em 390×844, ele chegou junto
 * com a tela em vez de depois — a tela de entrada passaria de 423 para 638 KB
 * de imagem. Camada 2 (§0.4) é por onde todo mundo passa, e metade dessa gente
 * nunca abre a outra aba.
 *
 * Esperar o `load` custa **zero byte** e resolve o mesmo caso: em rede boa a
 * arte chega dentro da janela do fade e ninguém percebe diferença; em rede
 * ruim, a entrada só começa mais tarde — nunca é um estalo.
 */
function ArteCruzada({ arte }) {
  const [carregada, setCarregada] = useState(false);
  const img = useRef(null);

  // Imagem que já está no cache do navegador pode terminar ANTES de o ouvinte
  // existir, e aí o `onLoad` não vem nunca. `complete` é a pergunta direta.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth > 0) setCarregada(true);
  }, []);

  return (
    <motion.span
      className="arena-troca"
      initial={{ opacity: 0 }}
      animate={{ opacity: carregada ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={CRUZAMENTO}
    >
      <img
        ref={img}
        className="arena-figura"
        src={arte.g}
        srcSet={`${arte.p} 340w, ${arte.g} 720w`}
        sizes={TAMANHOS}
        onLoad={() => setCarregada(true)}
        alt="" aria-hidden="true" decoding="async" fetchPriority="low"
      />
    </motion.span>
  );
}

/**
 * Gera posições espalhadas de forma determinística.
 *
 * Não usa `Math.random()`: o mesmo fundo em duas abas ficaria diferente sem
 * motivo, e um `useMemo` com random ainda mudaria a cada montagem. O passo é
 * um número primo para os pontos não caírem em coluna.
 *
 * ── `--x` é FRAÇÃO DO LADO, não posição na tela ─────────────────────────────
 *
 * Achado do dono em 04/09: *"quando a parte de um lado pega o lado do outro,
 * as partículas ficam caindo no lado errado"*. A causa não era a posição de
 * nenhuma partícula: era `--x` ser uma porcentagem **da tela**, enquanto a
 * fronteira entre os dois lados é o `--eixo`, que no cadastro vai para 68%.
 *
 * Corrigido pela CLASSE: `--x` saiu de "3%..42% da tela" para "0,06..0,84 do
 * meu lado", e o CSS multiplica pela largura do lado. Assim funciona em
 * QUALQUER eixo — inclusive num terceiro modo que ainda não existe.
 */
function semente(quantos, passo) {
  return Array.from({ length: quantos }, (_, i) => ({
    // 50 é a largura do lado quando o eixo está no meio: mantém exatamente as
    // posições de antes no login, e passa a acompanhar o eixo no cadastro.
    '--x': (((i * passo) % 40) + 3) / 50,
    '--atraso': `${(i * 1.7) % 9}s`,
    '--duracao': `${11 + ((i * 3) % 7)}s`,
    '--deriva': `${((i % 3) - 1) * 2.5}vw`,
  }));
}
