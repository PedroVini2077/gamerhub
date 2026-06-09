import { Newspaper, Users, Tv, Trophy, Key } from 'lucide-react';
import LandingNav from '../components/landing/LandingNav';
import Hero from '../components/landing/Hero';
import FeatureSection from '../components/landing/FeatureSection';
import LandingShot from '../components/landing/LandingShot';
import HighlightsStrip from '../components/landing/HighlightsStrip';
import FinalCTA from '../components/landing/FinalCTA';
import LandingFooter from '../components/landing/LandingFooter';
import feedShot from '../assets/landing/feed.jpg';
import muralShot from '../assets/landing/mural.jpg';
import livesShot from '../assets/landing/lives.jpg';
import keysShot from '../assets/landing/keys.jpg';
import ranksShot from '../assets/landing/ranks.jpg';

// Página pública vista por quem ainda não está logado — apresenta o site
// antes do login/cadastro (ver App.jsx: HomeOrLanding decide entre esta
// página e o feed real com base no estado de autenticação).
// As imagens das features são prints reais do site (nomes de usuários
// borrados por privacidade).
export default function Landing() {
  return (
    <div className="min-h-screen bg-dark-900 grid-bg scanline-overlay">
      <LandingNav />
      <Hero />

      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <HighlightsStrip />

        <FeatureSection
          icon={Newspaper}
          eyebrow="Feed"
          title="Dicas, curiosidades e news da comunidade"
          description="Acompanhe um feed colaborativo onde a galera posta dicas, descobertas e novidades — curta, comente e participe das discussões."
          details="Posts com categorias (dica, curiosidade, news), curtidas, comentários com respostas em thread, busca e filtros — tudo em tempo real."
          accent="green"
          mockup={<LandingShot src={feedShot} alt="Feed do GamerHub com keys grátis e promoções na lateral" />}
        />

        <FeatureSection
          icon={Users}
          eyebrow="Mural"
          title="Mural da comunidade"
          description="Um espaço aberto pra trocar ideias, organizar squads, compartilhar prints e bater papo com outros membros do Hub."
          details="Mural com posts livres, imagens, reações e conversas em tempo real — o ponto de encontro informal da comunidade."
          accent="purple"
          reverse
          mockup={<LandingShot src={muralShot} alt="Mural da comunidade do GamerHub" />}
        />

        <FeatureSection
          icon={Tv}
          eyebrow="Lives"
          title="Suas lives do Twitch e YouTube, com chat na hora"
          description="Traga sua transmissão do Twitch ou do YouTube e assista as dos outros membros direto no Hub — com chat em tempo real e contador de espectadores ao vivo."
          details="Embeds de Twitch e YouTube com chat próprio do Hub, moderação, presença online e contador de espectadores em tempo real — sem sair da plataforma."
          accent="cyan"
          mockup={<LandingShot src={livesShot} alt="Aba de Lives do GamerHub com gameplays, reacts e lives da comunidade" />}
        />

        <FeatureSection
          icon={Key}
          eyebrow="Keys & Promos"
          title="Keys de jogos grátis e as melhores promoções"
          description="Pegue keys de jogos grátis e fique por dentro das melhores promoções — direto no Hub, com o código pronto pra copiar na hora."
          details="Seção de keys grátis e promoções com a plataforma (Steam, Epic, GOG), código copiável e atualização constante pela equipe."
          accent="purple"
          reverse
          mockup={<LandingShot src={keysShot} alt="Página de Keys e Promoções do GamerHub" />}
        />

        <FeatureSection
          icon={Trophy}
          eyebrow="Ranks & XP"
          title="Suba de rank e mostre seu progresso"
          description="Ganhe XP postando, recebendo curtidas, comentando e completando seu perfil — evolua de rank e mostre quem é o melhor pra toda a comunidade."
          details="Sistema de XP automático com ranks visuais, sub-ranks e progressão — quanto mais ativo, mais alto você sobe."
          accent="green"
          mockup={<LandingShot src={ranksShot} alt="Sistema de ranks e XP do GamerHub" />}
        />

        <FinalCTA />
      </div>

      <LandingFooter />
    </div>
  );
}
