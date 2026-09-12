import ArteDaCena from './ArteDaCena';
import Hero from './Hero';
import { CENAS } from '../../lib/cenasDaLanding';
import { FRASE_DO_ATO_ZERO } from '../../lib/atosDaLanding';

/**
 * O prólogo para quem pediu MENOS MOVIMENTO no sistema.
 *
 * ── Por que existe um caminho separado ──────────────────────────────────────
 *
 * `prefers-reduced-motion` não é preferência estética: quem liga essa opção
 * costuma ter motivo — enjoo de movimento, vertigem, sensibilidade vestibular.
 * Narrativa conduzida por rolagem é justamente o formato que mais incomoda
 * nesse caso, porque o conteúdo se transforma enquanto a pessoa se move.
 *
 * ── E por que NÃO é "a versão sem nada" ─────────────────────────────────────
 *
 * O caminho fácil seria pular o prólogo e cair direto no hero. Isso apagaria a
 * arte de abertura e a frase — conteúdo, não efeito — de quem escolheu ver o
 * site com menos animação. Aqui os dois atos existem, **parados**: a arte
 * ocupa uma tela com a frase composta sobre ela, e o hero completo vem logo
 * abaixo.
 *
 * A mesma frase e a mesma arte dos outros: elas vêm de `atosDaLanding.js` e de
 * `cenasDaLanding.js`, então não há como uma versão dizer uma coisa e a outra
 * dizer outra (§4).
 */
export default function PrologoParado({ introDone = true }) {
  return (
    <>
      <section className="relative h-[100svh] w-full overflow-hidden">
        <ArteDaCena arte={CENAS.hero} prioridade />

        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(0deg, rgba(6,6,8,0.94) 0%, rgba(6,6,8,0.70) 22%, rgba(6,6,8,0.12) 52%, rgba(6,6,8,0.55) 100%)',
          }}
        />

        <div className="absolute inset-0 flex items-end justify-center px-6 pb-24 md:pb-28">
          <h1
            className="font-display font-bold text-white text-center leading-[1.1]
                       text-[1.75rem] sm:text-4xl md:text-5xl lg:text-6xl max-w-4xl
                       [text-shadow:0_2px_24px_rgba(6,6,8,0.85)]"
          >
            {FRASE_DO_ATO_ZERO}
          </h1>
        </div>
      </section>

      <Hero introDone={introDone} />
    </>
  );
}
