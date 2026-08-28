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

  // Via RPC, não `select('*')`: as colunas sensíveis de `profiles`
  // (birth_date, ban_reason, notif_*, …) foram revogadas de `authenticated`,
  // porque privilégio de coluna é por PAPEL e não distingue "minha linha" da
  // "linha alheia" — sem isso, qualquer usuário logado lia o histórico de
  // moderação e a data de nascimento de todo mundo. `get_own_profile()` é
  // SECURITY DEFINER e devolve só a linha de auth.uid().
  async function fetchProfile() {
    const { data, error } = await supabase.rpc('get_own_profile');
    // Só atualiza o profile em caso de sucesso — erros temporários (rede, refresh de token)
    // não devem apagar o profile existente e quebrar a UI
    if (!error) setProfile(data);
    return data ?? null;
  }

  // Mostra a tela de banido a partir de uma checagem EXPLÍCITA (carga inicial,
  // realtime ou poll). Não é um effect reativo sobre profile.banned de propósito:
  // durante o login de uma conta banida há uma sessão transitória que setaria
  // profile.banned por um instante antes do signOut — isso faria a tela piscar
  // na página de login. As checagens explícitas evitam esse falso-positivo.
  function applyBannedCheck(p) {
    if (p?.banned) {
      setBannedScreen({
        reason: p.ban_reason || 'Violação dos termos de uso',
        details: p.ban_details || null,
      });
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const p = await fetchProfile();
        applyBannedCheck(p); // usuário que recarrega a página já banido cai na tela
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // Não checa ban aqui: o SIGNED_IN do login de uma conta banida é transitório.
      if (session?.user) fetchProfile();
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Detecta ban em tempo real enquanto o usuário está logado.
  // Caminho instantâneo: subscription realtime no próprio profile.
  useEffect(() => {
    if (!user?.id) return;
    async function revalidate() {
      applyBannedCheck(await fetchProfile());
    }

    const channel = supabase
      .channel(`profile-ban-watch-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        // Usa o evento só como GATILHO e relê pela RPC, em vez de confiar nas
        // colunas do payload: `ban_reason`/`ban_details` não são mais legíveis
        // direto na tabela por `authenticated`.
        //
        // Medido em 23/08 (o comentário anterior dizia que isto era
        // desconhecido): o Realtime **respeita privilégio de coluna**. O
        // payload chega só com o que `authenticated` pode ler — sem
        // `birth_date`, `suspended_until`, `ban_reason` nem `email`. Ou seja,
        // `payload.new.banned` é confiável.
        //
        // Ainda assim relemos pela RPC, agora por outro motivo: o ban precisa
        // de `ban_reason` para a tela do banido, e isso o payload não traz.
        // Reler é o caminho que já funciona nos dois casos.
        if (payload.new?.banned) revalidate();
      })
      .subscribe();

    // Fallback confiável pra quando o realtime perder o evento (timing da
    // subscription, reconexão). Antes rodava a cada 20s SEMPRE — um SELECT por
    // usuário logado a cada 20s, inclusive com a aba em segundo plano e sem
    // ninguém olhando. Agora: 60s e só com a aba visível, mais uma revalidação
    // no momento em que a aba volta ao foco (que é justamente quando o usuário
    // poderia agir sem saber que foi banido).
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') revalidate();
    }, 60000);

    function onVisible() {
      if (document.visibilityState === 'visible') revalidate();
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.id]);

  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel('gamerhub-presence');
    ch.on('presence', { event: 'sync' }, () => {
      setOnlineCount(Object.keys(ch.presenceState()).length);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ user_id: user.id });
      }
    });
    return () => supabase.removeChannel(ch);
  }, [user?.id]);

  async function signInWithEmail(email, password) {
    if (!email?.trim() || !password) {
      return { error: { message: 'Preencha email e senha.' } };
    }

    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (result.data?.user) {
      // Checagem de ban via query direta (sem setProfile) para não poluir o estado
      // global durante o handshake de uma conta banida que será deslogada em seguida.
      // Mesma RPC: a sessão já existe neste ponto (a senha foi aceita), então
      // `get_own_profile()` devolve a linha certa — inclusive ban_reason, que
      // não é mais legível direto na tabela.
      const { data: p } = await supabase.rpc('get_own_profile');
      if (p?.banned) {
        // Registra a tentativa (log + notificação aos admins) enquanto há sessão.
        await supabase.rpc('record_banned_login_attempt', { p_email: email.trim() });

        // A SESSÃO CONTINUA VIVA DE PROPÓSITO, e isso mudou em 28/08.
        //
        // Antes vinha um `signOut()` aqui e o `Login.jsx` mostrava um toast
        // genérico. Dois problemas, os dois relatados pelo dono testando:
        //
        //  1. O formulário de recurso (que subiu no mesmo dia) NUNCA aparecia
        //     no login — a `BannedScreen` só montava quando o ban era detectado
        //     numa sessão já aberta. Quem fechasse a aba ficava sem recorrer.
        //  2. Entre o `signInWithPassword` e o `signOut`, o `onAuthStateChange`
        //     já tinha disparado: a pessoa via o site por alguns segundos antes
        //     de ser jogada para fora.
        //
        // Agora a tela sobe na hora, cobrindo tudo (`z-[9999]`), e o `signOut`
        // acontece quando ELA termina — pelo botão, ou pelo contador. Manter a
        // sessão é o que torna o recurso possível: `solicitar_revisao_do_
        // proprio_ban` exige `authenticated`, e sem sessão não haveria como
        // pedir revisão nenhuma.
        //
        // Segurança: banido com sessão não cria nada. As policies de INSERT
        // checam `banned` no banco, então o bloqueio não depende desta tela.
        applyBannedCheck(p);
        // banned:true sinaliza ao Login para NÃO contar como tentativa de senha errada
        return { banned: true, reason: p.ban_reason || null };
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
        const { error: extraErr } = await supabase.from('profiles').update(updates).eq('id', data.user.id);
        if (extraErr) console.warn('[GamerHub] Erro ao salvar campos extras do perfil:', extraErr.message);
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
    if (user) await fetchProfile();
  }

  // Logout do usuário banido: encerra a sessão e força recarregar a página,
  // garantindo que o overlay suma e o estado fique limpo independente de
  // qualquer race.
  //
  // O destino é a LANDING, não o `/login`. Ela é a porta de entrada do site e a
  // única página que não depende do banco — é para onde o `dbHealth` manda todo
  // mundo quando o Supabase cai. Jogar quem acabou de sair direto no formulário
  // de login é um passo a mais sem motivo, e para o banido é pior ainda:
  // sugere tentar de novo o que acabou de ser recusado.
  async function signOutBanned() {
    // `[28/08]` NÃO espera a ida ao servidor, e o motivo está medido.
    //
    // O dono relatou demora ao clicar em "Sair agora". A causa era esta função
    // chamar `signOut()`, que faz `await supabase.auth.signOut()` com o escopo
    // **global** — uma ida ao servidor para revogar os refresh tokens — e só
    // então trocar de página.
    //
    // Medido contra o projeto de produção, 5 chamadas: **0,30 s a 1,08 s** só
    // de ida e volta, e isso a partir de um datacenter com conexão quente. No
    // 4G de um celular é bem pior. A tela ficava parada nesse tempo todo.
    //
    // O escopo **local** limpa a sessão do navegador sem falar com o servidor,
    // então a troca de página é imediata.
    //
    // ── Por que abrir mão da revogação global AQUI é seguro ────────────────
    //
    // O refresh token continua válido até expirar — e não serve para nada. A
    // conta está BANIDA: a RLS nega tudo no banco, e qualquer sessão que
    // reapareça cai na `BannedScreen` de novo pelo `applyBannedCheck`. Além
    // disso é o token da própria pessoa, no aparelho dela: ela poderia
    // simplesmente não clicar em sair e mantê-lo do mesmo jeito.
    //
    // O `signOut()` comum (o botão "Sair" do `Header`) **continua global**, que
    // é o certo para quem não está banido — inclusive em aparelho compartilhado.
    if (profile?.username) {
      logAudit('auth_logout', `@${profile.username} fez logout`, { category: 'auth' });
    }
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* o redirect abaixo garante o estado limpo */ }
    window.location.replace('/');
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, onlineCount, signInWithEmail, signUpWithEmail, signOut, refreshProfile }}>
      {/*
        SUBSTITUI o site, não fica POR CIMA dele. A diferença é o achado do dono
        em 28/08: "a pessoa chega a logar no site, só fica o popup por cima".
        Ele estava certo, e o mecanismo é este — a sessão do banido continua
        viva (é o que permite pedir revisão), então `GuestOnly` tirava a pessoa
        do `/login`, `HomeOrLanding` via `user` e montava o feed inteiro atrás
        do overlay. Um `Escape`, um zoom ou o DevTools bastariam para ler o
        site; e o app inteiro ficava rodando, assinando realtime, buscando post.

        Trocar `&&` por `? :` resolve os dois de uma vez: o feed nunca chega a
        montar. A sessão continua existindo, então o formulário de recurso
        continua funcionando — é a única coisa que precisava dela.

        Consequência: o `Toaster` do App é filho deste provider e some junto.
        Por isso a `BannedScreen` mostra erro na própria tela, sem `toast`.
      */}
      {bannedScreen ? (
        <BannedScreen
          reason={bannedScreen.reason}
          details={bannedScreen.details}
          onSignOut={signOutBanned}
        />
      ) : children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
