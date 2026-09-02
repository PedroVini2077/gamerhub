import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAceitesPendentes } from '../../hooks/useAceitesPendentes';
import { DOCUMENTOS } from '../../lib/documentosLegais';

/**
 * O aviso de que há documento novo para aceitar.
 *
 * ── Avisa, não bloqueia ─────────────────────────────────────────────────────
 *
 * Decisão do dono: *"só avisa sem bloquear"*. Um modal que trava o site
 * forçaria a pessoa a clicar em "aceito" só para conseguir **ler** o documento
 * que está aceitando — consentimento arrancado assim vale menos, não mais.
 *
 * ── O "depois" some por SESSÃO, e não para sempre ───────────────────────────
 *
 * Se o dispensar fosse permanente, o aviso deixaria de existir na prática e a
 * pessoa nunca aceitaria. Se voltasse a cada tela, viraria praga. `sessionStorage`
 * é o meio-termo: some hoje, volta amanhã.
 *
 * ── Por que ele NÃO aparece quando a consulta falha ─────────────────────────
 *
 * `pendentes === null` quer dizer "não sei", e é o valor que a rede caída
 * produz. Avisar no escuro cutucaria quem já aceitou tudo — alarme falso, do
 * tipo que ensina a ignorar o canal (§0.2, 4ª regra).
 */

const CHAVE_ADIADO = 'gh_aceite_adiado';

function foiAdiado() {
  try { return window.sessionStorage.getItem(CHAVE_ADIADO) === 'sim'; } catch { return false; }
}

export default function AvisoDeAceite() {
  const { pendentes, aceitar, enviando } = useAceitesPendentes();
  const [adiado, setAdiado] = useState(foiAdiado);

  // `null` = ainda não sei. `[]` = está tudo aceito. Nos dois casos, nada na tela.
  if (!pendentes || pendentes.length === 0 || adiado) return null;

  const nomes = pendentes.map(c => DOCUMENTOS[c]?.rotulo).filter(Boolean);

  function adiar() {
    setAdiado(true);
    try { window.sessionStorage.setItem(CHAVE_ADIADO, 'sim'); } catch { /* modo privado */ }
  }

  async function confirmar() {
    const { error } = await aceitar();
    // A mensagem do banco é repassada: um "erro ao aceitar" genérico mandaria
    // a pessoa tentar de novo sem mudar nada.
    if (error) { toast.error('Não foi possível registrar: ' + error.message); return; }
    toast.success('Obrigado. Aceite registrado.');
  }

  return (
    <div
      role="status"
      className="w-full mb-4 px-4 py-3 rounded-lg border border-neon-cyan/25
                 bg-neon-cyan/5 flex items-start gap-3 flex-wrap animate-fade-up"
    >
      <FileText size={15} className="text-neon-cyan shrink-0 mt-0.5" />

      <div className="flex-1 min-w-[14rem] space-y-1">
        <p className="text-xs font-mono text-gray-300">
          {nomes.length === Object.keys(DOCUMENTOS).length
            ? 'Temos documentos para você ler e aceitar.'
            : 'Atualizamos um documento e precisamos do seu aceite.'}
        </p>
        <p className="text-[11px] font-mono text-gray-500">
          {/* Os links vêm ANTES do botão de aceitar, e isso é de propósito:
              a ordem na tela sugere a ordem da ação. Botão primeiro convidaria
              a aceitar sem ler. */}
          {pendentes.map((chave, i) => (
            <span key={chave}>
              <Link
                to={DOCUMENTOS[chave].caminho}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon-cyan hover:underline"
              >
                {DOCUMENTOS[chave].rotulo}
              </Link>
              {i < pendentes.length - 2 ? ', ' : i === pendentes.length - 2 ? ' e ' : ''}
            </span>
          ))}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={confirmar}
          disabled={enviando}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-bold
                     rounded border border-neon-green/30 text-neon-green
                     hover:bg-neon-green/10 transition-all disabled:opacity-40"
        >
          {enviando ? <><Loader2 size={12} className="animate-spin" /> Registrando...</> : 'Li e aceito'}
        </button>
        <button
          onClick={adiar}
          aria-label="Ver depois"
          title="Ver depois"
          className="text-gray-600 hover:text-gray-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
