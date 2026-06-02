import Lives from './pages/Lives';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import { AuthProvider } from './hooks/useAuth.jsx';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Home from './pages/Home';
import Community from './pages/Community';
import Keys from './pages/Keys';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import UserProfile from './pages/UserProfile';
import NotFound from './pages/NotFound';

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen bg-dark-900 grid-bg scanline-overlay">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:ml-60 flex flex-col min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 pt-20 pb-8 px-4 md:px-6 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#0d0d12', border: '3px solid #39ff14',
            borderRadius: 16, padding: '48px 64px', textAlign: 'center',
            boxShadow: '0 0 60px #39ff1450'
          }}>
            <p style={{ fontSize: 64 }}>🔧</p>
            <p style={{ color: '#39ff14', fontFamily: 'monospace', fontSize: 32, fontWeight: 'bold', marginTop: 16 }}>SITE EM MANUTENÇÃO</p>
            <p style={{ color: '#888', fontFamily: 'monospace', fontSize: 14, marginTop: 8 }}>Voltamos em breve!</p>
          </div>
        </div>
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
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/community" element={<Layout><Community /></Layout>} />
          <Route path="/keys" element={<Layout><Keys /></Layout>} />
          <Route path="/profile" element={<Layout><Profile /></Layout>} />
          <Route path="/u/:username" element={<Layout><UserProfile /></Layout>} />
          <Route path="/settings" element={<Layout><Settings /></Layout>} />
          <Route path="/admin" element={<Layout><Admin /></Layout>} />
          <Route path="*" element={<NotFound />} />
          <Route path="/lives" element={<Layout><Lives /></Layout>} />
          <Route path="/lives/:id" element={<Layout><Lives /></Layout>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
