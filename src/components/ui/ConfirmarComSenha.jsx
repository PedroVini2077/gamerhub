import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, ShieldAlert } from 'lucide-react';

import CampoDeSenha from './CampoDeSenha';

/**
 * A confirmação de uma ação IRREVERSÍVEL, com a senha da conta.
 *
 * ── Por que ela existe `[12/09]` ────────────────────────────────────────────
 *
 * Achado SEC-012 da auditoria: apagar a conta — a ação mais destrutiva e
 * irreversível do site — acontecia atrás de dois `ConfirmModal`. Dois cliques
 * são **validação de cliente**, e o §1.3 é explícito: o site usa a `anon key`,
 * então qualquer um chama `/rest/v1/rpc/delete_own_account` direto e pula a
 * tela inteira. Uma sessão deixada aberta num computador alheio apagava a conta
 * com uma requisição.
 *
 * **A senha é conferida no SERVIDOR**, dentro da própria RPC. Esta tela não
 * valida nada — ela só coleta. Se alguém pular a tela, a RPC recusa.
 *
 * ── Por que não é o `ConfirmModal` com um campo dentro ──────────────────────
 *
 * Porque o `ConfirmModal` é para confirmar **intenção**, e isto confirma
 * **identidade**. São perguntas diferentes: a primeira admite "tem certeza?",
 * a segunda exige uma prova. Misturar as duas num componente só faria a versão
 * fraca virar o padrão por descuido.
 *
 * O `ResetDoCofre` faz a mesma coisa para o cofre do Fundador desde 05/09 —
 * este componente é a generalização daquele padrão, agora que ele tem dois
 * usos. Não é mecanismo novo (§9.8).
 *
 * ── A mensagem de erro distingue rede de senha errada ───────────────────────
 *
 * §1.5: *toda mensagem de erro tem que ser verdadeira*. Dizer "senha incorreta"
 * quando o banco não respondeu manda a pessoa tentar de novo achando que digitou
 * errado. Quem separa os dois é quem chama, porque só ele conhece a resposta da
 * RPC — por isso o `erro` entra por prop em vez de ser inventado aqui.
 *
 * @param {(senha: string) => void} props.aoConfirmar Recebe a senha digitada.
 *   Quem chama é responsável por mandá-la à RPC e tratar a recusa.
 */
export default function ConfirmarComSenha({
  titulo, aviso, rotuloDoBotao, Icone = Lock,
  ocupado = false, erro = '', aoConfirmar, aoFechar, nota,
}) {
  const [senha, setSenha] = useState('');

  function enviar(e) {
    e.preventDefault();
    if (ocupado || !senha) return;
    aoConfirmar(senha);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmar-com-senha-titulo"
    >
      <div className="bg-dark-800 rounded-2xl w-full max-w-sm p-6 animate-fade-up">
        <div className="flex items-center gap-2 text-red-400">
          <Icone size={16} />
          <h2
            id="confirmar-com-senha-titulo"
            className="font-display text-sm tracking-widest uppercase"
          >
            {titulo}
          </h2>
        </div>

        <p className="text-xs font-mono text-gray-400 leading-relaxed mt-3">{aviso}</p>

        <form onSubmit={enviar} className="mt-4 space-y-3">
          <CampoDeSenha
            rotulo="Senha da conta"
            valor={senha}
            aoMudar={setSenha}
            autoFocus
            autoComplete="current-password"
            desabilitado={ocupado}
            erro={Boolean(erro)}
          />

          {erro && <p role="alert" className="text-xs font-mono text-red-400">{erro}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={aoFechar}
              disabled={ocupado}
              className="flex-1 py-2.5 rounded text-sm font-display tracking-widest uppercase
                         border border-dark-400 text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={ocupado || !senha}
              className="flex-1 py-2.5 rounded text-sm font-display tracking-widest uppercase
                         bg-red-500/15 border border-red-500/40 text-red-300
                         hover:bg-red-500/25 disabled:opacity-40 transition-colors
                         flex items-center justify-center gap-2"
            >
              <Icone size={14} />
              {ocupado ? 'Confirmando…' : rotuloDoBotao}
            </button>
          </div>
        </form>

        {nota && (
          <div className="flex gap-2 items-start text-left mt-4">
            <ShieldAlert size={13} className="text-gray-600 shrink-0 mt-0.5" />
            <p className="text-[11px] font-mono text-gray-600 leading-relaxed">{nota}</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
