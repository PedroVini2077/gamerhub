import { useMemo } from 'react';

import fogoGuarda340 from '../../assets/auth/fogo-guarda-340.webp';
import fogoGuarda720 from '../../assets/auth/fogo-guarda-720.webp';
import geloGuarda340 from '../../assets/auth/gelo-guarda-340.webp';
import geloGuarda720 from '../../assets/auth/gelo-guarda-720.webp';
import fogoFrente340 from '../../assets/auth/fogo-frente-340.webp';
import fogoFrente720 from '../../assets/auth/fogo-frente-720.webp';
import geloCostas340 from '../../assets/auth/gelo-costas-340.webp';
import geloCostas720 from '../../assets/auth/gelo-costas-720.webp';

/**
 * O fundo do login e do cadastro — dois lutadores, fogo de um lado, gelo do
 * outro, e a fenda entre eles.
 *
 * ── Por que os personagens são IMAGEM, e não desenho meu ────────────────────
 *
 * Eu tentei três vezes desenhar as silhuetas em SVG. O dono me parou no meio:
 * *"tava ruim demais, os personagens estavam parecendo mais formas geométricas
 * do que personagem mesmo"*. Ele estava certo — e a regra do §1.2 já mandava
 * parar: depois de duas tentativas sem convergir, muda-se a abordagem, não se
 * insiste.
 *
 * Ele gerou as artes e mandou. Elas vêm com **fundo transparente de verdade**
 * (conferido no canal alfa, não suposto), então entram como camada por cima da
 * cena que já existia — gradiente, moldura, fenda, faíscas, flocos e VS
 * continuam sendo camada de fundo.
 *
 * ── Cada arte vem com os DOIS lutadores, e separá-los não é cortar ao meio ──
 *
 * Cortei na reta duas vezes e o dono achou o defeito nas duas: *"o fogo tá
 * aparecendo um pouco na parte de gelo, não ficou um corte muito limpo"*. A
 * medição explicou: **os dois se sobrepõem por 75 colunas** — o golpe de fogo
 * vai até a coluna 808 e o de gelo já começa na 734. Não existe reta boa ali.
 *
 * Na faixa disputada quem decide é a **cor** do pixel, e o alfa cai por rampa
 * nos últimos 30 px para o halo não terminar num corte. A receita inteira e os
 * números estão em `docs/DESEMPENHO.md`; a trava é `e2e/artes-da-arena.mjs`.
 *
 * ── O custo, medido antes de entrar ─────────────────────────────────────────
 *
 * Os PNG originais tinham **2,5 MB cada**. Recortados no limite do alfa e
 * convertidos para WebP, em dois tamanhos — e a escolha entre eles é por
 * **densidade de tela**, não por aparelho:
 *
 *     par de 340 px ....  83 KB (login) ·  62 KB (cadastro)  — telas 1x
 *     par de 720 px ... 279 KB (login) · 215 KB (cadastro)  — telas 2x e 3x
 *
 * **Celular comum cai no de 720**, e isso foi medido, não suposto: em 390×844
 * com DPR 3 o navegador escolheu `fogo-guarda-720`. É correto — ele tem 3
 * pixels físicos para cada CSS. Dizer "no celular são 83 KB" seria confortável
 * e falso.
 *
 * Só um par carrega por vez: `sizes` escolhe o tamanho, o modo escolhe a dupla.
 *
 * ── Celular e PC são composições DIFERENTES, e isso é o pedido ──────────────
 *
 * *"eu percebi que no celular fica bem curto o espaço, então tem que funcionar
 * dos dois lados"*. No celular o card ocupa quase toda a largura, então figura
 * na lateral ficaria **atrás** dele — invisível.
 *
 *     PC ......... os dois de pé nas laterais, altos, se olhando
 *     celular .... os dois GRANDES no alto, se encontrando no meio, saindo
 *                  pelas laterais e dissolvendo antes do formulário
 *
 * A versão anterior punha os dois pequenos ladeando o logo, e o dono reprovou:
 * *"tô achando muito pequeno as imagens"*. Ele perguntou se dava para esticar —
 * não dá: proporção errada lê como defeito, não como estilo. Cortar pela borda,
 * sim: é composição normal. Então eles cresceram 2× e sangram para fora.
 *
 * Mesmo DOM nos dois; quem decide é `@media` no CSS. Sem ramo em JavaScript:
 * `window.innerWidth` lido no render erra na primeira pintura e não acompanha o
 * giro do aparelho.
 */
