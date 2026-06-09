import { Newspaper, Users, Tv, Trophy } from 'lucide-react';
import LandingNav from '../components/landing/LandingNav';
import Hero from '../components/landing/Hero';
import FeatureSection from '../components/landing/FeatureSection';
import HighlightsStrip from '../components/landing/HighlightsStrip';
import FinalCTA from '../components/landing/FinalCTA';
import LandingFooter from '../components/landing/LandingFooter';
import FeedMockup from '../components/landing/mockups/FeedMockup';
import MuralMockup from '../components/landing/mockups/MuralMockup';
import LivesMockup from '../components/landing/mockups/LivesMockup';
import RanksMockup from '../components/landing/mockups/RanksMockup';

// Página pública vista por quem ainda não está logado — apresenta o site
// antes do login/cadastro (ver App.jsx: HomeOrLanding decide entre esta
// página e o feed real com base no estado de autenticação).
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
          mockup={<FeedMockup />}
        />

        <FeatureSection
          icon={Users}
          eyebrow="Mural"
          title="Mural da comunidade"
          description="Um espaço aberto pra trocar ideias, organizar squads, compartilhar prints e bater papo com outros membros do Hub."
          details="Mural com posts livres, imagens, reações e conversas em tempo real — o ponto de encontro informal da comunidade."
          accent="purple"
          reverse
          mockup={<MuralMockup />}
        />

        <FeatureSection
          icon={Tv}
          eyebrow="Lives"
          title="Suas lives do Twitch e YouTube, com chat na hora"
          description="Traga sua transmissão do Twitch ou do YouTube e assista as dos outros membros direto no Hub — com chat em tempo real e contador de espectadores ao vivo."
          details="Embeds de Twitch e YouTube com chat próprio do Hub, moderação, presença online e contador de espectadores em tempo real — sem sair da plataforma."
          accent="cyan"
          mockup={<LivesMockup />}
        />

        <FeatureSection
          icon={Trophy}
          eyebrow="Ranks & XP"
          title="Suba de rank e desbloqueie recompensas"
          description="Ganhe XP postando, curtindo, comentando e participando de lives — evolua de rank e mostre seu progresso pra toda a comunidade."
          details="Sistema de XP automático com ranks visuais, auras de perfil e progressão — quanto mais ativo, mais alto você sobe."
          accent="green"
          reverse
          mockup={<RanksMockup />}
        />

        <FinalCTA />
      </div>

      <LandingFooter />
    </div>
  );
}
