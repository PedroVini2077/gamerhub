import usePonteiroDaPagina from '../hooks/usePonteiroDaPagina';
import LandingNav from '../components/landing/LandingNav';
import PrologoDaLanding from '../components/landing/PrologoDaLanding';
import CenaDaLanding from '../components/landing/CenaDaLanding';
import CenaPresa from '../components/landing/CenaPresa';
import SobreposicaoDoFeed from '../components/landing/cenas/SobreposicaoDoFeed';
import SobreposicaoDaComunidade from '../components/landing/cenas/SobreposicaoDaComunidade';
import SobreposicaoDasLives from '../components/landing/cenas/SobreposicaoDasLives';
import SobreposicaoDasKeys from '../components/landing/cenas/SobreposicaoDasKeys';
import SobreposicaoDosRanks from '../components/landing/cenas/SobreposicaoDosRanks';
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
  // UM ouvinte de ponteiro para a landing inteira. `[12/09]` Com o
  // `FluxoDeDados` fora daqui, quem consome `--ponteiro-x/y` é a
  // `MarcaFlutuante` — o hook CONTINUA necessário, e apagá-lo junto teria
  // deixado a marca do hero parada sem ninguém notar de imediato.
  usePonteiroDaPagina();

  // ── `[12/09]` O `FluxoDeDados` SAIU daqui, e não é porque ele é ruim ──────
  //
  // Ordem do dono: *"ele simplesmente perdeu relevância diante da nova
  // linguagem visual... uma cachoeira de dados atrás de tudo começa a
  // competir"*. Com as artes ocupando a tela inteira ele mal aparecia — e onde
  // aparecia, disputava com o assunto.
  //
  // **Ele continua vivo e em uso**: o site logado o monta pelo `FundoDaSecao`,
  // com a cor de cada seção. O que saiu foi a participação dele NA LANDING.
  //
  // `grid-bg` e `scanline-overlay` FICAM, e a distinção é do próprio pedido
  // dele: o fluxo era **elemento visual ativo**; estes dois são **textura
  // ambiental**, sem movimento próprio competindo com a cena.
  return (
    <div className="min-h-screen bg-dark-900 grid-bg scanline-overlay relative">
      <div className="relative z-10">
      <LandingNav />
      {/* `[12/09]` O hero deixou de ser uma tela e virou os CINCO ATOS que a
          rolagem conduz — ARTE, TRANSFORMAÇÃO, CONVERGÊNCIA, MARCA, GAMERHUB.
          O `Hero` continua existindo e continua sendo o último ato; quem o
          monta agora é o prólogo. Ver `components/landing/PrologoDaLanding.jsx`. */}
      <PrologoDaLanding introDone={introDone} />

      {/* ── `[12/09]` A faixa INVADE o fim do prólogo ────────────────────────
          A margem negativa faz as cartas subirem por cima dos últimos 12vh da
          cena presa do hero — que é onde ele já terminou de se montar e só há
          espaço vazio embaixo do botão.
          É o que transforma *"acabou o hero, começaram os cards"* em *"o hero
          cede e os cards assumem"*. O `z-20` é obrigatório: sem ele a cena
          presa, que vem antes no fluxo, ficaria por cima. */}
      <div className="relative z-20 -mt-[8vh] md:-mt-[12vh] max-w-5xl mx-auto px-4 md:px-6">
        <HighlightsStrip />
      </div>

      {/* `[12/09]` AS CENAS SAEM DO CONTÊINER ESTREITO, e isso é pedido dele:
          *"não tenha medo de abandonar a escala atual... algumas cenas podem
          ocupar 100vw"*. Dentro do `max-w-5xl` a arte virava um cartão de
          976 px no meio de um monitor de 1440 — medido no primeiro print. */}
      <div className="px-0 md:px-6">
        {/* ── `[12/09]` AS CINCO CENAS, e cada uma com a FORMA que o que ela
            conta pede ────────────────────────────────────────────────────────

            A ordem segue a jornada, não o alfabeto: o que se descobre primeiro
            (o feed), depois a gente (comunidade), depois o que acontece ao vivo
            (lives), depois a recompensa (keys) e por fim a progressão (ranks).

            `lado` alterna de propósito — e agora ele decide duas coisas: de que
            lado o texto mora E de que lado a sobreposição pousa (sempre a
            oposta). Duas cenas seguidas nunca têm o mesmo desenho na tela.

            DUAS prendem e TRÊS atravessam. O critério não é importância, é se a
            cena tem uma TRANSFORMAÇÃO para contar — ver `CenaPresa.jsx`. É o
            que dá o ritmo IMPACTO → RESPIRO que o dono pediu, em vez de cinco
            mini-sites em fila. */}

        <CenaDaLanding
          id="feed" arte={CENAS.feed}
          eyebrow="Feed"
          titulo="Um feed que não para"
          descricao="Dicas, descobertas e novidades postadas pela galera — curta, comente e entre na conversa."
          lado="esquerda"
          revelacao="costura"
          sobreposicao={() => <SobreposicaoDoFeed lado="esquerda" />}
        />

        <CenaPresa
          id="mural" arte={CENAS.comunidade} altura={260}
          eyebrow="Comunidade"
          titulo="Tem gente aqui"
          descricao="O mural é o ponto de encontro informal: prints, squads sendo montados e papo solto com quem também joga."
          lado="direita"
          sobreposicao={(p) => <SobreposicaoDaComunidade progresso={p} lado="direita" />}
        />

        <CenaDaLanding
          id="lives" arte={CENAS.lives}
          eyebrow="Lives"
          titulo="Está acontecendo agora"
          descricao="Sua transmissão do Twitch ou do YouTube dentro do Hub, com chat em tempo real e contador de quem está assistindo."
          lado="esquerda"
          revelacao="centro"
          sobreposicao={() => <SobreposicaoDasLives lado="esquerda" />}
        />

        <CenaPresa
          id="keys" arte={CENAS.keys} altura={240}
          eyebrow="Keys & Promos"
          titulo="Keys grátis e as promoções que valem"
          descricao="O código pronto para copiar, a plataforma na etiqueta, e a lista atualizada pela equipe."
          lado="direita"
          sobreposicao={(p) => <SobreposicaoDasKeys progresso={p} lado="direita" />}
        />

        <CenaDaLanding
          id="ranks" arte={CENAS.ranks}
          eyebrow="Ranks & XP"
          titulo="Participar conta, e aparece"
          descricao="Postar, comentar e receber curtidas rende XP. O rank é o que a comunidade vê do seu histórico."
          lado="esquerda"
          revelacao="varredura"
          sobreposicao={(p) => <SobreposicaoDosRanks progresso={p} lado="esquerda" />}
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
