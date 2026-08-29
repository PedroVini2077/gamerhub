import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { fetchPostById } from '../services/postService';
import { useAuth } from '../hooks/useAuth.jsx';
import PostCard from '../components/feed/PostCard';

/**
 * Um post sozinho, no endereço `/post/:id`.
 *
 * ── Por que esta página existe ──────────────────────────────────────────────
 *
 * Pedido do dono: na fila de moderação "só aparece o conteúdo de texto", e ele
 * queria "clicar em cima do post que foi denunciado e ser jogado especialmente
 * para aquele post, um link direto, pra ele poder ver".
 *
 * Antes disso o site não tinha endereço para um post: o feed é `/`, e um post
 * antigo podia nem estar na primeira página. Não havia para onde apontar.
 *
 * ── Por que serve para moderar conteúdo JÁ OCULTO ──────────────────────────
 *
 * Porque a RLS já resolvia isso e ninguém tinha aproveitado: a policy
 * `posts_select` libera conteúdo oculto **e** apagado para `role_rank >= 2`
 * (conferido em `pg_policies`, não suposto). Então o moderador abre o link e vê
 * o post inteiro — com imagem, vídeo e áudio — mesmo depois de ele ter sido
 * escondido do site.
 *
 * Para quem não é da equipe, a mesma consulta volta vazia e a página diz que o
 * post não existe ou não está visível. As duas causas são indistinguíveis de
 * propósito: separar "não existe" de "existe e você não pode ver" já entrega a
 * existência de conteúdo oculto a quem não deveria saber dela.
 */
export default function PostPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [estado, setEstado] = useState({ fase: 'carregando' });

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      const { data, error } = await fetchPostById(id, user?.id);
      if (cancelado) return;
      // Erro e ausência são coisas diferentes e têm mensagens diferentes: um
      // pede para tentar de novo, o outro não (§1.5, mensagem verdadeira).
      if (error)      setEstado({ fase: 'erro', msg: error.message });
      else if (!data) setEstado({ fase: 'ausente' });
      else            setEstado({ fase: 'ok', post: data });
    }
    carregar();
    return () => { cancelado = true; };
  }, [id, user?.id]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <Link to="/" className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-neon-green transition-colors">
        <ArrowLeft size={14} /> Voltar ao feed
      </Link>

      {estado.fase === 'carregando' && (
        <div className="card p-8 flex items-center justify-center gap-2 text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm font-mono">Carregando post...</span>
        </div>
      )}

      {estado.fase === 'erro' && (
        <div className="card p-6 space-y-1">
          <p className="text-sm text-red-400 font-mono">Não foi possível carregar este post.</p>
          <p className="text-xs text-gray-500 font-mono">{estado.msg}</p>
        </div>
      )}

      {estado.fase === 'ausente' && (
        <div className="card p-6 space-y-1">
          <p className="text-sm text-gray-300">Este post não existe ou não está visível para você.</p>
          <p className="text-xs text-gray-500 font-mono">
            Conteúdo oculto ou apagado só aparece para a equipe de moderação.
          </p>
        </div>
      )}

      {estado.fase === 'ok' && <PostCard post={estado.post} />}
    </div>
  );
}
