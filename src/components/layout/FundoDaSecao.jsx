import { useLocation } from 'react-router-dom';
import { acentoDaSecao, elencoDaSecao } from '../../lib/acentoDaSecao';
import LuzesDaArena from './LuzesDaArena';
import PecasFlutuantes from './PecasFlutuantes';

/**
 * O fundo animado do site logado.
 *
 * ── `[03/09]` O que eu tinha entendido ERRADO, e a correção ────────────────
 *
 * Em 02/09 o dono disse *"pode fazer o mesmo fundo pra todas as rotas então"*,
 * e eu li como "o mesmo da landing também aqui" — então este arquivo montava o
 * `FluxoDeDados` da landing com outra cor.
 *
 * Em 03/09 ele corrigiu, e a frase não deixa dúvida: *"eu quero que o fundo do
 * site logado seja diferente do resto… não quero o fluxo de dados no site
 * logado"*. O "mesmo para todas as rotas" era **entre as abas do site logado**
 * — feed, mural, lives, keys, ranks —, não entre o site e a landing.
 *
 * ── As DUAS camadas, e por que cada uma tem um papel ───────────────────────
 *
 *   LuzesDaArena ..... atmosfera: luz que respira, quase parada
 *   PecasFlutuantes .. o movimento: as peças de videogame
 *
 * A separação é deliberada. Duas camadas se mexendo disputariam atenção uma
 * com a outra e com o conteúdo — e o site logado é onde se lê e se rola, não
 * onde se contempla. A landing fica com o fluxo de dados, que é a assinatura
 * dela e continua exclusiva dela.
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
      <LuzesDaArena acento={acento} />
      <PecasFlutuantes elenco={elencoDaSecao(pathname)} acento={acento} />
    </>
  );
}
