import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { QueryClientProvider } from '@tanstack/react-query';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { useRole } from './hooks/useRole';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ErrorBoundary from './components/ErrorBoundary';
import GlobalBanner from './components/ui/GlobalBanner';
import FeatureGate from './components/ui/FeatureGate';
import PageTransition from './components/ui/PageTransition';
import SplashScreen from './components/ui/SplashScreen';
import RequireAuth from './components/auth/RequireAuth';
import GuestOnly from './components/auth/GuestOnly';
import { supabase } from './lib/supabase';

// Carregamento imediato — páginas acessadas antes do login
import Landing from './pages/Landing';
import Home from './pages/Home';
import Login from './pages/Login';
import AuthConfirm from './pages/AuthConfirm';
import NotFound from './pages/NotFound';

// Lazy loading — carregam só quando o usuário acessar
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
        <p className="text-4xl">🔧</p>
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
    supabase.from('site_config').select('value').eq('key', 'maintenance_mode').maybeSingle()
      .then(({ data }) => {
        setMaintenance(data?.value === 'true');
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
function HomeOrLanding() {
  const { user } = useAuth();
  return user ? <Layout><Home /></Layout> : <Landing />;
}

// Splash enquanto a sessão resolve — evita flash de Landing↔Home/guard.
function AppRoutes() {
  const { loading } = useAuth();
  if (loading) return <SplashScreen />;

  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/auth/confirm" element={<AuthConfirm />} />
      <Route path="/" element={<HomeOrLanding />} />
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
      </AuthProvider>
      </QueryClientProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
