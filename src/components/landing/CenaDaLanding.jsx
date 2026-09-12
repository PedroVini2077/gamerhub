import { motion } from 'framer-motion';
import { fadeUpReveal, VIEWPORT } from '../../lib/landingMotion';

/**
 * Uma CENA da landing: a arte ocupa a faixa inteira, o texto vive por cima.
 *
 * ── O que ela substitui, e por quê ──────────────────────────────────────────
 *
 * `[12/09]` O `FeatureSection` era usado **cinco vezes** com o mesmo molde —
 * sobrancelha, título, descrição, botão, print — e era essa repetição que o
 * dono diagnosticou: a landing ficava *"organizada, e por isso mesmo previsível
 * e institucional"*.
 *
 * A hierarquia que ele pediu no lugar é **ARTE → PRODUTO → INFORMAÇÃO**: a arte
 * cria o impacto, a interface real demonstra, o texto explica. Aqui a arte
 * deixa de ser um print ao lado do texto e passa a ser **a cena inteira**.
 *
 * ── Por que ainda é UM componente, se o molde único era o problema ──────────
 *
 * Porque o que cansava não era o componente: era as cinco seções serem
 * **visualmente idênticas**. Cada cena agora tem arte própria, e o `lado` muda
 * de onde o texto vem. O que se repete é a mecânica — recorte, escurecimento,
 * lazy —, e essa é justamente a parte que **não pode** divergir entre elas (§4).
 *
 * ── O texto precisa sobreviver à arte ───────────────────────────────────────
 *
 * As artes são claras no miolo e cheias de detalhe. Texto solto por cima delas
 * seria ilegível em metade das telas — então cada cena carrega um **véu**:
 * um gradiente que escurece o lado onde o texto mora e deixa o outro limpo.
 * É o que permite pôr texto sobre imagem sem apagar a imagem.
 *
 * ── Custo, e o que ele NÃO cobre ────────────────────────────────────────────
 *
 * `loading="lazy"` é obrigatório: são seis cenas, e a de baixo não pode ser
 * baixada por quem nunca rolou até ela. O `srcset` faz o navegador escolher o
 * tamanho — a mesma cena custa 147 kB a 1600 px e 57 kB a 828 px.
 *
 * **O orçamento de bytes do CI NÃO vê isto**: ele mede chunk de JavaScript.
 * O peso das artes é responsabilidade de quem as acrescenta, e está medido em
 * `docs/DESEMPENHO.md`.
 */
export default function CenaDaLanding({
  id, arte, largura, altura, eyebrow, titulo, descricao, lado = 'esquerda',
  prioridade = false,
}) {
  const textoNaEsquerda = lado === 'esquerda';

  return (
    <motion.section
      id={id}
      // `scroll-mt` compensa a barra fixa do topo: sem isso o link leva a seção
      // para debaixo dela, e o visitante cai num lugar que parece o errado.
      style={{ scrollMarginTop: '5rem' }}
      variants={fadeUpReveal} initial="initial" whileInView="animate" viewport={VIEWPORT}
      className="relative overflow-hidden md:rounded-2xl my-8 md:my-16"
    >
      <img
        src={arte.src}
        srcSet={arte.srcSet}
        sizes="(max-width: 767px) 100vw, min(1600px, 100vw)"
        width={largura} height={altura}
        alt=""
        aria-hidden="true"
        // A primeira cena pode ser ansiosa; as outras nunca. Seis artes baixando
        // juntas seriam ~700 kB para quem talvez pare na primeira dobra.
        loading={prioridade ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={prioridade ? 'high' : 'low'}
        className="w-full h-full object-cover"
      />

      {/* O véu, SÓ a partir do `md`. Ele escurece o lado do texto e some no
          outro — a arte continua visível onde ela é o assunto. No celular não
          há sobreposição, então não há o que escurecer. */}
      <div
        aria-hidden
        className="hidden md:block absolute inset-0 pointer-events-none"
        style={{
          background: textoNaEsquerda
            ? 'linear-gradient(90deg, rgba(6,6,8,0.94) 0%, rgba(6,6,8,0.82) 34%, rgba(6,6,8,0.25) 62%, rgba(6,6,8,0.05) 100%)'
            : 'linear-gradient(270deg, rgba(6,6,8,0.94) 0%, rgba(6,6,8,0.82) 34%, rgba(6,6,8,0.25) 62%, rgba(6,6,8,0.05) 100%)',
        }}
      />

      {/* ── `[12/09]` No CELULAR o texto fica EMBAIXO, não por cima ───────────
          Medido em 400×800: com a arte 16:9 ocupando a largura, a cena tem
          **225 px de altura** e a coluna de texto sobreposta ficaria com
          **128 px de largura**. Não é apertado: é ilegível.

          A causa é a proporção, não o código — 16:9 numa tela em pé não tem
          onde pôr texto por cima. **O bloco 2 resolve de verdade**, com artes
          compostas em retrato, que o dono vai gerar. Até lá, empilhar é o piso:
          a arte vira uma faixa no topo e o texto vem abaixo, legível. */}
      <div
        className={`md:absolute md:inset-0 flex md:items-center
                    ${textoNaEsquerda ? 'md:justify-start' : 'md:justify-end'}`}
      >
        <div className="w-full md:w-auto md:max-w-[46%] px-5 py-6 md:py-0
                        md:px-12 lg:px-16 space-y-2 md:space-y-4">
          <span className="font-mono text-[0.62rem] md:text-xs tracking-[0.3em] uppercase text-neon-green">
            {eyebrow}
          </span>
          <h2 className="font-display font-bold text-white leading-[1.08]
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
    </motion.section>
  );
}
