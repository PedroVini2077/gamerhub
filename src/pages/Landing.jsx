import usePonteiroDaPagina from '../hooks/usePonteiroDaPagina';
import LandingNav from '../components/landing/LandingNav';
import FluxoDeDados from '../components/landing/FluxoDeDados';
import PrologoDaLanding from '../components/landing/PrologoDaLanding';
import CenaDaLanding from '../components/landing/CenaDaLanding';
import HighlightsStrip from '../components/landing/HighlightsStrip';
import FinalCTA from '../components/landing/FinalCTA';
import LandingFooter from '../components/landing/LandingFooter';
import { CENAS } from '../lib/cenasDaLanding';

// Página pública vista por quem ainda não está logado — apresenta o site
// antes do login/cadastro (ver App.jsx: HomeOrLanding decide entre esta
// página e o feed real com base no estado de autenticação).
// As imagens das features são prints reais do site (nomes de usuários
// borrados por privacidade).
/**
 * @param {{introDone?: boolean}} props `introDone` vem do `HomeOrLanding`, que
 *   é quem monta a intro do raio desde 02/09. Ele serve a duas coisas aqui: o
 *   Hero revela o conteúdo, e o som ambiente ganha o momento de tentar entrar
 *   sozinho — antes disso a tela ainda está no clarão, e um som subindo por
 *   baixo dele seria atropelo, não ambiente.
 */
export default function Landing({ introDone = true }) {
  // UM ouvinte de ponteiro para a landing inteira. Quem consome são o
  // `FluxoDeDados` e a `MarcaFlutuante`, cada um no seu ramo da árvore.
  usePonteiroDaPagina();

  return (
    <div className="min-h-screen bg-dark-900 grid-bg scanline-overlay relative">
      <FluxoDeDados />

      {/* `relative z-10`: o conteúdo inteiro fica ACIMA da camada de dados.
          Sem isto o fluxo passaria por cima do texto — que é a diferença entre
          ambientação e poluição. */}
      <div className="relative z-10">
      <LandingNav />
      {/* `[12/09]` O hero deixou de ser uma tela e virou os CINCO ATOS que a
          rolagem conduz — ARTE, TRANSFORMAÇÃO, CONVERGÊNCIA, MARCA, GAMERHUB.
          O `Hero` continua existindo e continua sendo o último ato; quem o
          monta agora é o prólogo. Ver `components/landing/PrologoDaLanding.jsx`. */}
      <PrologoDaLanding introDone={introDone} />

      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <HighlightsStrip />
      </div>

      {/* `[12/09]` AS CENAS SAEM DO CONTÊINER ESTREITO, e isso é pedido dele:
          *"não tenha medo de abandonar a escala atual... algumas cenas podem
          ocupar 100vw"*. Dentro do `max-w-5xl` a arte virava um cartão de
          976 px no meio de um monitor de 1440 — medido no primeiro print. */}
      <div className="px-0 md:px-6">
        {/* `[12/09]` AS CINCO CENAS. Elas substituem cinco `FeatureSection`
            idênticos — sobrancelha, título, descrição, botão, print —, que era
            exatamente a monotonia que o dono diagnosticou.

            A ordem segue a jornada, não o alfabeto: o que se descobre primeiro
            (o feed), depois a gente (comunidade), depois o que acontece ao vivo
            (lives), depois a recompensa (keys) e por fim a progressão (ranks).

            `lado` alterna de propósito: cinco cenas com o texto sempre à
            esquerda voltariam a ser um molde, só que com imagem maior. */}
        <CenaDaLanding
          id="feed" arte={CENAS.feed}
          eyebrow="Feed"
          titulo="Um feed que não para"
          descricao="Dicas, descobertas e novidades postadas pela galera — curta, comente e entre na conversa."
          lado="esquerda"
        />

        <CenaDaLanding
          id="mural" arte={CENAS.comunidade}
          eyebrow="Comunidade"
          titulo="Tem gente aqui"
          descricao="O mural é o ponto de encontro informal: prints, squads sendo montados e papo solto com quem também joga."
          lado="direita"
        />

        <CenaDaLanding
          id="lives" arte={CENAS.lives}
          eyebrow="Lives"
          titulo="Está acontecendo agora"
          descricao="Sua transmissão do Twitch ou do YouTube dentro do Hub, com chat em tempo real e contador de quem está assistindo."
          lado="esquerda"
        />

        <CenaDaLanding
          id="keys" arte={CENAS.keys}
          eyebrow="Keys & Promos"
          titulo="Keys grátis e as promoções que valem"
          descricao="O código pronto para copiar, a plataforma na etiqueta, e a lista atualizada pela equipe."
          lado="direita"
        />

        <CenaDaLanding
          id="ranks" arte={CENAS.ranks}
          eyebrow="Ranks & XP"
          titulo="Participar conta, e aparece"
          descricao="Postar, comentar e receber curtidas rende XP. O rank é o que a comunidade vê do seu histórico."
          lado="esquerda"
        />

      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <FinalCTA />
      </div>

      <LandingFooter />
      </div>

    </div>
  );
}
