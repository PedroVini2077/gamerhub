import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Zap, ArrowLeft } from 'lucide-react';
import { calcAge, MIN_SIGNUP_AGE } from '../lib/date';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import RegisterSuccess from '../components/auth/RegisterSuccess';
import ForgotForm from '../components/auth/ForgotForm';
import LoginSemBanco from '../components/auth/LoginSemBanco';
import ArenaDeEntrada from '../components/auth/ArenaDeEntrada';
import { isLoginBlocked } from '../lib/loginBlock';
import { useDbOffline } from '../hooks/useDbOffline';

/**
 * A frase abaixo do logo, por modo.
 *
 * Lista fechada: se um modo novo aparecer sem frase, a linha some — e some é
 * visível. O `else` que herdasse a frase do login seria fallback silencioso
 * (§4), a família de bug que este projeto mais registrou.
 */
const LINHA_DO_MODO = {
  login:    'Sua base de operações gamer',
  register: '// Escolha seu personagem',
  forgot:   '// Recuperar acesso',
};

export default function Login() {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  // Login e cadastro passam pelo servidor de autenticação, que cai junto com o
  // resto do projeto. Ver `LoginSemBanco` para o porquê de explicar em vez de
  // deixar tentar.
  const semBanco = useDbOffline();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername]             = useState('');
  const [birthDate, setBirthDate]           = useState('');
  const [uf, setUf]                         = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  // `[02/09]` O aceite dos documentos. A caixinha é como a pessoa expressa a
  // escolha; a PROVA é a linha em `policy_acceptances`, gravada no `signUp`.
  const [aceitouDocumentos, setAceitouDocumentos] = useState(false);
  const [loading, setLoading]               = useState(false);
  const [block, setBlock]                   = useState(null); // { permanent, blocked_until } | null
  const [registeredEmail, setRegisteredEmail] = useState(null); // email pendente de confirmação (mostra tela "verifique seu email")

  const isBlocked = isLoginBlocked(block);

  // Enquanto bloqueado, consulta o servidor periodicamente para refletir
  // desbloqueio feito pelo admin sem precisar recarregar a página.
  useEffect(() => {
    if (!isBlocked || !email.trim()) return;
    const t = setInterval(async () => {
      const { data } = await supabase.rpc('check_login_status', { p_email: email.trim() });
      if (!data?.blocked) setBlock(null);
      else setBlock({ permanent: data.permanent, blocked_until: data.blocked_until });
    }, 8000);
    return () => clearInterval(t);
  }, [isBlocked, email]);

  function switchMode(m) {
    setMode(m);
    setConfirmPassword('');
    setBirthDate('');
    setUf('');
    setSelectedPlatform('');
    setRegisteredEmail(null);
  }

  async function handleSubmit() {
    if (!email) { toast.error('Preencha seu email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error('Informe um email válido'); return; }
    if (mode !== 'forgot' && !password) { toast.error('Preencha sua senha'); return; }
    if (mode === 'register' && !username) { toast.error('Escolha um username'); return; }

    setLoading(true);

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/auth/confirm',
      });
      if (error) toast.error(error.message);
      else { toast.success('Link de recuperação enviado! Verifique seu email.'); switchMode('login'); }
      setLoading(false);
      return;
    }

    if (mode === 'login') {
      // A tentativa de login vem PRIMEIRO, de propósito, e desde 28/08 quem
      // conta a falha é o BANCO, não esta tela.
      //
      // Antes existia um `register_login_attempt` que o frontend chamava para
      // reportar a própria falha. Duas coisas estavam erradas nisso, as duas
      // medidas: quem ataca não usa nosso frontend, então força bruta real não
      // era contada; e a RPC era chamável por anônimo, então bastava um script
      // chamar com o email da vítima para fabricar alerta de segurança e
      // marcar a conta como bloqueada, sem nunca saber a senha.
      //
      // Agora o Password Verification Hook do Supabase avisa o banco a cada
      // verificação de senha, com o veredicto do próprio GoTrue. Aqui a tela só
      // LÊ o resultado — `check_login_status` é leitura pura. Nada que esta
      // página faça consegue mover o contador.
      const { error, banned } = await signInWithEmail(email, password);
      if (banned) {
        // Sem toast: o `useAuth` já subiu a `BannedScreen`, que mostra o motivo,
        // o estado do pedido de revisão e o formulário para abrir um. Um toast
        // por cima seria a versão pior da mesma informação.
        setLoading(false);
        return;
      }
      if (error) {
        const { data: after } = await supabase.rpc('check_login_status', { p_email: email.trim() });
        if (after?.blocked) {
          setBlock({ permanent: after.permanent, blocked_until: after.blocked_until });
          toast.error(after.permanent
            ? 'Conta bloqueada por excesso de tentativas. Contate o suporte ou redefina sua senha.'
            : 'Muitas tentativas falhas. Conta bloqueada por 15 minutos.');
        } else {
          // Sem contagem de tentativa aqui, e isso é honestidade, não falta.
          //
          // Existia um "(N tentativas até o bloqueio)" nesta mensagem. Ele parou
          // de ser verdade em 28/08, quando a contagem forjável foi removida:
          // `attempts` passou a ser sempre 0, então o aviso dizia "5 tentativas"
          // para sempre, sem nunca descer. Contador que não conta é pior que
          // contador nenhum — manda a pessoa confiar num número inventado.
          //
          // Contar de verdade exigiria o Password Verification Hook, que é
          // exclusivo do plano Team (ver BACKLOG.md). Enquanto isso, quem
          // protege contra força bruta é o rate limit do próprio GoTrue, que é
          // server-side e não precisa desta tela para nada.
          toast.error(error.message);
        }
      } else {
        // await obrigatório: o builder do supabase-js é lazy — sem await o reset nunca é enviado.
        await supabase.rpc('reset_login_attempts');
        setBlock(null);
        navigate('/');
      }
    }

    if (mode === 'register') {
      if (password.length < 8) { toast.error('Senha precisa ter pelo menos 8 caracteres'); setLoading(false); return; }
      if (password !== confirmPassword) { toast.error('Senhas não coincidem'); setLoading(false); return; }
      if (!birthDate) { toast.error('Informe sua data de nascimento'); setLoading(false); return; }
      const age = calcAge(birthDate);
      if (age < MIN_SIGNUP_AGE) { toast.error(`Você precisa ter pelo menos ${MIN_SIGNUP_AGE} anos para se cadastrar`); setLoading(false); return; }
      // O botão já fica desabilitado sem o aceite; esta checagem existe porque
      // `disabled` é enfeite de tela — a tecla Enter e a REST API não passam
      // por ele. Regra que só existe no cliente não vale nada (§1.3), e a que
      // vale de verdade é a RLS: só `auth.uid()` grava o próprio aceite.
      if (!aceitouDocumentos) {
        toast.error('É preciso aceitar os documentos para criar a conta');
        setLoading(false); return;
      }

      const extraFields = {};
      if (birthDate)        extraFields.birth_date = birthDate;
      if (uf)               extraFields.state = uf;
      if (selectedPlatform) extraFields.platform = selectedPlatform;

      const { error } = await signUpWithEmail(email, password, username, extraFields);
      if (error) toast.error(error.message);
      else setRegisteredEmail(email.trim());
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* `[04/09]` O fundo. Fica FORA do `max-w-md` e é `fixed`, então o
          formulário de cadastro — bem mais alto que o de login — rola por cima
          sem esticar nada. Ele recebe o modo porque a composição muda: no login
          a fenda fica no meio (duelo), no cadastro ela sai do eixo e um lado
          domina (escolha de personagem). Ver `ArenaDeEntrada`. */}
      <ArenaDeEntrada modo={mode} />
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-neon-green transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Voltar para a página inicial
        </Link>
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Zap size={28} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 10px #39ff14)' }} />
            <span className="font-display font-bold text-3xl text-neon-green tracking-wider">GAMER</span>
            <span className="font-display font-bold text-3xl text-white tracking-wider">HUB</span>
          </div>
          {/* `[04/09]` A linha muda com o modo, e é o "character selected" que o
              dono descreveu — em palavra, não em arte licenciada. No celular o
              formulário de cadastro cobre quase a tela inteira e a arena mal
              aparece; é aqui, no topo, que o cadastro ganha identidade própria.

              Mapa EXPLÍCITO e não `mode === 'register' ? ... : ...`: modo novo
              sem frase aparece como `undefined` em vez de herdar a errada (§4). */}
          <p className="text-gray-500 font-mono text-xs">
            {LINHA_DO_MODO[mode]}
          </p>
        </div>

        <div className="card p-7">
          {semBanco && <LoginSemBanco />}
          {!semBanco && mode === 'login' && (
            <LoginForm
              email={email} setEmail={setEmail}
              password={password} setPassword={setPassword}
              loading={loading} block={block} setBlock={setBlock}
              onSubmit={handleSubmit}
              onForgot={() => switchMode('forgot')}
              onSwitchToRegister={() => switchMode('register')}
            />
          )}
          {!semBanco && mode === 'register' && (
            registeredEmail ? (
              <RegisterSuccess email={registeredEmail} onBackToLogin={() => switchMode('login')} />
            ) : (
              <RegisterForm
                email={email} setEmail={setEmail}
                password={password} setPassword={setPassword}
                confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
                username={username} setUsername={setUsername}
                birthDate={birthDate} setBirthDate={setBirthDate}
                aceitouDocumentos={aceitouDocumentos} setAceitouDocumentos={setAceitouDocumentos}
                uf={uf} setUf={setUf}
                selectedPlatform={selectedPlatform} setSelectedPlatform={setSelectedPlatform}
                loading={loading}
                onSubmit={handleSubmit}
                onSwitchToLogin={() => switchMode('login')}
              />
            )
          )}
          {!semBanco && mode === 'forgot' && (
            <ForgotForm
              email={email} setEmail={setEmail}
              loading={loading}
              onSubmit={handleSubmit}
              onBack={() => switchMode('login')}
            />
          )}
        </div>

        <p className="text-center text-xs text-gray-600 font-mono mt-4">
          // GamerHub v1.0 — Powered by Supabase
        </p>
      </div>
    </div>
  );
}
