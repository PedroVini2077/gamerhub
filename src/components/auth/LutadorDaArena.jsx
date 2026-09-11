import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { TAMANHOS } from '../../lib/artesDaArena';

/**
 * Os LUTADORES da tela de entrada, e a troca de arte entre login e cadastro.
 *
 * `[11/09]` Saiu de `ArenaDeEntrada.jsx` quando aquele arquivo passou de 300
 * linhas (§4). O corte é por responsabilidade e não por tamanho: a `Arena`
 * compõe a cena — lados, fenda, moldura, partículas, VS —, e este arquivo
 * cuida de UMA coisa difícil, que é trocar uma imagem por outra sem abrir
 * buraco. Foi exatamente aí que morava o defeito relatado pelo dono.
 */

/** O cruzamento das artes. Mais lento que a troca do formulário de propósito:
 *  o fundo é o que dá a sensação de cena mudando, e cena não corta. */
const CRUZAMENTO = { duration: 0.55, ease: [0.4, 0, 0.2, 1] };

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
export default function Lutador({ lado, arte }) {
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
