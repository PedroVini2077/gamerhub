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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
