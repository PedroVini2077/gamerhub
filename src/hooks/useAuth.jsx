import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';
import BannedScreen from '../components/ui/BannedScreen';

const AuthContext = createContext(null);

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 8;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bannedScreen, setBannedScreen] = useState(null);

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    // Só atualiza o profile em caso de sucesso — erros temporários (rede, refresh de token)
    // não devem apagar o profile existente e quebrar a UI
    if (!error) setProfile(data);
    return data ?? null;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Detecta ban em tempo real enquanto o usuário está logado.
  // Caminho instantâneo: subscription realtime no próprio profile.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-ban-watch-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        if (payload.new?.banned) {
          setBannedScreen({
            reason: payload.new.ban_reason || 'Violação dos termos de uso',
            details: payload.new.ban_details || null,
          });
        }
      })
      .subscribe();

    // Fallback confiável: revalida o profile a cada 20s. Se o realtime perder o
    // evento (timing da subscription, reconexão), o ban ainda é capturado aqui.
    const poll = setInterval(() => fetchProfile(user.id), 20000);

    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [user?.id]);

  // Sempre que o profile indicar banimento (via realtime, poll ou refresh), mostra a tela.
  useEffect(() => {
    if (profile?.banned) {
      setBannedScreen({
        reason: profile.ban_reason || 'Violação dos termos de uso',
        details: profile.ban_details || null,
      });
    }
  }, [profile?.banned, profile?.ban_reason, profile?.ban_details]);

  async function signInWithEmail(email, password) {
    if (!email?.trim() || !password) {
      return { error: { message: 'Preencha email e senha.' } };
    }

    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (result.data?.user) {
      const p = await fetchProfile(result.data.user.id);
      if (p?.banned) {
        await supabase.auth.signOut();
        logAudit('auth_banned_attempt',
          `Tentativa de login de conta banida (@${p.username || email.trim()})`,
          { category: 'security', severity: 'warning', metadata: { email: email.trim() } }
        );
        return { error: { message: 'Sua conta foi banida. Entre em contato com o suporte.' } };
      }
      logAudit('auth_login_success',
        `@${p?.username || email.trim()} fez login`,
        { category: 'auth', severity: 'info', metadata: { email: email.trim() } }
      );
    }

    return result;
  }

  async function signUpWithEmail(email, password, username, extraFields = {}) {
    if (!email?.trim()) {
      return { error: { message: 'Informe um email válido.' } };
    }
    if (!USERNAME_REGEX.test(username)) {
      return { error: { message: 'Username: 3-20 caracteres, apenas letras minúsculas, números e _' } };
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { error: { message: `Senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` } };
    }

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      return { error: { message: 'Este username já está em uso. Escolha outro.' } };
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username } },
    });
    if (error) return { error };

    // Salva campos extras (birth_date, state, platform) — o trigger já criou o perfil
    if (data?.user?.id) {
      const allowed = ['birth_date', 'state', 'platform'];
      const updates = Object.fromEntries(
        Object.entries(extraFields).filter(([k, v]) => allowed.includes(k) && v)
      );
      if (Object.keys(updates).length > 0) {
        await supabase.from('profiles').update(updates).eq('id', data.user.id);
      }
    }

    return { data };
  }

  async function signOut() {
    if (profile?.username) {
      logAudit('auth_logout', `@${profile.username} fez logout`, { category: 'auth' });
    }
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  // Logout do usuário banido: encerra a sessão e força ida pro login com a página recarregada,
  // garantindo que o overlay suma e o estado fique limpo independente de qualquer race.
  async function signOutBanned() {
    try { await signOut(); } catch { /* ignora — o redirect abaixo garante o estado limpo */ }
    window.location.replace('/login');
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithEmail, signUpWithEmail, signOut, refreshProfile }}>
      {bannedScreen && (
        <BannedScreen
          reason={bannedScreen.reason}
          details={bannedScreen.details}
          onSignOut={signOutBanned}
        />
      )}
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
