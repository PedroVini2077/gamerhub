import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { QueryClientProvider } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
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
import { guardarMotivoDaPausa } from './lib/pauseReason';
import AvisoSemBanco from './components/ui/AvisoSemBanco';
import RolagemDeRota from './components/ui/RolagemDeRota';
import GlobalBanner from './components/ui/GlobalBanner';
import FeatureGate from './components/ui/FeatureGate';
import PageTransition from './components/ui/PageTransition';
import SplashScreen from './components/ui/SplashScreen';
import RequireAuth from './components/auth/RequireAuth';
import GuestOnly from './components/auth/GuestOnly';
import { supabase } from './lib/supabase';

// Carregamento imediato — páginas acessadas antes do login
import Login from './pages/Login';
import AuthConfirm from './pages/AuthConfirm';
import NotFound from './pages/NotFound';

// Lazy loading — carregam só quando o usuário acessar.
// Landing e Home são exclusivas entre si (visitante × logado): deixar as duas
// no bundle inicial fazia todo mundo baixar a que nunca ia ver.
const Landing     = lazy(() => import('./pages/Landing'));
const Home        = lazy(() => import('./pages/Home'));
const Sobre       = lazy(() => import('./pages/Sobre'));
const Privacidade = lazy(() => import('./pages/Privacidade'));
const PostPage    = lazy(() => import('./pages/PostPage'));
const MuralPage   = lazy(() => import('./pages/MuralPage'));
const Community   = lazy(() => import('./pages/Community'));
const Keys        = lazy(() => import('./pages/Keys'));
const Profile     = lazy(() => import('./pages/Profile'));
const Admin       = lazy(() => import('./pages/Admin'));
const Settings    = lazy(() => import('./pages/Settings'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const Lives       = lazy(() => import('./pages/Lives'));
const Ranks       = lazy(() => import('./pages/Ranks'));
const Owner       = lazy(() => import('./pages/Owner'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function MaintenancePage() {
  return (
    <div className="flex items-center justify-center min-h-64 py-20">
      <div className="card p-10 text-center max-w-sm space-y-3">
        <Wrench size={36} className="text-neon-green mx-auto" />
        <p className="font-display text-lg text-gray-200">Em Manutenção</p>
        <p className="text-xs font-mono text-gray-500 leading-relaxed">
          O GamerHub está temporariamente em manutenção. Voltamos em breve!
        </p>
      </div>
    </div>
  );
}

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [maintenance, setMaintenance]   = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const location  = useLocation();
  const { user, profile } = useAuth();
  const { isOwner } = useRole();

  useEffect(() => {
    // As duas chaves na MESMA consulta: `pause_reason` precisa ser guardada
    // enquanto ainda há banco, porque quando ele cair não dá pra lê-la mais
    // (ver `lib/pauseReason.js`). Ler junto não custa requisição extra.
    supabase.from('site_config').select('key, value').in('key', ['maintenance_mode', 'pause_reason'])
      .then(({ data }) => {
        const porChave = Object.fromEntries((data || []).map(r => [r.key, r.value]));
        setMaintenance(porChave.maintenance_mode === 'true');
        guardarMotivoDaPausa(porChave.pause_reason);
        setConfigLoaded(true);
      });

    const ch = supabase.channel('layout_maint')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_config' }, payload => {
        if (payload.new?.key === 'maintenance_mode') {
          setMaintenance(payload.new.value === 'true');
        }
      }).subscribe();

    return () => supabase.removeChannel(ch);
  }, []);

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
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:ml-60 flex flex-col min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 pt-20 pb-8 px-4 md:px-6 max-w-6xl w-full mx-auto">
          <GlobalBanner />
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
  // Sem banco o feed não tem o que mostrar — ele é consulta pura. A landing é
  // estática e continua de pé, então é ela que atende a raiz até o banco voltar.
  if (user && !semBanco) return <Layout><Home /></Layout>;
  return (
    <Suspense fallback={<SplashScreen />}>
      <Landing />
    </Suspense>
  );
}

// Splash enquanto a sessão resolve — evita flash de Landing↔Home/guard.
function AppRoutes() {
  const { loading } = useAuth();
  const semBanco = useDbOffline();

  // Sem banco, o `loading` da sessão nunca termina — sem esta saída a pessoa
  // ficaria no splash para sempre. Mas o app NÃO é sequestrado: as rotas
  // continuam montadas, e quem barra o que depende do banco é o `RequireAuth`.
  if (loading && !semBanco) return <SplashScreen />;

  return (
    <>
      {semBanco && <AvisoSemBanco />}
      <RolagemDeRota />
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
        <AppRoutes />
        <SpeedInsights />
        <Analytics />
      </AuthProvider>
      </QueryClientProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
