import { Link } from 'react-router-dom';
import { DOCUMENTOS } from '../../lib/documentosLegais';

/**
 * A marcação de aceite dos documentos, no cadastro.
 *
 * ── UMA caixinha, e não três ────────────────────────────────────────────────
 *
 * Decisão de produto: uma marcação só, cobrindo os três documentos, com link
 * para cada um. Três caixinhas separadas não deixam ninguém mais informado —
 * treinam a pessoa a clicar três vezes sem ler, e o consentimento fica pior,
 * não melhor.
 *
 * ── Os links abrem em ABA NOVA ──────────────────────────────────────────────
 *
 * E isso não é detalhe: sem `target="_blank"`, clicar em "Termos de Uso" no
 * meio do cadastro faria a pessoa PERDER tudo que já digitou. O resultado
 * previsível é ninguém clicar, ou seja, ninguém ler — que é o oposto do que
 * uma tela de consentimento existe para fazer.
 *
 * ── O que esta caixinha NÃO é ───────────────────────────────────────────────
 *
 * Não é a prova do consentimento. A prova é a linha em `policy_acceptances`,
 * com documento, versão e data. Esta caixinha é como a pessoa expressa a
 * escolha; o registro é o que sobra dela.
 */
export default function AceiteDosDocumentos({ aceito, setAceito }) {
  const documentos = Object.entries(DOCUMENTOS);

  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={aceito}
        onChange={e => setAceito(e.target.checked)}
        className="mt-0.5 w-4 h-4 shrink-0 accent-neon-green cursor-pointer"
      />
      <span className="text-xs font-mono text-gray-400 leading-relaxed">
        Li e aceito os{' '}
        {documentos.map(([chave, doc], i) => (
          <span key={chave}>
            <Link
              to={doc.caminho}
              target="_blank"
              rel="noopener noreferrer"
              // `stopPropagation` porque o link vive DENTRO do <label>: sem
              // isto, clicar para LER o documento marcaria a caixinha junto —
              // registrando um aceite que a pessoa não deu.
              onClick={e => e.stopPropagation()}
              className="text-neon-green hover:underline"
            >
              {doc.rotulo}
            </Link>
            {i < documentos.length - 2 ? ', ' : i === documentos.length - 2 ? ' e ' : ''}
          </span>
        ))}
        .
      </span>
    </label>
  );
}
