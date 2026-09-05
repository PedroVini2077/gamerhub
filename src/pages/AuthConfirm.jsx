import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Zap, CheckCircle, XCircle, Loader, Lock } from 'lucide-react';
import { getPasswordStrength, STRENGTH_LABELS, STRENGTH_COLORS } from '../lib/password';
import { marcarEntradaAgora } from '../lib/boasVindas';
import CampoDeSenha from '../components/ui/CampoDeSenha';

export default function AuthConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const token_hash = searchParams.get('token_hash');
    const type       = searchParams.get('type');
    const redirectTo = searchParams.get('redirect_to');

    /**
     * Confirmou o email e a sessão nasceu aqui: isto É uma entrada.
     *
     * ── `[05/09]` O furo que isto fecha ─────────────────────────────────────
     *
     * O `verifyOtp` de `signup` **cria sessão**. Então a pessoa entrava no site
     * pela primeira vez na vida por este caminho — e era o único caminho sem a
     * marca de entrada, porque ela só existia dentro do `signInWithEmail`.
     *
     * Resultado: o momento que mais merecia o portão era exatamente o que nunca
     * o via, e o *"Seja bem-vindo"* de estreia só aparecia no segundo acesso,
     * quando a pessoa já não era novata.
     *
     * A recuperação de senha NÃO passa por aqui de propósito: ela termina em
     * `signOut()` e volta para o login (ver `handleSetPassword`). Trocar senha
     * não é entrar.
     */
    const entrarNoSite = (destino) => {
      marcarEntradaAgora();
      navigate(destino);
    };

    // ── Formato 1: token_hash na query string (link direto para o app) ──
    if (token_hash) {
      supabase.auth.verifyOtp({ token_hash, type: type || 'signup' }).then(({ error }) => {
        if (error) {
          setStatus('error');
          setMessage(
            type === 'recovery'
              ? 'Este link expirou ou já foi utilizado. Solicite um novo link de redefinição.'
              : 'Este link expirou. Solicite um novo email de verificação.'
          );
        } else if (type === 'recovery') {
          setStatus('set_password');
        } else {
          setStatus('success');
          setTimeout(() => entrarNoSite(redirectTo?.startsWith('/') ? redirectTo : '/'), 2000);
        }
      });
      return;
    }

    // ── Formato 2: tokens no hash fragment (#access_token=...&type=recovery) ──
    // supabase-js detecta automaticamente e dispara eventos de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('set_password');
      } else if (event === 'SIGNED_IN' && session) {
        const hash = window.location.hash;
        if (hash.includes('type=recovery')) {
          setStatus('set_password');
        } else {
          setStatus('success');
          setTimeout(() => entrarNoSite('/'), 2000);
        }
      } else if (event === 'INITIAL_SESSION' && !session) {
        setStatus('error');
        setMessage('Link inválido ou expirado.');
      }
    });

    // Verifica se supabase-js já processou o hash antes do listener ser registrado
    supabase.auth.getSession().then(({ data: { session } }) => {
      const hash = window.location.hash;
      if (session) {
        if (hash.includes('type=recovery')) {
          setStatus('set_password');
        } else {
          setStatus('success');
          setTimeout(() => entrarNoSite('/'), 2000);
        }
      } else if (!hash.includes('access_token') && !hash.includes('error=')) {
        // Sem token na query nem no hash
        setStatus('error');
        setMessage('Link inválido ou expirado.');
      }
      // se tem access_token no hash mas ainda sem sessão, aguarda o onAuthStateChange
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSetPassword() {
    setSaveError('');
    if (newPassword.length < 8) { setSaveError('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setSaveError('As senhas não coincidem.'); return; }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setSaveError(error.message); setSaving(false); return; }
    await supabase.auth.signOut();
    setStatus('success_reset');
    setTimeout(() => navigate('/login'), 3000);
  }

  const strength = getPasswordStrength(newPassword);

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

          {status === 'success_reset' && (
            <>
              <CheckCircle size={40} className="text-neon-green mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 8px #39ff14)' }} />
              <p className="text-white font-display text-sm tracking-widest uppercase mb-2">Senha Redefinida!</p>
              <p className="text-gray-400 font-mono text-xs">Faça login com sua nova senha. Redirecionando...</p>
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

          {status === 'set_password' && (
            <>
              <Lock size={36} className="text-neon-green mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 8px #39ff1460)' }} />
              <p className="text-white font-display text-sm tracking-widest uppercase mb-1">Nova Senha</p>
              <p className="text-gray-500 font-mono text-xs mb-5">Escolha uma senha segura para sua conta.</p>

              <div className="space-y-3 text-left">
                <div>
                  <CampoDeSenha
                    rotulo="Nova Senha" autoComplete="new-password"
                    valor={newPassword} aoMudar={setNewPassword}
                  />
                  {newPassword && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex gap-1 flex-1">
                        {[1,2,3,4].map(n => (
                          <div key={n} className="h-1 flex-1 rounded-full transition-all duration-300"
                            style={{ background: n <= strength ? STRENGTH_COLORS[strength] : '#2e2e3e' }} />
                        ))}
                      </div>
                      <span className="text-xs font-mono w-16 text-right"
                        style={{ color: STRENGTH_COLORS[strength] || '#6b7280' }}>
                        {STRENGTH_LABELS[strength]}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-gray-600 font-mono mt-1">mínimo 8 caracteres</p>
                </div>

                <div>
                  <CampoDeSenha
                    rotulo="Confirmar Senha" autoComplete="new-password"
                    valor={confirmPassword} aoMudar={setConfirmPassword}
                    erro={Boolean(confirmPassword) && confirmPassword !== newPassword}
                  />
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-xs text-red-400 font-mono mt-1">Senhas não coincidem</p>
                  )}
                </div>

                {saveError && <p className="text-xs text-red-400 font-mono">{saveError}</p>}

                <button onClick={handleSetPassword} disabled={saving}
                  className="btn-solid w-full py-3 mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? 'Salvando...' : '// SALVAR NOVA SENHA'}
                </button>
              </div>
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
