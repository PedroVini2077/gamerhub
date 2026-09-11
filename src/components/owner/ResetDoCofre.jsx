import { useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, KeyRound, ShieldAlert } from 'lucide-react';

import CampoDeSenha from '../ui/CampoDeSenha';
import { supabase } from '../../lib/supabase';

/**
 * Esquecer o código do cofre — agora exigindo a SENHA DA CONTA.
 *
 * ── O achado que produziu esta tela ─────────────────────────────────────────
 *
 * Pergunta do dono, em 05/09: *"que sentido faz ter um botão pra resetar senha?
 * se alguém pega meu PC ou celular ligado na tela e não souber a senha, ele só
 * vai redefinir"*.
 *
 * Ele estava certo. O botão apagava o resumo e o sal do `localStorage` e a tela
 * caía em "definir novo código". **Dois cliques e qualquer um entrava** — o
 * cofre protegia contra ninguém.
 *
 * **O que isto não era:** brecha de segurança. O cofre é cenográfico por
 * decisão registrada, e quem protege o painel é a RLS com `is_super()`. **O que
 * era:** um cadeado que não tranca, o que é pior do que cadeado nenhum — ele
 * sugere uma proteção que não existe.
 *
 * ── Por que a senha da conta, e por que pela RPC ────────────────────────────
 *
 * A senha é a única coisa que quem senta na máquina destravada normalmente
 * **não** tem. É ela que faz o cofre significar algo.
 *
 * A conferência é `confere_a_propria_senha`, uma RPC `SECURITY DEFINER` que
 * responde `true`/`false` — e não `signInWithPassword`. O motivo é o §7:
 * `signInWithPassword` **substitui a sessão**, e `useAuth.jsx` é o arquivo de
 * maior risco do projeto. Trocar a sessão para responder uma pergunta de
 * sim/não é efeito colateral grande demais.
 *
 * A RPC só confere a senha de quem chama, só responde para `is_super()`, e
 * devolve booleano — nada do hash sai dela. Provado em ROLLBACK nas três vias:
 * dono com senha certa `true`, dono com senha errada `false`, e usuário comum
 * com a senha certa **`false`**.
 *
 * ── O que ela NÃO promete ───────────────────────────────────────────────────
 *
 * Quem tem a senha continua entrando, e deve mesmo — é o dono. E quem já tem a
 * sessão continua tendo tudo o que a sessão dá; o cofre nunca protegeu contra
 * isso, e o aviso embaixo do campo diz isso na tela.
 */
export default function ResetDoCofre({ aoConfirmar, aoFechar }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [conferindo, setConferindo] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (conferindo || !senha) return;
    setConferindo(true);
    setErro('');

    const { data, error } = await supabase.rpc('confere_a_propria_senha', { p_senha: senha });
    setConferindo(false);

    // Erro de rede e senha errada são coisas DIFERENTES, e dizer "senha
    // incorreta" quando o banco não respondeu manda o dono procurar no lugar
    // errado (§1.5: toda mensagem de erro tem que ser verdadeira).
    if (error) {
      setErro('Não deu para conferir agora. Tente de novo em instantes.');
      return;
    }
    if (data !== true) {
      setErro('Senha incorreta.');
      setSenha('');
      return;
    }
    aoConfirmar();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-do-cofre-titulo"
    >
      <div className="bg-dark-800 rounded-2xl w-full max-w-sm p-6 animate-fade-up">
        <div className="flex items-center gap-2 text-orange-400">
          <RotateCcw size={16} />
          <h2 id="reset-do-cofre-titulo" className="font-display text-sm tracking-widest uppercase">
            Esquecer o código
          </h2>
        </div>

        <p className="text-xs font-mono text-gray-400 leading-relaxed mt-3">
          Para apagar o código deste navegador, confirme com a
          {' '}
          <strong className="text-gray-300">senha da sua conta</strong>.
          Vale só aqui — os outros aparelhos continuam com o código deles.
        </p>

        <form onSubmit={enviar} className="mt-4 space-y-3">
          <CampoDeSenha
            rotulo="Senha da conta"
            Icone={KeyRound}
            placeholder="••••••••"
            valor={senha}
            aoMudar={setSenha}
            autoFocus
            autoComplete="current-password"
            desabilitado={conferindo}
          />

          {erro && (
            <p role="alert" className="text-xs font-mono text-red-400">{erro}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={aoFechar}
              disabled={conferindo}
              className="flex-1 py-2.5 rounded text-sm font-display tracking-widest uppercase border border-dark-400 text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={conferindo || !senha}
              className="cofre-botao flex-1 py-2.5 rounded text-sm font-display tracking-widest uppercase flex items-center justify-center gap-2"
            >
              <RotateCcw size={14} />
              {conferindo ? 'Conferindo…' : 'Apagar'}
            </button>
          </div>
        </form>

        <div className="flex gap-2 items-start text-left mt-4">
          <ShieldAlert size={13} className="text-gray-600 shrink-0 mt-0.5" />
          <p className="text-[11px] font-mono text-gray-600 leading-relaxed">
            Nenhuma permissão sua muda com isto. O cofre é uma tranca de tela —
            quem protege o painel são as regras do banco.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
