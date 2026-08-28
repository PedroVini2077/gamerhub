import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldOff, LogOut, Send, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { solicitarRevisaoDoProprioBan, meuPedidoDeRevisao } from '../../services/banService';

const MIN_CARACTERES = 20;
const MAX_CARACTERES = 1000;

// A contagem regressiva continua existindo, mas parou de ser uma armadilha.
//
// Antes eram 6 segundos e ponto: a pessoa lia "Conta Banida", tentava entender
// o motivo, e a tela sumia. Não havia o que clicar mesmo — mas agora há, e um
// cronômetro correndo por cima de um formulário seria pior que não ter
// formulário nenhum.
//
// A regra ficou: o relógio só corre enquanto ninguém está fazendo nada. Abriu o
// formulário, ele para. É o mesmo princípio do §0.3 regra 3 aplicado ao
// contrário — toda espera precisa de teto, mas nenhum teto pode atropelar quem
// está no meio de uma ação.
const SEGUNDOS_ATE_SAIR = 20;

export default function BannedScreen({ reason, details, onSignOut }) {
  const [countdown, setCountdown] = useState(SEGUNDOS_ATE_SAIR);
  const [recorrendo, setRecorrendo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // O pedido já aberto, se houver. `undefined` = ainda carregando; `null` = não
  // existe. A distinção importa: mostrar "nenhum pedido" enquanto a consulta
  // ainda corre faria o botão de recorrer piscar para quem já recorreu.
  const [pedido, setPedido] = useState(undefined);
  const firedRef = useRef(false);

  // Sem isto a pessoa recorria e nunca mais sabia de nada — e notificação em
  // tempo real não resolveria, porque a decisão pode sair enquanto ela não está
  // online. Estado consultável no banco não tem esse problema.
  useEffect(() => {
    let vivo = true;
    meuPedidoDeRevisao().then(({ data }) => { if (vivo) setPedido(data?.existe ? data : null); });
    return () => { vivo = false; };
  }, []);

  const doSignOut = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onSignOut();
  }, [onSignOut]);

  // Pausa enquanto a pessoa está escrevendo o recurso, e depois de enviado —
  // ela precisa ler a confirmação antes de a tela sumir.
  // Também pausa enquanto o pedido carrega: a pessoa não pode perder a tela
  // antes de saber se já tem um recurso em andamento.
  const pausado = recorrendo || enviado || pedido === undefined;

  useEffect(() => {
    if (pausado) return undefined;
    if (countdown <= 0) { doSignOut(); return undefined; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, doSignOut, pausado]);

  const faltam = MIN_CARACTERES - motivo.trim().length;

  async function enviar() {
    setEnviando(true);
    const { error } = await solicitarRevisaoDoProprioBan(motivo);
    setEnviando(false);
    if (error) {
      // A mensagem vem do banco em português e já explica o caso (motivo curto,
      // pedido repetido, conta não banida). Repassar é melhor que traduzir para
      // um "erro ao enviar" que não diz o que fazer (§1.5).
      toast.error(error.message);
      return;
    }
    setEnviado(true);
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6 overflow-y-auto"
      style={{ background: 'rgba(6,6,8,0.97)' }}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 rounded-full bg-red-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-5 animate-fade-up my-auto">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <ShieldOff size={28} className="text-red-400" />
          </div>
        </div>

        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-red-400 uppercase tracking-widest">
            Conta Banida
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-1">
            Sua conta foi suspensa pelo time de moderação.
          </p>
        </div>

        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-1.5">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Motivo</p>
          <p className="text-sm font-mono text-red-300 font-bold">{reason}</p>
          {details && (
            <p className="text-xs font-mono text-gray-400 leading-relaxed">{details}</p>
          )}
        </div>

        {pedido && !enviado && (
          <div className="bg-dark-700/60 border border-dark-400 rounded-xl p-4 space-y-2">
            <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Seu pedido de revisão</p>
            <p className={`text-sm font-mono font-bold ${
              pedido.status === 'approved' ? 'text-neon-green'
              : pedido.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}`}>
              {pedido.status === 'approved' ? 'Aprovado'
                : pedido.status === 'rejected' ? 'Negado' : 'Em análise'}
            </p>
            {pedido.resposta && (
              <p className="text-xs font-mono text-gray-400 leading-relaxed">
                Resposta da equipe: {pedido.resposta}
              </p>
            )}
            <p className="text-[11px] font-mono text-gray-600">
              Você pode entrar de novo quando quiser para ver se houve resposta.
            </p>
          </div>
        )}

        {enviado ? (
          <div className="bg-neon-green/10 border border-neon-green/25 rounded-xl p-4 space-y-2 text-center">
            <CheckCircle2 size={20} className="text-neon-green mx-auto" />
            <p className="text-sm font-mono text-neon-green font-bold">Pedido enviado</p>
            <p className="text-xs font-mono text-gray-400 leading-relaxed">
              A equipe vai analisar. Você pode entrar de novo a qualquer momento
              para ver se houve resposta — o acesso ao site continua bloqueado até lá.
            </p>
          </div>
        ) : recorrendo ? (
          <div className="space-y-2">
            <label htmlFor="motivo-recurso" className="block text-xs text-gray-500 font-mono uppercase tracking-wider">
              Por que você acha que o banimento foi um engano?
            </label>
            <textarea
              id="motivo-recurso"
              value={motivo}
              onChange={e => setMotivo(e.target.value.slice(0, MAX_CARACTERES))}
              rows={5}
              autoFocus
              placeholder="Explique o que aconteceu. Só é possível enviar um pedido por banimento, então conte tudo de uma vez."
              className="input-gamer w-full text-xs font-mono leading-relaxed resize-none"
            />
            <div className="flex items-center justify-between text-[11px] font-mono text-gray-600">
              <span>{faltam > 0 ? `faltam ${faltam} caracteres` : 'pode enviar'}</span>
              <span translate="no" className="notranslate tabular-nums">
                {motivo.length}/{MAX_CARACTERES}
              </span>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setRecorrendo(false); setMotivo(''); }}
                disabled={enviando}
                className="flex-1 py-2.5 text-xs font-mono text-gray-400 border border-dark-400 rounded hover:bg-dark-700 transition-all disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={enviar}
                disabled={enviando || faltam > 0}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono font-bold rounded border border-neon-green/30 text-neon-green hover:bg-neon-green/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {enviando
                  ? <><Loader2 size={13} className="animate-spin" /> Enviando...</>
                  : <><Send size={13} /> Enviar pedido</>}
              </button>
            </div>
          </div>
        ) : pedido === null ? (
          <button
            onClick={() => setRecorrendo(true)}
            className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-mono font-bold rounded border border-neon-green/30 text-neon-green hover:bg-neon-green/10 transition-all"
          >
            <Send size={13} /> Pedir revisão do banimento
          </button>
        ) : null}

        <div className="text-center space-y-3">
          {!pausado && (
            <p className="text-xs font-mono text-gray-500">
              Fazendo logout em{' '}
              <span translate="no" className="notranslate text-red-400 font-bold tabular-nums">
                {countdown}s
              </span>
              ...
            </p>
          )}
          <button
            onClick={doSignOut}
            className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-mono font-bold rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={13} /> Sair agora
          </button>
          {/* Desde 28/08 isto é verdade de fato: a tela sobe no próprio login
              (ver `useAuth.signInWithEmail`), e não só numa sessão já aberta.
              Antes a frase estava aqui e era falsa — o login mostrava um toast
              genérico e a pessoa nunca reencontrava o formulário. */}
          <p className="text-[11px] font-mono text-gray-600 leading-relaxed">
            Esta tela reaparece a cada login, com o andamento do seu pedido.
          </p>
        </div>
      </div>
    </div>
  );
}
