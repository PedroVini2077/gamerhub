import { LARGURA, ALTURA, LARGURA_ALTA, ALTURA_ALTA } from '../../lib/cenasDaLanding';

/**
 * A ARTE de uma cena — o `<picture>` numa fonte só.
 *
 * ── Por que ela saiu de dentro das cenas `[12/09]` ──────────────────────────
 *
 * Este mesmo `<picture>` existia copiado em `CenaDaLanding` e em `FinalCTA`, e
 * o prólogo seria a **terceira** cópia. São seis decisões finas juntas —
 * `media`, `srcSet`, `sizes`, `width`/`height`, `loading`, `fetchPriority` — e
 * cópia de seis decisões finas diverge na primeira vez que alguém mexe em uma
 * (§4, fonte única). Já aconteceu neste projeto com ícone de log, rótulo de
 * cargo e cor de cargo.
 *
 * O que se ganha em concreto: mudar a política de carregamento das artes passa
 * a ser mudar **um** arquivo, e a trava de `cenasDaLanding.test.js` passa a ter
 * um lugar só para vigiar em vez de um por chamador.
 *
 * ── As seis decisões, e por que cada uma está aqui ──────────────────────────
 *
 * | | |
 * | --- | --- |
 * | `<picture media>` | troca de **arte**, não de resolução. `srcset` sozinho não sabe trocar composição |
 * | `srcSet` + `sizes` | sem `sizes` o celular baixa o arquivo de 1600 px: funciona, aparece certo, custa 3× |
 * | `width`/`height` | o espaço é reservado antes de a imagem chegar — sem eles a página empurra o texto enquanto a pessoa lê |
 * | `loading` | seis artes baixando juntas são ~800 kB para quem talvez pare na primeira dobra |
 * | `fetchPriority` | a arte da primeira tela disputa banda com a fonte e o JavaScript; as outras não podem disputar nada |
 * | `alt=""` + `aria-hidden` | a arte é ambientação; o assunto está no texto por cima. Leitor de tela que anuncia "imagem" aqui só atrapalha |
 *
 * @param {object} props
 * @param {{src:string, srcSet:string, alta:{src:string, srcSet:string}}} props.arte
 *   Uma entrada de `CENAS` (ver `lib/cenasDaLanding.js`).
 * @param {boolean} [props.prioridade] A arte está na PRIMEIRA tela. Só a
 *   primeira pode ser ansiosa — passar isto em qualquer outra é pagar banda por
 *   quem talvez nunca role até lá.
 */
export default function ArteDaCena({
  arte, prioridade = false, className = 'w-full h-full object-cover',
}) {
  return (
    <picture>
      <source
        media="(max-width: 767px)"
        srcSet={arte.alta.srcSet}
        sizes="100vw"
        width={LARGURA_ALTA} height={ALTURA_ALTA}
      />
      <img
        src={arte.src}
        srcSet={arte.srcSet}
        sizes="min(1600px, 100vw)"
        width={LARGURA} height={ALTURA}
        alt=""
        aria-hidden="true"
        loading={prioridade ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={prioridade ? 'high' : 'low'}
        className={className}
      />
    </picture>
  );
}
