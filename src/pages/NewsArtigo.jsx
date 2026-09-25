import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, ExternalLink } from 'lucide-react';
import { fetchArtigo, fetchTagsDoArtigo } from '../services/newsService';
import { apenasData } from '../services/result';
import { rotuloDaEditoria, corDaEditoria } from '../lib/news/editorias';
import { rotuloDoEstado, corDoEstado, estadoNoAr } from '../lib/news/estadosDoArtigo';
import { safeExternalUrl } from '../lib/url';
import { timeAgo } from '../lib/date';
import TextoFormatado from '../components/ui/TextoFormatado';
import Avatar from '../components/ui/Avatar';

/**
 * `[25/09]` Um artigo do News — `/news/:slug`.
 *
 * ── O corpo passa pelo MESMO caminho do post ──────────────────────────────
 *
 * `TextoFormatado` transforma o texto numa ÁRVORE e vira elemento React. Nunca
 * existe string de HTML — nem para conteúdo que a própria equipe escreveu.
 * Abrir exceção "porque é da equipe" seria criar o único lugar do site onde
 * `dangerouslySetInnerHTML` faria sentido, e é assim que o zero vira um.
 *
 * ── A fonte externa é o único ponto perigoso, e ele tem dono ──────────────
 *
 * `fonte_url` vem de quem escreveu e vira `href`. Passa por `safeExternalUrl`,
 * a mesma função que fechou um XSS armazenado real deste projeto. URL recusada
 * não some: aparece como texto, para quem escreveu ver o que digitou.
 *
 * ── Rascunho abre para a equipe, e a tela DIZ que é rascunho ──────────────
 *
 * A RLS deixa `is_staff()` ler qualquer status. Sem a tarja, um editor abriria
 * o próprio rascunho pelo link e teria todo motivo para achar que já está no
 * ar — e "está publicado?" é a pergunta que um fluxo editorial existe para
 * responder sem ambiguidade.
 */
export default function NewsArtigo() {
  const { slug } = useParams();

  const { data: artigo, isLoading } = useQuery({
    queryKey: ['news-artigo', slug],
    queryFn: () => apenasData(fetchArtigo(slug)),
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['news-tags', artigo?.id],
    queryFn: () => apenasData(fetchTagsDoArtigo(artigo.id)),
    enabled: Boolean(artigo?.id),
  });

  if (isLoading) {
    return <p className="card p-8 text-center font-mono text-gray-500 text-sm">Carregando…</p>;
  }

  if (!artigo) {
    return (
      <div className="card p-8 text-center space-y-3">
        <p className="font-display text-white">Não achamos esta matéria.</p>
        <p className="text-sm text-gray-500">
          O link pode estar velho, ou ela pode ter saído do ar.
        </p>
        <Link to="/news" className="btn-neon inline-flex items-center gap-2 text-sm">
          <ArrowLeft size={14} /> Ver o News
        </Link>
      </div>
    );
  }

  const fonte = safeExternalUrl(artigo.fonte_url);

  return (
    <article className="max-w-3xl mx-auto space-y-4">
      <Link to="/news" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-neon-green transition-colors">
        <ArrowLeft size={14} /> GamerHub News
      </Link>

      {/* A tarja só existe quando o artigo NÃO está no ar. */}
      {!estadoNoAr(artigo.status) && (
        <div className="card p-3 border-yellow-400/40">
          <p className={`font-mono text-xs ${corDoEstado(artigo.status)}`}>
            {rotuloDoEstado(artigo.status)} — só a equipe está vendo esta página.
          </p>
        </div>
      )}

      <header className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-mono uppercase tracking-wider ${corDaEditoria(artigo.editoria)}`}>
            {rotuloDaEditoria(artigo.editoria)}
          </span>
          {artigo.publicado_em && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-gray-600">
              <Clock size={10} /> {timeAgo(artigo.publicado_em)}
            </span>
          )}
        </div>

        <h1 className="font-display text-2xl sm:text-3xl text-white leading-tight">{artigo.titulo}</h1>
        {artigo.subtitulo && (
          <p className="text-base text-gray-400 leading-relaxed">{artigo.subtitulo}</p>
        )}

        {artigo.autor && (
          <div className="flex items-center gap-2 pt-1">
            <Avatar profile={artigo.autor} size={28} />
            <span className="text-sm text-gray-400">@{artigo.autor.username}</span>
          </div>
        )}
      </header>

      {artigo.capa_url && (
        <img src={artigo.capa_url} alt="" className="w-full rounded-xl border border-dark-500" />
      )}

      <div className="card p-5">
        <TextoFormatado texto={artigo.conteudo} className="text-[15px] text-gray-300 leading-relaxed" />
      </div>

      {tags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {tags.map((t) => <span key={t.slug} className="tag">{t.nome}</span>)}
        </div>
      )}

      {artigo.fonte_url && (
        <p className="text-xs text-gray-600">
          Fonte:{' '}
          {fonte
            ? (
              <a href={fonte} target="_blank" rel="noopener noreferrer"
                className="text-neon-green hover:underline inline-flex items-center gap-1">
                {fonte} <ExternalLink size={11} />
              </a>
            )
            : <span className="font-mono">{artigo.fonte_url}</span>}
        </p>
      )}
    </article>
  );
}
