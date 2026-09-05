import { Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { QueryClientProvider } from '@tanstack/react-query';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { useRole } from './hooks/useRole';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ErrorBoundary from './components/ErrorBoundary';
import { identificarUsuario } from './lib/monitoring';
import { useDbOffline } from './hooks/useDbOffline';
import { useConfigDoSite, ProvedorDaConfigDoSite } from './hooks/useConfigDoSite.jsx';
import AvisoSemBanco from './components/ui/AvisoSemBanco';
import MaintenancePage from './components/ui/MaintenancePage';
import RolagemDeRota from './components/ui/RolagemDeRota';
import GlobalBanner from './components/ui/GlobalBanner';
import AvisoDeAceite from './components/ui/AvisoDeAceite';
import BotaoDeSom from './components/landing/BotaoDeSom';
import PortaoDeBoasVindas from './components/auth/PortaoDeBoasVindas';
import { deveTocarSom } from './lib/rotasComSom';
import FundoDaSecao from './components/layout/FundoDaSecao';
import FeatureGate from './components/ui/FeatureGate';
import PageTransition from './components/ui/PageTransition';
import SplashScreen from './components/ui/SplashScreen';
import RequireAuth from './components/auth/RequireAuth';
import GuestOnly from './components/auth/GuestOnly';

// Carregamento imediato — páginas acessadas antes do login
import IntroLightning from './components/landing/IntroLightning';
import { deveTocarIntroAgora, marcarIntroVista, introJaVista } from './lib/introJaVista';
import Login from './pages/Login';
import AuthConfirm from './pages/AuthConfirm';
import NotFound from './pages/NotFound';

// As páginas sob demanda moram em `paginasLazy.js` — ver o porquê lá.
import {
  Landing, Home, Sobre, Privacidade, Regras, Contato, Termos, PostPage, MuralPage, Community, Keys, Profile, Admin, Settings, UserProfile, Lives, Ranks, Owner,
} from './paginasLazy';

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const location  = useLocation();
  const { user, profile } = useAuth();
  const { isOwner } = useRole();

  // `[03/09]` A busca do `site_config` saiu daqui para o `AppRoutes`.
  //
  // Ela vivia neste efeito, e o `Layout` **nunca monta na landing** — então
  // quem chegava pela landing jamais aprendia o `pause_reason`, nem com o banco
  // de pé. Era por isso que o dono via a mensagem genérica no celular depois de
  // escrever uma personalizada no painel. Ver `usaConfigDoSite`.
  const { maintenance, configLoaded } = useConfigDoSite();

  // Carimba quem está usando nos relatórios de erro. Só `id` e `username` — as
  // mesmas coisas que qualquer visitante já vê num perfil público. Fica aqui, e
  // não dentro do `useAuth`, porque aquele é o arquivo de maior risco do
  // projeto (§7) e isto é conveniência de diagnóstico, não funcionalidade.
  useEffect(() => { identificarUsuario(profile); }, [profile]);

  // Só bloqueia quando: config carregada + manutenção ativa + perfil resolvido + não é owner
  // profileSettled evita flash de manutenção enquanto o perfil do owner carrega
  const profileSettled = !user || profile !== null;
  const showMaintenance = configLoaded && maintenance && profileSettled && !isOwner;

  return (
    <div className="min-h-screen bg-dark-900 grid-bg scanline-overlay">
      <FundoDaSecao />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:ml-60 flex flex-col min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 pt-20 pb-8 px-4 md:px-6 max-w-6xl w-full mx-auto">
          <GlobalBanner />
          {/* `[02/09]` Só na área logada, e por dois motivos: a landing é
              vista por quem nem tem conta (não há aceite a cobrar de
              ninguém), e é justamente ali que a pessoa vai LER os documentos
              — cobrar aceite na mesma tela em que ela está lendo seria
              atropelo. */}
          <AvisoDeAceite />
          <AnimatePresence mode="wait" initial={false}>
            {showMaintenance ? (
              <PageTransition key="maintenance">
                <MaintenancePage />
              </PageTransition>
            ) : (
              <PageTransition key={location.pathname}>
                <ErrorBoundary key={location.pathname}>
                  <Suspense fallback={<PageLoader />}>
                    {children}
                  </Suspense>
                </ErrorBoundary>
              </PageTransition>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// Decide entre Landing (guest) e o feed (logado) na rota raiz — sem mudar a URL.
// A Landing fica fora do Layout, então precisa do próprio Suspense.
function HomeOrLanding() {
  const { user } = useAuth();
  const semBanco = useDbOffline();
  // `[02/09]` A intro do raio é montada AQUI, e não dentro do Hero.
  //
  // Ela morava no Hero, que vive no chunk lazy da landing. Consequência
  // medida: o raio só existia na tela depois de aquele chunk baixar e
  // executar — 1320 ms a 6x de CPU, 1820 ms a 8x. Todo esse tempo é tela
  // preta, e era metade do "às vezes não aparece" que o dono relatou.
  //
  // Aqui ela está no pacote inicial, e por isso pode aparecer enquanto a
  // landing ainda baixa. Custa quase nada em bytes porque, desde a mesma
  // sessão, a intro é CSS puro — ela não arrasta o Framer Motion junto.
  //
  // O hook fica ANTES do `return` do feed de propósito: hooks não podem ficar
  // atrás de saída condicional (Rules of Hooks).
  const [introDone, setIntroDone] = useState(() => !deveTocarIntroAgora());

  function aoTerminarIntro() {
    marcarIntroVista();
    setIntroDone(true);
  }

  // Sem banco o feed não tem o que mostrar — ele é consulta pura. A landing é
  // estática e continua de pé, então é ela que atende a raiz até o banco voltar.
  if (user && !semBanco) return <Layout><Home /></Layout>;
  return (
    <>
      {!introDone && <IntroLightning onComplete={aoTerminarIntro} />}
      {/* A intro cobre a tela inteira, então ela TAMBÉM serve de fallback:
          enquanto o chunk da landing baixa, quem está olhando vê o raio em vez
          do splash. Os dois nunca aparecem juntos. */}
      <Suspense fallback={introDone ? <SplashScreen /> : null}>
        <Landing introDone={introDone} />
      </Suspense>
    </>
  );
}

// Splash enquanto a sessão resolve — evita flash de Landing↔Home/guard.
function AppRoutes() {
  const { loading, user } = useAuth();
  const semBanco = useDbOffline();
  const { pathname } = useLocation();
  // `[02/09]` O som atravessa TODAS as páginas de fora — landing, /sobre,
  // /regras, /privacidade, /termos, /contato e /login — e para ao entrar no
  // site. Pedido do dono, com essas palavras.
  //
  // O botão fica AQUI, fora do `<Routes>`, e essa posição é o mecanismo
  // inteiro: navegar entre rotas não desmonta o que está fora do `<Routes>`,
  // então a trilha continua tocando de uma página para a outra em vez de
  // recomeçar. E quando `deveTocarSom` vira falso, o componente desmonta e o
  // `desligarSom()` do cleanup dele solta o áudio — parar é consequência de
  // sair, e não uma segunda regra que alguém precisa lembrar de manter.
  const comSom = deveTocarSom(pathname, !!user);

  // Sem banco, o `loading` da sessão nunca termina — sem esta saída a pessoa
  // ficaria no splash para sempre. Mas o app NÃO é sequestrado: as rotas
  // continuam montadas, e quem barra o que depende do banco é o `RequireAuth`.
  if (loading && !semBanco) return <SplashScreen />;

  return (
    <>
      {semBanco && <AvisoSemBanco />}
      {/* Fica FORA do `<Routes>` de propósito: ele cobre a montagem do site
          logado, que acontece depois da troca de rota. Dentro de uma rota, ele
          desmontaria junto com a tela de login. */}
      <PortaoDeBoasVindas />
      <RolagemDeRota />
      {/* `introTerminou` só faz sentido na raiz, onde a intro toca. Nas outras
          páginas públicas não há raio para esperar, então a tentativa pode
          acontecer assim que a página monta. */}
      {comSom && <BotaoDeSom introTerminou={pathname !== '/' || introJaVista()} />}
      <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/auth/confirm" element={<AuthConfirm />} />
      {/* Pública de propósito: alguém precisa poder ler sobre o projeto ANTES
          de decidir criar conta. Fica fora do `Layout` porque a landing também
          fica — as duas são as páginas de quem ainda não entrou. */}
      <Route path="/sobre" element={<Sobre />} />
      {/* Pública pelo mesmo motivo da Sobre, e um mais forte: ninguém deveria
          precisar criar conta para descobrir o que acontece com os dados dela
          se criar. */}
      <Route path="/privacidade" element={<Privacidade />} />
      {/* Pública porque a tela de banimento aponta para cá: quem foi punido
          precisa alcançar as regras sem estar logado. */}
      <Route path="/regras" element={<Regras />} />
      {/* `[02/09]` Pública, e aqui "público" É o requisito, não uma
          conveniência: quem está banido, quem perdeu o acesso e quem nunca
          criou conta são exatamente as pessoas que mais precisam falar com a
          equipe — e todas estão do lado de fora do `RequireAuth`. */}
      <Route path="/contato" element={<Contato />} />
      {/* `[02/09]` Pública pela razão mais direta de todas: ninguém deveria
          precisar criar conta para ler o que está aceitando AO criar conta. */}
      <Route path="/termos" element={<Termos />} />
      <Route path="/" element={<HomeOrLanding />} />
      {/* Endereço próprio de um post. Existe para o link direto da fila de
          moderação — antes não havia para onde apontar, o feed é `/` e um post
          antigo podia nem estar na primeira página. Ver `PostPage.jsx`. */}
      <Route path="/post/:id" element={<RequireAuth><Layout><PostPage /></Layout></RequireAuth>} />
      <Route path="/mural/:id" element={<RequireAuth><Layout><FeatureGate flag="feature_community"><MuralPage /></FeatureGate></Layout></RequireAuth>} />
      <Route path="/community" element={<RequireAuth><Layout><FeatureGate flag="feature_community"><Community /></FeatureGate></Layout></RequireAuth>} />
      <Route path="/keys" element={<RequireAuth><Layout><FeatureGate flag="feature_keys"><Keys /></FeatureGate></Layout></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><Layout><Profile /></Layout></RequireAuth>} />
      <Route path="/u/:username" element={<RequireAuth><Layout><UserProfile /></Layout></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Layout><Settings /></Layout></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth><Layout><Admin /></Layout></RequireAuth>} />
      <Route path="/lives" element={<RequireAuth><Layout><FeatureGate flag="feature_lives"><Lives /></FeatureGate></Layout></RequireAuth>} />
      <Route path="/lives/:id" element={<RequireAuth><Layout><FeatureGate flag="feature_lives"><Lives /></FeatureGate></Layout></RequireAuth>} />
      <Route path="/ranks" element={<RequireAuth><Layout><Ranks /></Layout></RequireAuth>} />
      <Route path="/owner" element={<RequireAuth><Layout><Owner /></Layout></RequireAuth>} />
      <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Rede de segurança de nível raiz: pega crashes de render em QUALQUER
          rota (inclusive Login/AuthConfirm/NotFound, fora do Layout) e até do
          próprio AuthProvider — evita tela branca total. Os ErrorBoundary
          por-rota dentro do Layout continuam como camada granular. */}
      <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#0d0d12',
              color: '#e0e0e0',
              border: '1px solid #2e2e3e',
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#39ff14', secondary: '#060608' } },
          }}
        />
        {/* `[03/09]` UMA leitura do `site_config`, no topo — e é o que faz a
            landing aprender o `pause_reason`. Antes ela vivia dentro do
            `Layout`, que nunca monta na landing: quem chegava por ali via a
            mensagem genérica mesmo com o banco de pé, e foi o que o dono
            relatou. Ver `hooks/useConfigDoSite.jsx`. */}
        <ProvedorDaConfigDoSite>
          <AppRoutes />
        </ProvedorDaConfigDoSite>
        <SpeedInsights />
        <Analytics />
      </AuthProvider>
      </QueryClientProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
