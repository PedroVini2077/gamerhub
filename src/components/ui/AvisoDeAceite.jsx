import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAceitesPendentes } from '../../hooks/useAceitesPendentes';
import { DOCUMENTOS } from '../../lib/documentosLegais';
import { comVoltaPara } from '../../lib/url';

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
  // Os links abrem em aba nova, e aba nova nasce sem histórico: sem levar a
  // origem junto, o "Voltar" de lá jogaria na landing (`BotaoVoltar.jsx`).
  const { pathname, search } = useLocation();
  const daqui = pathname + search;

  // `null` = ainda não sei. `[]` = está tudo aceito. Nos dois casos, nada na tela.
  if (!pendentes || pendentes.length === 0 || adiado) return null;

  // Tudo pendente = conta que nunca aceitou nada. Qualquer coisa a menos que
  // isso é reaceite: alguém que já aceitou e viu um documento mudar.
  const primeiroAceite = pendentes.length === Object.keys(DOCUMENTOS).length;

  const mudancas = pendentes
    .map(chave => ({ chave, texto: DOCUMENTOS[chave]?.mudou }))
    .filter(m => m.texto);

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
          {primeiroAceite
            ? 'Temos documentos para você ler e aceitar.'
            : 'Atualizamos um documento e precisamos do seu aceite de novo.'}
        </p>

        {/* `[03/09]` O QUE mudou, e não só QUE mudou.
            O dono reportou o segundo aviso como bug — *"apareceu duas vezes,
            sendo que aceitei uma vez já"* —, e ele estava certo em estranhar:
            um pedido idêntico ao primeiro é indistinguível de sistema quebrado.
            O comportamento estava certo; a tela é que não contava o
            suficiente para ser entendida. */}
        {!primeiroAceite && mudancas.length > 0 && (
          <ul className="text-[11px] font-mono text-gray-400 space-y-0.5">
            {mudancas.map(({ chave, texto }) => (
              <li key={chave}>
                <span className="text-gray-500">{DOCUMENTOS[chave].rotulo}:</span> {texto}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] font-mono text-gray-500">
          {/* Os links vêm ANTES do botão de aceitar, e isso é de propósito:
              a ordem na tela sugere a ordem da ação. Botão primeiro convidaria
              a aceitar sem ler. */}
          {pendentes.map((chave, i) => (
            <span key={chave}>
              <Link
                to={comVoltaPara(DOCUMENTOS[chave].caminho, daqui)}
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
