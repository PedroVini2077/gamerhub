/**
 * O VÉU e o TEXTO de uma cena — a parte que a cena presa e a solta dividem.
 *
 * ── Por que isto saiu do `CenaDaLanding` `[12/09]` ──────────────────────────
 *
 * Porque passaram a existir dois tipos de cena: a que **atravessa** (rola junto
 * com a página) e a que **prende** (fica na tela enquanto a rolagem passa por
 * ela). As duas mostram a mesma coisa — arte, véu, texto — e mudam só em como
 * o tempo passa.
 *
 * Deixar o véu e o texto copiados nos dois seria garantir que um dia o gradiente
 * de um divirja do outro e ninguém perceba: os dois continuam bonitos, só
 * deixam de ser a mesma página (§4).
 *
 * ── O véu muda de EIXO com a orientação da arte, e não é detalhe ────────────
 *
 * No computador a arte é larga e o texto fica de lado, então o escurecimento é
 * lateral. No celular a arte é alta e o texto fica embaixo, então ele sobe do
 * pé. Um véu lateral numa arte em pé apagaria uma coluna inteira da composição.
 *
 * @param {object} props
 * @param {'esquerda'|'direita'} [props.lado] De que lado o texto mora no
 *   computador. No celular ele sempre se apoia no pé, porque a arte é em pé.
 */
export default function TextoDaCena({ eyebrow, titulo, descricao, lado = 'esquerda' }) {
  const textoNaEsquerda = lado === 'esquerda';

  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none md:hidden"
        style={{
          background:
            'linear-gradient(0deg, rgba(6,6,8,0.96) 0%, rgba(6,6,8,0.88) 26%, rgba(6,6,8,0.35) 52%, rgba(6,6,8,0.04) 76%)',
        }}
      />
      <div
        aria-hidden
        className="hidden md:block absolute inset-0 pointer-events-none"
        style={{
          background: textoNaEsquerda
            ? 'linear-gradient(90deg, rgba(6,6,8,0.94) 0%, rgba(6,6,8,0.82) 34%, rgba(6,6,8,0.25) 62%, rgba(6,6,8,0.05) 100%)'
            : 'linear-gradient(270deg, rgba(6,6,8,0.94) 0%, rgba(6,6,8,0.82) 34%, rgba(6,6,8,0.25) 62%, rgba(6,6,8,0.05) 100%)',
        }}
      />

      {/* ── `[12/09]` O texto fica POR CIMA nos dois, e o eixo é que muda ────
          Enquanto a arte de celular era a 16:9 espremida, isto era impossível:
          medido em 400×800, a cena tinha 225 px de altura e a coluna de texto
          sobreposta ficava com **128 px** de largura. Ilegível.

          Com a arte de RETRATO a conta inverte — sobra altura, e o texto se
          apoia no pé da cena, onde o véu vertical o sustenta. */}
      <div
        className={`absolute inset-0 flex items-end md:items-center pointer-events-none
                    ${textoNaEsquerda ? 'md:justify-start' : 'md:justify-end'}`}
      >
        <div className="w-full md:w-auto md:max-w-[46%] px-6 pb-8 md:pb-0
                        md:px-12 lg:px-16 space-y-2 md:space-y-4">
          <span className="font-mono text-[0.62rem] md:text-xs tracking-[0.3em] uppercase text-neon-green">
            {eyebrow}
          </span>
          {/* `[12/09]` `leading-[1.08]` era APERTADO DEMAIS para português: em
              "promoções que valem" a cedilha e o "q" encostavam na linha de
              cima, e em "Está acontecendo" o acento quase tocava. O defeito já
              existia e passou despercebido porque só aparece em título de duas
              linhas COM acento embaixo — 1,18 dá a folga do descendente sem
              afrouxar o título. */}
          <h2 className="font-display font-bold text-white leading-[1.18]
                         text-2xl md:text-3xl lg:text-[2.6rem]">
            {titulo}
          </h2>
          <p className="text-gray-400 md:text-gray-300 font-body
                        text-sm md:text-base lg:text-lg
                        leading-relaxed max-w-lg">
            {descricao}
          </p>
        </div>
      </div>
    </>
  );
}
