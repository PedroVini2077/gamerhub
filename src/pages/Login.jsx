import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Zap, Mail, Lock, User } from 'lucide-react';

export default function Login() {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password) { toast.error('Preencha email e senha'); return; }
    if (mode === 'register' && !username) { toast.error('Escolha um username'); return; }
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signInWithEmail(email, password);
      if (error) toast.error(error.message);
      else { toast.success('Bem-vindo de volta! 🎮'); navigate('/'); }
    } else {
      const { error } = await signUpWithEmail(email, password, username);
      if (error) toast.error(error.message);
      else { toast.success('Conta criada! Verifique seu email 📧'); }
    }
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleSubmit();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Zap size={28} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 10px #39ff14)' }} />
            <span className="font-display font-bold text-3xl text-neon-green tracking-wider">GAMER</span>
            <span className="font-display font-bold text-3xl text-white tracking-wider">HUB</span>
          </div>
          <p className="text-gray-500 font-mono text-xs">Sua base de operações gamer</p>
        </div>

        <div className="card p-7">
          <div className="flex border border-dark-400 rounded overflow-hidden mb-6">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2.5 text-xs font-display tracking-widest uppercase transition-all ${
                  mode === m ? 'bg-neon-green/10 text-neon-green' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {m === 'login' ? 'Entrar' : 'Registrar'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Username</label>
                <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
                  <span className="pl-3 pr-2 text-gray-500 shrink-0"><User size={14} /></span>
                  <input
                    className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
                    placeholder="seu_nick_aqui"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                    onKeyDown={handleKey}
                    maxLength={20}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Email</label>
              <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
                <span className="pl-3 pr-2 text-gray-500 shrink-0"><Mail size={14} /></span>
                <input
                  className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
                  type="email"
                  placeholder="gamer@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={handleKey}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Senha</label>
              <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
                <span className="pl-3 pr-2 text-gray-500 shrink-0"><Lock size={14} /></span>
                <input
                  className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKey}
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-solid w-full py-3 mt-2"
            >
              {loading ? 'Aguarde...' : mode === 'login' ? '// ENTRAR' : '// CRIAR CONTA'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 font-mono mt-4">
          // GamerHub v1.0 — Powered by Supabase
        </p>
      </div>
    </div>
  );
}
