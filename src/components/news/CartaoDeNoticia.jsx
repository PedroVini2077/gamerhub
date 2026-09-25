import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { rotuloDaEditoria, corDaEditoria } from '../../lib/news/editorias';
import { timeAgo } from '../../lib/date';

/**
 * `[25/09]` O cartão de uma notícia na lista do News.
 *
 * ── Por que ele NÃO usa o `TextoFormatado` ────────────────────────────────
 *
 * O `resumo` é texto puro escrito pela equipe, não conteúdo de usuário com
 * marcação. Passá-lo pelo analisador faria um asterisco no meio de uma frase
 * virar itálico sem ninguém ter pedido — e o React escapa texto por
 * construção, então não há ganho de segurança nenhum em fazer isso.
 *
 * ── A capa é opcional e o cartão não pode depender dela ───────────────────
 *
 * Artigo sem capa é normal (uma nota curta, uma correção). O cartão encolhe em
 * vez de mostrar um buraco cinza — layout que exige imagem obriga a equipe a
 * inventar uma, e imagem inventada é pior do que nenhuma.
 */
export default function CartaoDeNoticia({ artigo }) {
  const { slug, titulo, resumo, capa_url: capa, editoria, publicado_em: publicado } = artigo;

  return (
    <Link
      to={`/news/${slug}`}
      className="card block overflow-hidden hover:border-neon-green/40 transition-colors group"
    >
      {capa && (
        <div className="aspect-[16/9] overflow-hidden bg-dark-700">
          <img
            src={capa} alt="" loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        </div>
      )}

      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-mono uppercase tracking-wider ${corDaEditoria(editoria)}`}>
            {rotuloDaEditoria(editoria)}
          </span>
          {publicado && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-gray-600">
              <Clock size={10} />
              {timeAgo(publicado)}
            </span>
          )}
        </div>

        <h3 className="font-display text-base text-white leading-snug group-hover:text-neon-green transition-colors">
          {titulo}
        </h3>

        {resumo && (
          <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">{resumo}</p>
        )}
      </div>
    </Link>
  );
}
