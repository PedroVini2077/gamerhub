import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.jsx';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { calcAge, MIN_SIGNUP_AGE } from '../lib/date';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import RegisterSuccess from '../components/auth/RegisterSuccess';
import ForgotForm from '../components/auth/ForgotForm';
import LoginSemBanco from '../components/auth/LoginSemBanco';
import ArenaDeEntrada from '../components/auth/ArenaDeEntrada';
import CardQueAcompanhaAltura from '../components/auth/CardQueAcompanhaAltura';
import { fadeTab } from '../lib/motion';
import { useDbOffline } from '../hooks/useDbOffline';
import { useModoDaEntrada } from '../hooks/useModoDaEntrada';
import { mensagemDeErroDeAuth, ID_DO_TOAST_DE_AUTH } from '../lib/errosDeAuth';
import MarcaGH from '../components/ui/MarcaGH';

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
  // A aba vive na URL (`?modo=cadastro`), e não no estado do React: estado
  // morre na navegação, e foi por isso que voltar dos termos reabria "entrar".
  const [mode, setMode] = useModoDaEntrada();
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
  const [registeredEmail, setRegisteredEmail] = useState(null); // email pendente de confirmação (mostra tela "verifique seu email")


  // Uma chave só para as duas coisas que precisam dela: o `AnimatePresence`
  // (que conteúdo está na tela) e o card (quando animar a altura). Duas
  // expressões separadas divergiriam — e divergir aqui significaria o card
  // animar numa troca em que o conteúdo não trocou, ou o contrário.
  const chaveDoConteudo = `${mode}${registeredEmail ? '-enviado' : ''}`;

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
      if (error) toast.error(mensagemDeErroDeAuth(error), { id: ID_DO_TOAST_DE_AUTH });
      else { toast.success('Link de recuperação enviado! Verifique seu email.'); switchMode('login'); }
      setLoading(false);
      return;
    }

    if (mode === 'login') {
      // `[11/09]` Esta tela NÃO fala mais em bloqueio por tentativas, porque
      // ele nunca chegou a existir de verdade.
      //
      // Em 28/08 a contagem forjável foi removida — era chamável por anônimo, e
      // bastava um script com o e-mail da vítima para trancar a conta dela sem
      // nunca saber a senha. O substituto seria o Password Verification Hook do
      // GoTrue, e ele e exclusivo dos planos pagos: no Free, `login_attempts`
      // nunca recebe uma linha.
      //
      // Por 14 dias esta página consultou, a cada falha, um contador que não
      // podia responder outra coisa senão "não bloqueado" — uma ida ao banco
      // por tentativa, e um reset por login bem-sucedido, os dois sobre uma
      // tabela sempre vazia.
      //
      // Quem protege contra força bruta é o rate limit do próprio GoTrue, que é
      // server-side e não precisa desta tela para nada. Trazer o bloqueio de
      // volta exige ou o plano pago, ou uma RPC de bloqueio MANUAL pela equipe
      // — que é ferramenta de moderação, não proteção automática (BACKLOG.md).
      // A trava `semPromessaDeBloqueio.test.js` guarda esta decisão.
      const { error, banned } = await signInWithEmail(email, password);
      if (banned) {
        // Sem toast: o `useAuth` já subiu a `BannedScreen`, que mostra o motivo,
        // o estado do pedido de revisão e o formulário para abrir um. Um toast
        // por cima seria a versão pior da mesma informação.
        setLoading(false);
        return;
      }
      if (error) {
        toast.error(mensagemDeErroDeAuth(error), { id: ID_DO_TOAST_DE_AUTH });
      } else {
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
      if (error) toast.error(mensagemDeErroDeAuth(error), { id: ID_DO_TOAST_DE_AUTH });
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
          className="arena-chip inline-flex items-center gap-1.5 text-xs font-mono mb-6"
        >
          <ArrowLeft size={14} /> Voltar para a página inicial
        </Link>
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <MarcaGH tamanho={28} />
            <span className="font-display font-bold text-3xl text-neon-green tracking-wider">GAMER</span>
            <span className="font-display font-bold text-3xl text-white tracking-wider">HUB</span>
          </div>
          {/* `[04/09]` A linha muda com o modo, e é o "character selected" que o
              dono descreveu — em palavra, não em arte licenciada. No celular o
              formulário de cadastro cobre quase a tela inteira e a arena mal
              aparece; é aqui, no topo, que o cadastro ganha identidade própria.

              Mapa EXPLÍCITO e não `mode === 'register' ? ... : ...`: modo novo
              sem frase aparece como `undefined` em vez de herdar a errada (§4). */}
          <p className="arena-texto font-mono text-xs">
            {LINHA_DO_MODO[mode]}
          </p>
        </div>

        {/* `[04/09]` A troca de aba passou a ter TRANSIÇÃO.
            Pedido do dono: *"podia fazer uma transição melhor da aba de login e
            cadastro, pq quando fazemos essa troca, simplesmente corta de um pro
            outro"*. Ele está certo — era um corte seco.

            `mode="wait"` e não sobreposição: os dois formulários têm alturas
            muito diferentes, e deixar os dois montados ao mesmo tempo faria o
            card pular de tamanho no meio da animação.

            `initial={false}`: a primeira pintura NÃO anima. O formulário é o que
            a pessoa veio fazer; ele aparece pronto, e quem se apresenta com
            animação é o fundo.

            `fadeTab` é a variante que o resto do site já usa em aba (Admin,
            Owner, ModerationPanel) — mesma linguagem, uma fonte só (§4). */}
        <CardQueAcompanhaAltura className="card p-7" chave={chaveDoConteudo}>
          {semBanco && <LoginSemBanco />}
          {!semBanco && (
            <AnimatePresence mode="wait" initial={false}>
              {/* A chave inclui o `registeredEmail`: sair do formulário para a
                  tela de "confirme seu e-mail" é troca de conteúdo tanto quanto
                  trocar de aba, e sem isso ela apareceria de estalo. */}
              <motion.div
                key={chaveDoConteudo}
                variants={fadeTab} initial="initial" animate="animate" exit="exit"
              >
                {mode === 'login' && (
                  <LoginForm
                    email={email} setEmail={setEmail}
                    password={password} setPassword={setPassword}
                    loading={loading}
                    onSubmit={handleSubmit}
                    onForgot={() => switchMode('forgot')}
                    onSwitchToRegister={() => switchMode('register')}
                  />
                )}
                {mode === 'register' && (
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
                {mode === 'forgot' && (
                  <ForgotForm
                    email={email} setEmail={setEmail}
                    loading={loading}
                    onSubmit={handleSubmit}
                    onBack={() => switchMode('login')}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </CardQueAcompanhaAltura>

        <p className="arena-texto text-center text-xs font-mono mt-4 opacity-80">
          // GamerHub v1.0 — Powered by Supabase
        </p>
      </div>
    </div>
  );
}
