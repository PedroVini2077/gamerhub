import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { marcarEntradaAgora, cancelarEntradaAgora } from '../lib/boasVindas';
import { logAudit } from '../lib/auditLog';
import { useVigiaDeBanimento } from './useVigiaDeBanimento';
import { usePresenca } from './usePresenca';
import { criarConta } from '../services/cadastroService';
import BannedScreen from '../components/ui/BannedScreen';

const AuthContext = createContext(null);


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
  // `useCallback` com dependências vazias, e isto NÃO é estilo: `fetchProfile` e
  // `applyBannedCheck` alimentam o `revalidar` que vai para o
  // `useVigiaDeBanimento`, e esse callback entra nas dependências de um efeito
  // que abre canal de realtime. Recriado a cada render, ele derrubaria e
  // reabriria o canal sem parar. Os dois só usam setters de estado, que o React
  // garante estáveis — então a lista vazia é honesta, não uma supressão.
  const fetchProfile = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_own_profile');
    // Só atualiza o profile em caso de sucesso — erros temporários (rede, refresh de token)
    // não devem apagar o profile existente e quebrar a UI
    if (!error) setProfile(data);
    return data ?? null;
  }, []);

  // Mostra a tela de banido a partir de uma checagem EXPLÍCITA (carga inicial,
  // realtime ou poll). Não é um effect reativo sobre profile.banned de propósito:
  // durante o login de uma conta banida há uma sessão transitória que setaria
  // profile.banned por um instante antes do signOut — isso faria a tela piscar
  // na página de login. As checagens explícitas evitam esse falso-positivo.
  const applyBannedCheck = useCallback((p) => {
    if (p?.banned) {
      setBannedScreen({
        reason: p.ban_reason || 'Violação dos termos de uso',
        details: p.ban_details || null,
      });
    }
  }, []);

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
  }, [fetchProfile, applyBannedCheck]);

  // Relê o perfil e decide se a tela de banido sobe. É o único ponto de
  // contato entre o estado daqui e o vigia — ele não devolve nada, só avisa.
  const revalidar = useCallback(async () => {
    applyBannedCheck(await fetchProfile());
  }, [fetchProfile, applyBannedCheck]);

  useVigiaDeBanimento(user?.id, revalidar);
  const onlineCount = usePresenca(user?.id);

  async function signInWithEmail(email, password) {
    if (!email?.trim() || !password) {
      return { error: { message: 'Preencha email e senha.' } };
    }

    // `[05/09]` A marca vai ANTES da chamada, e a ordem é o conserto.
    //
    // O `onAuthStateChange` preenche o `user` lá dentro, antes de esta promessa
    // voltar — então o site troca de rota e pinta enquanto ainda faltam duas
    // idas ao servidor daqui. Marcando depois, o portão subia atrasado por esse
    // tempo todo, que foi o que o dono viu. Todo caminho que NÃO termina em
    // entrada desfaz a marca abaixo. Ver `lib/boasVindas.js`.
    marcarEntradaAgora();

    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (!result.data?.user) {
      // Senha errada, rede caindo, conta inexistente: não houve entrada, então
      // a marca não pode sobrar esperando o próximo `user` da aba.
      cancelarEntradaAgora();
    } else {
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
        // Quem foi barrado não é recebido com festa: a marca escrita antes da
        // chamada é desfeita aqui, senão o portão abriria por cima da tela de
        // ban — que é exatamente o que ela não pode deixar acontecer.
        cancelarEntradaAgora();
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

  // O cadastro mora em `services/cadastroService.js` desde 03/09 — ver o
  // cabeçalho de lá. O `useAuth` cuida de SESSÃO; criar conta acontece antes de
  // existir sessão, e é outro assunto.
  const signUpWithEmail = criarConta;

  /**
   * O "Sair" do cabeçalho — e ele encerra a sessão **deste aparelho só**.
   *
   * ── `[05/09]` Era GLOBAL, e a decisão do dono mudou isso ────────────────────
   *
   * O padrão do `supabase-js` é `scope: 'global'`: ele revoga **todos** os
   * refresh tokens da conta, então sair no celular derrubava o PC junto. Estava
   * escrito aqui como intencional — *"o certo inclusive em aparelho
   * compartilhado"* — e o dono desmontou o argumento:
   *
   * > *"não faz sentido, a não ser que tenha uma aba pra identificar
   * > dispositivos conectados, tipo Instagram… como no nosso site não tem nada
   * > disso, não faz sentido eu deslogar no celular e sair no PC"*.
   *
   * **Ele está certo, e o motivo é que a proteção era CEGA.** Derrubar todas as
   * sessões só protege quem sabe que existe uma sessão indevida — e é
   * exatamente isso que este site não tem como contar a ninguém: não há tela de
   * aparelhos conectados, não há região, não há "sessão iniciada agora em X".
   * Sem essa informação, o botão nunca foi usado para expulsar um invasor;
   * ele só derrubava a própria pessoa no outro aparelho.
   *
   * ── O que se perde, dito com todas as letras ───────────────────────────────
   *
   * Quem usar o site num computador emprestado e sair **naquele** computador
   * continua protegido: o token daquele navegador é apagado. O que deixa de
   * acontecer é o caso "esqueci a sessão aberta em outro lugar e quero matar
   * todas de longe" — e para esse caso a resposta certa é **trocar a senha**,
   * que revoga tudo no servidor, ou a tela de aparelhos conectados, que está
   * registrada em `docs/VISAO-DE-FUTURO.md` como a forma de fazer isto direito.
   *
   * A trava é `logoutEhLocal.test.js`: sem ela, a próxima pessoa que "limpar" o
   * `{ scope }` daqui devolve o comportamento sem nada acusar — logout que
   * derruba o outro aparelho é silencioso do lado de quem fica (§1.5).
   */
  async function signOut() {
    if (profile?.username) {
      logAudit('auth_logout', `@${profile.username} fez logout`, { category: 'auth' });
    }
    await supabase.auth.signOut({ scope: 'local' });
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
    // `[05/09]` Esta função e o `signOut()` comum passaram a usar o MESMO
    // escopo, por caminhos diferentes: aqui era por velocidade (medida acima),
    // lá virou decisão de produto do dono. O parágrafo que dizia *"o `signOut()`
    // comum continua global"* deixou de ser verdade — ver o cabeçalho dele.
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
