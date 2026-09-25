import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * `[26/09]` O erro na tela — legível em cima, técnico embaixo.
 *
 * ── As duas maneiras de errar isto, e as duas já aconteceram ──────────────
 *
 * 1. **Despejar o erro cru.** Foi o que o dono viu: `new row for relation
 *    "news_articles" violates check constraint …` embaixo dos botões. Verdade
 *    inútil — quem lê não sabe o que fazer.
 * 2. **Trocar por "algo deu errado".** Parece polido e é pior: apaga a única
 *    informação que permitiria investigar. É a §1.5 pelo outro lado.
 *
 * Este componente recusa as duas: a frase em português fica em cima, e o
 * texto original do banco continua ali, a um clique. Quem usa entende; quem
 * for consertar tem o que precisa.
 *
 * O `detalhe` só aparece quando existe E quando é diferente da mensagem —
 * repetir a mesma frase em dois tamanhos é ruído.
 */
export default function AvisoDeErro({ mensagem, detalhe, className = '' }) {
  const [aberto, setAberto] = useState(false);
  if (!mensagem) return null;

  const temDetalhe = detalhe && detalhe !== mensagem;

  return (
    <div className={`rounded-lg border border-red-500/40 bg-red-500/5 p-3 space-y-2 ${className}`}>
      <p className="flex items-start gap-2 text-sm text-red-300">
        <AlertCircle size={15} className="shrink-0 mt-0.5" />
        <span>{mensagem}</span>
      </p>

      {temDetalhe && (
        <>
          <button
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="flex items-center gap-1 text-[11px] font-mono text-gray-500 hover:text-gray-300"
          >
            {aberto ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            detalhes técnicos
          </button>
          {aberto && (
            <p className="text-[11px] font-mono text-gray-500 break-words whitespace-pre-wrap">
              {detalhe}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * O mesmo aviso, para quando a operação deu CERTO.
 *
 * Existe aqui, no mesmo arquivo, porque as telas que mostram um precisam do
 * outro — e duas caixinhas em arquivos separados divergem no primeiro ajuste
 * de espaçamento (§4, fonte única).
 */
export function AvisoDeSucesso({ mensagem, className = '' }) {
  if (!mensagem) return null;
  return (
    <p className={`rounded-lg border border-neon-green/30 bg-neon-green/5 p-3 text-sm text-neon-green ${className}`}>
      {mensagem}
    </p>
  );
}