export default function ArenaDeEntrada({ modo = 'login' }) {
  // Posições fixas, calculadas uma vez. `Math.random()` a cada render faria as
  // partículas saltarem de lugar a cada tecla digitada no formulário.
  const brasas = useMemo(() => semente(12, 7), []);
  const cristais = useMemo(() => semente(12, 23), []);

  // No cadastro o fogo domina: a fenda sai do eixo, o gelo vira de costas e
  // recua. É o "character selected" que o dono descreveu.
  const cadastro = modo === 'register';
  const eixo = cadastro ? '68%' : '50%';

  const fogo = cadastro
    ? { p: fogoFrente340, g: fogoFrente720 }
    : { p: fogoGuarda340, g: fogoGuarda720 };
  const gelo = cadastro
    ? { p: geloCostas340, g: geloCostas720 }
    : { p: geloGuarda340, g: geloGuarda720 };

  return (
    <div
      className={`arena ${cadastro ? 'arena-selecionado' : ''}`}
      style={{ '--eixo': eixo }}
      aria-hidden="true"
    >
      <div className="arena-lado arena-fogo" />
      <div className="arena-lado arena-gelo" />

      {/* ── A moldura: lava numa borda, cristal na outra ──────────────────────

          Substituiu as labaredas e os cristais que eu desenhava em CSS. O dono
          mandou a arte e o pedido: *"tira os efeitos de labareda e tbm os
          cristais que vc fez a mão, coloca essa moldura nos cantos"*.

          No CADASTRO ela é **só de fogo, com a borda direita vazia**. Eu tinha
          espelhado a arte de fogo para a direita, para fechar a moldura; ele viu
          e questionou: *"o fogo tá tomando conta do gelo aqui?"*. Estava certo —
          lava por cima do gelo conta que o fogo INVADIU o outro lado, e a cena
          quer dizer que ele venceu. Ver `.arena-selecionado .arena-moldura-gelo`
          no CSS, e o porquê inteiro em docs/DECISOES.md. */}
      <div className="arena-moldura">
        <span className="arena-moldura-lado arena-moldura-fogo" />
        <span className="arena-moldura-lado arena-moldura-gelo" />
      </div>

      {brasas.map((p, i) => (
        <span key={`b${i}`} className="arena-particula arena-brasa" style={p} />
      ))}
      {cristais.map((p, i) => (
        <span key={`c${i}`} className="arena-particula arena-lasca" style={p} />
      ))}

      {/* ── Os lutadores ─────────────────────────────────────────────────────
          `fetchPriority="low"`: é enfeite. O que precisa chegar primeiro é o
          formulário, e o navegador só sabe disso se alguém disser. */}
      <div className="arena-lutador arena-lutador-fogo">
        <img
          className="arena-figura"
          src={fogo.g}
          srcSet={`${fogo.p} 340w, ${fogo.g} 720w`}
          sizes="(max-width: 767px) 68vw, 620px"
          alt="" aria-hidden="true" decoding="async" fetchPriority="low"
        />
      </div>
      <div className="arena-lutador arena-lutador-gelo">
        <img
          className="arena-figura"
          src={gelo.g}
          srcSet={`${gelo.p} 340w, ${gelo.g} 720w`}
          sizes="(max-width: 767px) 68vw, 620px"
          alt="" aria-hidden="true" decoding="async" fetchPriority="low"
        />
      </div>

      {/* A fenda vem depois das partículas para ficar por cima delas. */}
      <div className="arena-fenda" />

      {/* O VS. É o elemento que responde "o que raios é isso?" sem uma palavra
          de explicação — cada metade na temperatura do seu lado. */}
      <div className="arena-vs">
        <span className="arena-vs-fogo">V</span>
        <span className="arena-vs-gelo">S</span>
      </div>
    </div>
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
 * Achado do dono em 04/09: *"quando a parte de fogo pega o lado do gelo, as
 * partículas de gelo ficam caindo no fogo"*. A causa não era a posição de
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
