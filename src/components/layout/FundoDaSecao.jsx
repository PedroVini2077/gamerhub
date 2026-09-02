import { useLocation } from 'react-router-dom';
import { acentoDaSecao, elencoDaSecao } from '../../lib/acentoDaSecao';
import FluxoDeDados from '../landing/FluxoDeDados';
import PecasFlutuantes from './PecasFlutuantes';

/**
 * O fundo animado do site logado.
 *
 * ── A decisão que isto executa ──────────────────────────────────────────────
 *
 * Do dono, em 02/09: *"pode fazer o mesmo fundo pra todas as rotas então"*. É
 * o **mesmo** `FluxoDeDados` da landing — não um componente parecido. Fazer um
 * segundo seria criar a segunda fonte de verdade que o §4 proíbe, e ela
 * divergiria justamente onde dói: desempenho, `prefers-reduced-motion`, e o
 * conserto do `100lvh` que já custou um bug de salto no celular.
 *
 * ── `parallax={false}` não é economia à toa ─────────────────────────────────
 *
 * Ponteiro e rolagem custam +451 ms e +296 ms medidos durante movimento
 * contínuo (ver DESEMPENHO.md), e o feed é a tela onde mais se rola. Sem eles
 * a camada custa **zero** medido — que é exatamente o *"o site logado deve ser
 * mais quieto que a landing"* da decisão.
 *
 * ── `[02/09]` DUAS camadas, e não uma ──────────────────────────────────────
 *
 * O dono gostou do fluxo de dados no site logado e pediu mais: *"vamos manter
 * essa animação no site logado, mas quero outras coisas lá, diferentes do
 * resto"*.
 *
 * O fluxo é a assinatura **compartilhada** com a landing; as peças de
 * videogame são o que **separa** o site logado do resto. Somar as duas entrega
 * as duas coisas — família e identidade própria — sem precisar de um terceiro
 * componente que imite os dois.
 *
 * ── Por que ele decide sozinho, em vez de receber a cor por prop ────────────
 *
 * Porque quem monta o `Layout` não tem por que saber de cor de fundo. Deixando
 * a decisão aqui, o `Layout` volta a ter um assunto só — e foi o inchaço dele
 * que o `npm run fim` reprovou quando isto morava lá dentro.
 */
export default function FundoDaSecao() {
  const { pathname } = useLocation();
  const acento = acentoDaSecao(pathname);

  // `undefined` = seção sem fundo (os painéis de equipe). Não existe cor
  // padrão de propósito — ver `acentoDaSecao`.
  if (!acento) return null;
  return (
    <>
      <FluxoDeDados acento={acento} parallax={false} />
      <PecasFlutuantes elenco={elencoDaSecao(pathname)} acento={acento} />
    </>
  );
}
