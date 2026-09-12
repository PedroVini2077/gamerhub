import { motion, useTransform } from 'framer-motion';
import ArteDaCena from './ArteDaCena';
import { INVASOES, JANELA_DA_INVASAO } from '../../lib/costuraDeCena';

/**
 * A arte de uma cena, com o GESTO com que ela invade a anterior.
 *
 * ── Por que a invasão mora aqui, e não em cada cena `[12/09]` ───────────────
 *
 * Porque os três tipos de cena — a que atravessa, a que prende e o fecho —
 * precisam do mesmo gesto, e o gesto é sempre a mesma coisa: um `transform` na
 * arte, conduzido pelo progresso, terminando parado.
 *
 * Escrito em cada uma, o "terminando parado" divergiria — e esse é justamente o
 * detalhe que separa a invasão do parallax exagerado que o dono proibiu.
 *
 * ── Ela TERMINA PARADA, e isso é a regra ────────────────────────────────────
 *
 * A janela vai de 0 a 0,42 do progresso da cena na tela: o gesto acontece
 * enquanto ela entra e acaba antes de ela estar enquadrada. Depois disso a arte
 * não se mexe mais.
 *
 * Uma imagem que nunca para de deslizar é o que faz uma página parecer inquieta
 * — e o próprio dono pediu *"movimento com intenção"* e *"ter momentos de
 * repouso é importante"*.
 *
 * ── Custo ───────────────────────────────────────────────────────────────────
 *
 * Um `MotionValue` por eixo, escrito direto no elemento. Sem `useState`, sem
 * laço por quadro, sem filtro. `x`, `y` e `scale` são compostos pelo navegador.
 *
 * @param {object} props
 * @param {'sobe'|'afasta'|'aproxima'|'deriva'} [props.invasao] O gesto. Sem
 *   ele a arte entra parada — que é o certo para a primeira cena da página,
 *   que não invade nada.
 */
export default function ArteQueInvade({ arte, prioridade = false, progresso, invasao }) {
  // Mapa EXPLÍCITO: gesto desconhecido estoura aqui em vez de cair num padrão
  // silencioso que faria a cena entrar sem invadir, e ninguém notaria (§4).
  const gesto = invasao ? INVASOES[invasao] : null;
  if (invasao && !gesto) throw new Error(`ArteQueInvade: invasão desconhecida "${invasao}"`);

  // Os três hooks são chamados SEMPRE — Rules of Hooks. O que varia é se o
  // valor deles chega ao estilo.
  const x = useTransform(progresso, JANELA_DA_INVASAO, [gesto?.de.x ?? '0%', gesto?.para.x ?? '0%']);
  const y = useTransform(progresso, JANELA_DA_INVASAO, [gesto?.de.y ?? '0%', gesto?.para.y ?? '0%']);
  const escala = useTransform(progresso, JANELA_DA_INVASAO, [gesto?.de.scale ?? 1, gesto?.para.scale ?? 1]);

  if (!gesto) return <ArteDaCena arte={arte} prioridade={prioridade} />;

  // `h-full` e NÃO `absolute`: a arte precisa continuar dando a altura da cena
  // que atravessa (a seção não tem altura própria — quem a define é a imagem).
  // Posicionar por absoluto aqui faria a seção colapsar para zero, e o defeito
  // apareceria só nas três cenas soltas.
  // Duas caixas, e a de fora é obrigatória: o recorte precisa acontecer num
  // elemento SEM transformação. Aplicado no mesmo elemento que escala, ele
  // recortaria na caixa já ampliada — ou seja, não recortaria nada.
  //
  // `[12/09]` Ele passou a ser responsabilidade daqui quando o palco trocou
  // `overflow-hidden` por `overflow-x-clip` para deixar o rastro da
  // convergência atravessar a emenda.
  //
  // `h-full` e NÃO `absolute`: a arte precisa continuar dando a altura da cena
  // que atravessa (a seção não tem altura própria — quem a define é a imagem).
  return (
    <div className="h-full overflow-hidden">
      <motion.div className="h-full" style={{ x, y, scale: escala }}>
        <ArteDaCena arte={arte} prioridade={prioridade} />
      </motion.div>
    </div>
  );
}
