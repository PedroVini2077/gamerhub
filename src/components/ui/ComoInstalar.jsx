import { createPortal } from 'react-dom';
import { X, Download } from 'lucide-react';
import { receitaDeInstalacao } from '../../lib/comoInstalar';

/**
 * `[09/10]` O painel que explica como instalar, quando o navegador não oferece.
 *
 * Ele aparece no lugar do antigo **nada**: a entrada "Instalar o app" deixou de
 * sumir quando o `beforeinstallprompt` não disparou, porque a ausência dela era
 * indistinguível de um deploy que não chegou.
 *
 * O texto vem de `lib/comoInstalar.js`, que escolhe por PLATAFORMA — e a
 * plataforma desconhecida tem receita própria, dizendo o que procurar em vez de
 * chutar os passos de outra.
 */
export default function ComoInstalar({ aoFechar }) {
  const receita = receitaDeInstalacao();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={aoFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Como instalar o GamerHub"
        className="w-full max-w-sm bg-dark-800 rounded-2xl border border-neon-green/30 p-5 space-y-4 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 0 40px #22c55e15' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download size={14} className="text-neon-green" aria-hidden="true" />
            <h3 className="font-display text-sm text-neon-green uppercase tracking-wider">
              Instalar o GamerHub
            </h3>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={aoFechar}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <p className="text-xs font-mono text-gray-400 leading-relaxed">
          Seu navegador não ofereceu a instalação automática agora, mas ela
          continua possível pelo menu dele.
        </p>

        <div className="space-y-2">
          <p className="font-display text-xs uppercase tracking-wider text-gray-500">
            {receita.titulo}
          </p>
          <ol className="space-y-2">
            {receita.passos.map((passo, i) => (
              <li key={passo} className="flex gap-2.5 text-xs font-mono text-gray-300 leading-relaxed">
                <span className="shrink-0 text-neon-green">{i + 1}.</span>
                <span>{passo}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Quem já instalou e abriu numa aba comum cai aqui, porque o navegador
            não oferece de novo o que já está instalado. Dizer isto evita a
            conclusão errada de que o site está quebrado. */}
        <p className="text-xs font-mono text-gray-500 leading-relaxed border-t border-dark-600 pt-3">
          Se você já instalou antes, o GamerHub está na sua tela inicial — o
          navegador não oferece de novo.
        </p>
      </div>
    </div>,
    document.body,
  );
}
