import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './hooks/useAuth.jsx';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ErrorBoundary from './components/ErrorBoundary';

// Carregamento imediato — páginas acessadas antes do login
import Home from './pages/Home';
import Login from './pages/Login';
import AuthConfirm from './pages/AuthConfirm';
import NotFound from './pages/NotFound';

// Lazy loading — carregam só quando o usuário acessar
const Community = lazy(() => import('./pages/Community'));
const Keys      = lazy(() => import('./pages/Keys'));
const Profile   = lazy(() => import('./pages/Profile'));
const Admin     = lazy(() => import('./pages/Admin'));
const Settings  = lazy(() => import('./pages/Settings'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const Lives     = lazy(() => import('./pages/Lives'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  return (
    <div className="min-h-screen bg-dark-900 grid-bg scanline-overlay">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:ml-60 flex flex-col min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 pt-20 pb-8 px-4 md:px-6 max-w-6xl w-full mx-auto">
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              {children}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
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
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/confirm" element={<AuthConfirm />} />
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/community" element={<Layout><Community /></Layout>} />
          <Route path="/keys" element={<Layout><Keys /></Layout>} />
          <Route path="/profile" element={<Layout><Profile /></Layout>} />
          <Route path="/u/:username" element={<Layout><UserProfile /></Layout>} />
          <Route path="/settings" element={<Layout><Settings /></Layout>} />
          <Route path="/admin" element={<Layout><Admin /></Layout>} />
          <Route path="/lives" element={<Layout><Lives /></Layout>} />
          <Route path="/lives/:id" element={<Layout><Lives /></Layout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
