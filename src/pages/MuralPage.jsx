import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { fetchMuralPostById } from '../services/communityService';
import { useAuth } from '../hooks/useAuth.jsx';
import MuralCard from '../components/community/MuralCard';

/**
 * Um item do mural sozinho, no endereço `/mural/:id`.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 *
 * Quando a fila de moderação ganhou o botão "ver no site", o mural foi o único
 * tipo que ficou sem destino exato: ele não tinha página por item, então o link
 * caía em `/community` e o moderador ainda precisava caçar a mensagem na lista.
 *
 * Isso é pior do que parece num painel de moderação: a lista é paginada, e uma
 * mensagem antiga pode nem estar na primeira página — o moderador clicaria em
 * "ver no site" e não encontraria nada.
 *
 * As regras de visibilidade são as mesmas da página de post: conteúdo oculto
 * aparece para quem é da equipe (a RLS decide), e para os demais a página não
 * separa "não existe" de "não pode ver".
 */
export default function MuralPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [estado, setEstado] = useState({ fase: 'carregando' });

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      const { data, error } = await fetchMuralPostById(id, user?.id);
      if (cancelado) return;
      if (error)      setEstado({ fase: 'erro', msg: error.message });
      else if (!data) setEstado({ fase: 'ausente' });
      else            setEstado({ fase: 'ok', item: data });
    }
    carregar();
    return () => { cancelado = true; };
  }, [id, user?.id]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <Link to="/community" className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-neon-green transition-colors">
        <ArrowLeft size={14} /> Voltar ao mural
      </Link>

      {estado.fase === 'carregando' && (
        <div className="card p-8 flex items-center justify-center gap-2 text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm font-mono">Carregando mensagem...</span>
        </div>
      )}

      {estado.fase === 'erro' && (
        <div className="card p-6 space-y-1">
          <p className="text-sm text-red-400 font-mono">Não foi possível carregar esta mensagem.</p>
          <p className="text-xs text-gray-500 font-mono">{estado.msg}</p>
        </div>
      )}

      {estado.fase === 'ausente' && (
        <div className="card p-6 space-y-1">
          <p className="text-sm text-gray-300">Esta mensagem não existe ou não está visível para você.</p>
          <p className="text-xs text-gray-500 font-mono">
            Conteúdo oculto só aparece para a equipe de moderação.
          </p>
        </div>
      )}

      {estado.fase === 'ok' && <MuralCard item={estado.item} />}
    </div>
  );
}
