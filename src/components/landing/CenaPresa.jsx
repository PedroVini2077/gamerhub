import { useMotionValue, useReducedMotion } from 'framer-motion';
import PalcoDeRolagem from './PalcoDeRolagem';
import ArteDaCena from './ArteDaCena';
import TextoDaCena from './TextoDaCena';

/**
 * Uma cena que PRENDE — ela fica na tela enquanto a rolagem passa por ela.
 *
 * ── Quando uma cena merece prender, e quando não `[12/09]` ──────────────────
 *
 * O critério é um só, e não é "qual é a mais importante": **a cena tem uma
 * transformação para contar?** Algo que começa de um jeito e termina de outro.
 *
 * | Cena | Transformação | Prende? |
 * | --- | --- | --- |
 * | Comunidade | disperso → conectado | **sim** |
 * | Keys | coleção → oportunidade | **sim** |
 * | Feed | atividade acontecendo | não — é um estado, não uma virada |
 * | Lives | está no ar agora | não — idem |
 * | Ranks | a barra enche | não: a rolagem da página já é a barra |
 *
 * Prender custa: cada cena presa soma ~2,5 telas de rolagem. Prender as cinco
 * somaria ~13 telas a uma página que já tem 9, e é o que o dono chamou de
 * *"cinco mini-sites consecutivos"*.
 *
 * ── Por que ela NÃO tem cortina ─────────────────────────────────────────────
 *
 * Porque prender já é a revelação. A cena chega com o progresso em 0 e o que
 * acontece nela é conduzido pela rolagem do começo ao fim — pôr uma cortina em
 * cima disso seria animar a entrada de uma animação.
 *
 * ── `prefers-reduced-motion`, e por que NÃO existe uma segunda versão ───────
 *
 * A cena deixa de prender e vira uma seção comum de uma tela. A sobreposição é
 * **a mesma**, recebendo um progresso que vale 1 e nunca muda — ou seja, o
 * estado final da história, parado.
 *
 * Escrever uma segunda versão "estática" de cada sobreposição seria a segunda
 * fonte de verdade que o §4 proíbe: no dia em que alguém mudasse a animada, a
 * parada continuaria contando a história antiga, e ninguém que enxerga as duas
 * estaria olhando.
 *
 * @param {object} props
 * @param {number} [props.altura] Alturas de tela que a cena consome. É o TEMPO
 *   dela: curto demais e a transformação vira um susto; longo demais e a pessoa
 *   acha que a página travou.
 * @param {(progresso: import('framer-motion').MotionValue<number>) => React.ReactNode}
 *   props.sobreposicao A camada de produto, conduzida pelo progresso.
 */
export default function CenaPresa({
  id, arte, eyebrow, titulo, descricao, lado = 'esquerda',
  altura = 250, sobreposicao,
}) {
  const menosMovimento = useReducedMotion();
  // O progresso congelado no FIM. Criado sempre — hook não pode ficar atrás de
  // condicional — e usado só no caminho sem movimento.
  const semTempo = useMotionValue(1);

  const moldura = (
    <>
      <ArteDaCena arte={arte} />
      <TextoDaCena eyebrow={eyebrow} titulo={titulo} descricao={descricao} lado={lado} />
    </>
  );

  if (menosMovimento) {
    return (
      <section id={id} style={{ scrollMarginTop: '5rem' }} className="relative overflow-hidden md:rounded-2xl my-8 md:my-16">
        {moldura}
        {sobreposicao(semTempo)}
      </section>
    );
  }

  // **Sem `overflow-hidden` e sem `transform` aqui**, e não é descuido de
  // estilo: `position: sticky` para de grudar dentro de qualquer ancestral com
  // um dos dois — ele passa a se ancorar naquele contêiner, que não rola. A
  // cena continuaria bonita e simplesmente não prenderia, que é o tipo de falha
  // muda que este projeto persegue (§1.5). O recorte e o arredondamento moram
  // no próprio elemento preso, dentro do `PalcoDeRolagem`.
  return (
    <section id={id} style={{ scrollMarginTop: '5rem' }}>
      <PalcoDeRolagem altura={altura} classeDoPalco="md:rounded-2xl">
        {(progresso) => (
          <>
            {moldura}
            {sobreposicao(progresso)}
          </>
        )}
      </PalcoDeRolagem>
    </section>
  );
}
