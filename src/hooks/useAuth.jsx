import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';

const AuthContext = createContext(null);

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 8;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
    return data;
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

  async function signInWithEmail(email, password) {
    if (!email?.trim() || !password) {
      return { error: { message: 'Preencha email e senha.' } };
    }

    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    // Registrar falha no servidor IMEDIATAMENTE após o retorno do signInWithPassword,
    // antes de qualquer mudança de estado de auth que bloquearia o rpc() subsequente.
    if (result.error) {
      supabase.rpc('record_login_failure', { p_email: email.trim() });
    }

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

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithEmail, signUpWithEmail, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
