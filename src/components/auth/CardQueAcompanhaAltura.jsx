import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Um card cuja ALTURA acompanha a troca de conteúdo em vez de saltar.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 *
 * Pedido do dono em 04/09: *"podia fazer uma transição melhor da aba de login e
 * cadastro, pq quando fazemos essa troca, simplesmente corta de um pro outro"*.
 *
 * Fazer o conteúdo aparecer em fade resolve metade. A outra metade é o card: o
 * formulário de cadastro é **~2,5× mais alto** que o de login (medido: 354 px
 * contra 877 px em 1280 px de largura), e sem isto ele salta de tamanho de
 * estalo enquanto o conteúdo ainda está transparente. Meio conserto aparece
 * mais do que conserto nenhum.
 *
 * ── Por que NÃO é o `layout` do Framer ──────────────────────────────────────
 *
 * Essa era a saída de uma linha, e eu tentei primeiro. **Ela não funcionou**, e
 * isso é medição e não impressão: com `<motion.div layout>` no card, a altura
 * pulava de 354 para 877 px entre dois quadros e o `transform` computado ficava
 * em `none` o tempo todo — ou seja, nenhuma animação de projeção chegou a rodar.
 * Em vez de insistir numa API que não estava respondendo (§1.2: duas tentativas
 * e muda-se a abordagem), a altura passou a ser medida e animada aqui.
 *
 * ── Por que a animação é CONDICIONAL à `chave` ──────────────────────────────
 *
 * O `ResizeObserver` dispara a **cada** mudança de altura — inclusive as que
 * acontecem enquanto a pessoa digita (o medidor de força da senha aparecendo, a
 * mensagem de erro de um campo). Animar 280 ms a cada tecla deixaria o
 * formulário com aparência de travado.
 *
 * Então a animação só liga na janela em que a `chave` muda, que é o que
 * caracteriza troca de conteúdo. Fora dela, a altura acompanha na hora.
 *
 * ── Se o `ResizeObserver` não existir ───────────────────────────────────────
 *
 * A altura fica em `auto` e o card funciona sem animação nenhuma. É degradação
 * honesta: perde-se o enfeite, não o formulário.
 */

/** A mesma curva do resto do site para troca de painel. */
const ANIMADA = { duration: 0.28, ease: [0.4, 0, 0.2, 1] };
/** Sem animação: usada quando a altura muda por digitação, não por troca. */
const IMEDIATA = { duration: 0 };

/** Folga sobre os 280 ms da transição, para o desligamento não cortá-la. */
const JANELA_DA_TROCA = 400;

export default function CardQueAcompanhaAltura({ chave, className = '', children }) {
  const conteudo = useRef(null);
  const [altura, setAltura] = useState(null);
  const [trocando, setTrocando] = useState(false);

  useEffect(() => {
    const el = conteudo.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observador = new ResizeObserver(([entrada]) => {
      setAltura(entrada.contentRect.height);
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  // A troca é detectada NO RENDER, comparando a chave com a anterior, e não num
  // efeito. Duas razões, e a segunda é a que decidiu:
  //
  // 1. `setState` síncrono dentro de efeito dispara render em cascata — é o que
  //    o lint acusa, e ele está certo.
  // 2. O efeito rodaria DEPOIS da pintura: por um quadro a altura nova já valeria
  //    com a transição ainda desligada, e a animação começaria do lugar errado.
  //
  // Ajustar estado durante o render é o padrão da própria documentação do React
  // para "estado derivado de prop que mudou": ele re-renderiza na hora, sem
  // pintar o intermediário.
  const [chaveAnterior, setChaveAnterior] = useState(chave);
  if (chave !== chaveAnterior) {
    setChaveAnterior(chave);
    setTrocando(true);
  }

  // Desligar, sim, é efeito — e o `setState` acontece dentro do temporizador,
  // não no corpo do efeito.
  useEffect(() => {
    if (!trocando) return undefined;
    const t = setTimeout(() => setTrocando(false), JANELA_DA_TROCA);
    return () => clearTimeout(t);
  }, [trocando]);

  return (
    <div className={className}>
      {/* `initial={false}`: a primeira pintura não anima. O formulário é o que a
          pessoa veio fazer — ele aparece pronto. */}
      <motion.div
        initial={false}
        animate={{ height: altura ?? 'auto' }}
        transition={trocando ? ANIMADA : IMEDIATA}
        style={{ overflow: 'hidden' }}
      >
        <div ref={conteudo}>{children}</div>
      </motion.div>
    </div>
  );
}
