import { useEffect, useRef } from 'react';

/**
 * A abertura do Hero: um raio verde cai do topo, estoura num clarão e some,
 * liberando o conteúdo.
 *
 * ── `[02/09]` Por que ela deixou de usar Framer Motion ──────────────────────
 *
 * Relato do dono: *"o raio da intro às vezes corta, falha ou simplesmente não
 * aparece"*. Medido, e o resultado é pior do que "às vezes":
 *
 *   CPU 1x .... o traço surge no DOM às 496 ms já com `stroke-dashoffset: 0`
 *   CPU 4x .... surge às 894 ms, também já pronto
 *   CPU 6x .... não aparece dentro de 1,5 s
 *
 * **Em nenhuma medição o traço chegou a ser desenhado.** Ele pulava direto
 * para o estado final — o desenho, que é a graça da animação, nunca acontecia.
 *
 * **O mecanismo.** O Framer calcula cada quadro dentro de
 * `requestAnimationFrame`. Durante o boot da landing a thread principal fica
 * ocupada — 602 ms de tarefas longas medidos a 4× —, o rAF não roda, e quando
 * volta a rodar a animação já passou do fim: ela salta em vez de correr.
 *
 * Em CSS o relógio da animação é do **navegador** e corre independente do
 * JavaScript. Com a thread travada ela perde quadros, mas continua na posição
 * certa quando volta, em vez de congelar e pular. `opacity` e `transform`
 * ainda rodam no compositor, fora da thread principal.
 *
 * ── O palpite que a medição derrubou ────────────────────────────────────────
 *
 * A suspeita óbvia era a cena 3D disputando a thread. O A/B disse não: 602 ms
 * de bloqueio com ela ligada, **594 ms com ela desligada**. A causa é o boot
 * da própria landing, e mexer na cena 3D não teria adiantado nada.
 *
 * ── Por que o `onComplete` virou temporizador ───────────────────────────────
 *
 * Era `onAnimationComplete` do Framer. Sem Framer não existe esse evento, e
 * `animationend` do CSS traria de volta o mesmo problema por outro caminho:
 * se a animação for cortada — aba em segundo plano, `animation-play-state`,
 * ou o próprio elemento removido — o evento não dispara e a intro **nunca
 * sai**, prendendo a página para sempre.
 *
 * O temporizador é o teto absoluto que o §0.3 regra 3 exige: toda espera
 * precisa de um limite que não dependa de o evento chegar.
 */

// Raio principal + uma bifurcação, em viewBox 0..100 (slice cobre a tela).
const BOLT = 'M 55 -6 L 46 18 L 54 21 L 44 40 L 52 43 L 47 56';
const FORK = 'M 54 21 L 61 33 L 56 36';

/** 0,82 s de espera + 0,45 s de fade — o mesmo tempo da versão anterior. */
const DURACAO_MS = 1270;

export default function IntroLightning({ onComplete }) {
  const jaChamou = useRef(false);

  useEffect(() => {
    const id = setTimeout(() => {
      if (jaChamou.current) return;
      jaChamou.current = true;
      onComplete?.();
    }, DURACAO_MS);
    return () => clearTimeout(id);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-dark-900 overflow-hidden raio-intro-fundo">
      {/* Flash verde rápido na tela inteira — o "estouro" do impacto. */}
      <div
        aria-hidden
        className="absolute inset-0 raio-intro-flash"
        style={{ background: 'radial-gradient(circle at center, rgba(57,255,20,0.9) 0%, rgba(57,255,20,0.45) 40%, rgba(57,255,20,0.15) 100%)' }}
      />

      {/* Clarão verde — estoura no impacto e se expande sumindo.

          `[29/08]` Ele cresceu, e o motivo é geométrico. `vmax` é a MAIOR
          dimensão da tela: num celular em pé isso é a altura, e o clarão saía
          enorme; num monitor deitado é a largura, e a mesma conta produzia um
          círculo que ocupava pouco da tela. O dono viu no PC da loja — *"a
          explosão está pequena"* — e no celular nunca tinha reclamado disso.

          Além do tamanho, o miolo brilhante foi empurrado para fora (14% → 22%)
          e a queda ficou mais lenta: o que ele chama de "explosão" é o núcleo
          claro, não o halo, e era o núcleo que estava pequeno. */}
      <div
        aria-hidden
        className="absolute rounded-full raio-intro-clarao"
        style={{
          width: '95vmax',
          height: '95vmax',
          background:
            'radial-gradient(circle, rgba(240,255,235,1) 0%, rgba(180,255,140,0.98) 22%, rgba(57,255,20,0.6) 45%, rgba(57,255,20,0.18) 66%, transparent 80%)',
        }}
      />

      {/* Raio descendo do topo até o centro.

          `pathLength="1"` normaliza o comprimento do caminho: o
          `stroke-dasharray` do CSS passa a trabalhar em unidades de 1, sem
          ninguém precisar medir o caminho em JavaScript. É o que torna o
          desenho possível sem uma única linha de script. */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        style={{ filter: 'drop-shadow(0 0 2px #39ff14) drop-shadow(0 0 7px #39ff14)' }}
      >
        <path
          className="raio-intro-traco"
          pathLength="1"
          d={BOLT} fill="none" stroke="#39ff14" strokeWidth="1.4"
          strokeLinecap="round" strokeLinejoin="round"
        />
        <path
          className="raio-intro-traco"
          pathLength="1"
          d={FORK} fill="none" stroke="#7dff5e" strokeWidth="0.9"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
