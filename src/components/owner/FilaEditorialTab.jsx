import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Newspaper, Clock, ArrowUpRight } from 'lucide-react';
import { fetchArtigosDaEquipe } from '../../services/newsEditorialService';
import { apenasData } from '../../services/result';
import { ESTADOS_EM_ORDEM, rotuloDoEstado, corDoEstado } from '../../lib/news/estadosDoArtigo';
import { rotuloDaEditoria } from '../../lib/news/editorias';
import { timeAgo } from '../../lib/date';
import MarcaDeIa from '../news/MarcaDeIa';

/**
 * `[25/09]` A FILA EDITORIAL no painel do Fundador.
 *
 * ── Por que NÃO é um segundo editor ───────────────────────────────────────
 *
 * Ele perguntou se o owner devia ter um painel próprio de publicar notícias. A
 * resposta foi não, e o motivo é o §4: dois editores são duas implementações da
 * mesma coisa, e é onde as duas divergem. A diferença entre owner e admin já
 * está expressa no lugar certo — **quais botões aparecem** no editor que existe.
 *
 * O que faltava no `/owner` não era a ferramenta de escrever: era o **estado do
 * jornal**. Quantas matérias esperando revisão, quantas no ar, o que está
 * parado há semanas. Isso é informação de fundador, e não existia em lugar
 * nenhum — nem no painel do admin, que lista sem somar.
 *
 * ── O que ele responde em um olhar ────────────────────────────────────────
 *
 *   quantas em cada estado · o que espera revisão AGORA · há quanto tempo
 *
 * "Há quanto tempo" é a parte que não é enfeite: matéria em revisão há duas
 * semanas não é fila, é esquecimento — e esquecimento é invisível numa lista
 * ordenada por data, onde ela simplesmente desce.
 */
export default function FilaEditorialTab() {
  const { data: artigos = [], isLoading } = useQuery({
    queryKey: ['news-equipe'],
    queryFn: () => apenasData(fetchArtigosDaEquipe()),
  });

  if (isLoading) {
    return <p className="card p-6 text-center font-mono text-gray-500 text-sm">Carregando…</p>;
  }

  const porEstado = Object.fromEntries(
    ESTADOS_EM_ORDEM.map((e) => [e, artigos.filter((a) => a.status === e).length]),
  );
  const esperando = artigos.filter((a) => a.status === 'in_review');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {ESTADOS_EM_ORDEM.map((estado) => (
          <div key={estado} className="card p-3 text-center">
            <p className={`font-display text-xl ${corDoEstado(estado)}`}>{porEstado[estado]}</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-600">
              {rotuloDoEstado(estado)}
            </p>
          </div>
        ))}
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Newspaper size={14} className="text-neon-green shrink-0" />
          <h3 className="font-display text-xs text-white uppercase tracking-wider">
            Esperando a sua revisão
          </h3>
        </div>

        {esperando.length === 0 && (
          <p className="text-sm text-gray-500">
            {artigos.length === 0
              ? 'Nenhuma matéria no sistema ainda.'
              : 'Nada esperando revisão. A fila está limpa.'}
          </p>
        )}

        {esperando.map((a) => (
          <div key={a.id} className="flex items-center gap-3 py-2 border-t border-dark-500 first:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{a.titulo}</p>
              <p className="flex items-center gap-1 text-[11px] font-mono text-gray-600">
                {rotuloDaEditoria(a.editoria)}
                <span className="text-gray-700">·</span>
                <Clock size={10} /> parada há {timeAgo(a.updated_at)}
              </p>
            </div>
            <MarcaDeIa ativo={a.redigido_com_ia} />
          </div>
        ))}

        {/* O caminho para AGIR é um só, e é o editor que já existe. Duplicar o
            editor aqui seria a segunda implementação que este arquivo recusa. */}
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-xs text-neon-green hover:underline"
        >
          Abrir o painel editorial <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}
