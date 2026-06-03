import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Zap, CheckCircle, XCircle, Loader } from 'lucide-react';

export default function AuthConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    const redirectTo = searchParams.get('redirect_to');

    if (!token_hash) {
      setStatus('error');
      setMessage('Link inválido ou expirado.');
      return;
    }

    async function verify() {
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type || 'signup',
      });

      if (error) {
        setStatus('error');
        setMessage(error.message.includes('expired')
          ? 'Este link expirou. Solicite um novo email de verificação.'
          : 'Link inválido ou já utilizado.');
      } else {
        setStatus('success');
        setTimeout(() => {
          navigate(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/');
        }, 2000);
      }
    }

    verify();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Zap size={28} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 10px #39ff14)' }} />
          <span className="font-display font-bold text-3xl text-neon-green tracking-wider">GAMER</span>
          <span className="font-display font-bold text-3xl text-white tracking-wider">HUB</span>
        </div>

        <div className="card p-8">
          {status === 'loading' && (
            <>
              <Loader size={40} className="text-neon-green mx-auto mb-4 animate-spin" />
              <p className="text-white font-display text-sm tracking-widest uppercase">Verificando...</p>
              <p className="text-gray-500 font-mono text-xs mt-2">Aguarde um momento</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle size={40} className="text-neon-green mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 8px #39ff14)' }} />
              <p className="text-white font-display text-sm tracking-widest uppercase mb-2">Email Confirmado!</p>
              <p className="text-gray-400 font-mono text-xs">Sua conta foi ativada. Redirecionando...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle size={40} className="text-red-400 mx-auto mb-4" />
              <p className="text-white font-display text-sm tracking-widest uppercase mb-2">Erro na Verificação</p>
              <p className="text-gray-400 font-mono text-xs mb-4">{message}</p>
              <button onClick={() => navigate('/login')} className="btn-solid py-2 px-6 text-sm">
                Ir para Login
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 font-mono mt-4">
          // GamerHub v1.0 — Powered by Supabase
        </p>
      </div>
    </div>
  );
}
