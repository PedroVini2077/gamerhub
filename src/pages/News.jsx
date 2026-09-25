import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Newspaper } from 'lucide-react';
import { listContainer, listItem } from '../lib/motion';
import { fetchNoticias, TETO_DA_LISTA } from '../services/newsService';
import { apenasData } from '../services/result';
import { EDITORIAS_EM_ORDEM, rotuloDaEditoria, editoriaValida } from '../lib/news/editorias';
import CartaoDeNoticia from '../components/news/CartaoDeNoticia';
import RightPanel from '../components/layout/RightPanel';

/**
 * `[25/09]` O GAMERHUB NEWS — a lista, em `/news`.
 *
 * ── A editoria mora na URL ────────────────────────────────────────────────
 *
 * Mesmo motivo da busca: "as notícias de hardware" é um link que se manda para
 * alguém e que sobrevive ao F5. Estado de componente perderia as duas coisas.
 *
 * ── Editoria inventada na URL NÃO vira lista vazia ────────────────────────
 *
 * `/news?editoria=qualquercoisa` poderia consultar o banco, não achar nada, e
 * desenhar "nenhuma notícia" — resposta que parece verdade e não é. O
 * vocabulário é conferido AQUI, antes da consulta: valor fora da lista cai para
 * "Tudo", que é o que a pessoa veria se não tivesse filtro nenhum.
 */
export default function News() {
  const [params, setParams] = useSearchParams();
  const pedida = params.get('editoria');
  const editoria = pedida && editoriaValida(pedida) ? pedida : null;

  const { data, isLoading } = useQuery({
    queryKey: ['news', editoria],
    queryFn: () => apenasData(fetchNoticias({ editoria })),
    staleTime: 60 * 1000,
  });

  const artigos = data?.artigos ?? [];
  const noTeto = data?.noTeto ?? false;

  function filtrar(slug) {
    const novo = new URLSearchParams(params);
    if (slug) novo.set('editoria', slug); else novo.delete('editoria');
    setParams(novo, { replace: true });
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Newspaper size={16} className="text-neon-green shrink-0" />
            <h1 className="font-display text-lg text-white">GamerHub News</h1>
          </div>
          <p className="text-sm text-gray-500">
            O que aconteceu em games, tecnologia e cultura geek — apurado pela equipe.
          </p>

          <div className="flex gap-2 flex-wrap pt-1">
            <button
              onClick={() => filtrar(null)}
              className={`tag cursor-pointer transition-all ${
                editoria === null ? 'tag-green' : 'opacity-60 hover:opacity-100'}`}
            >
              Tudo
            </button>
            {EDITORIAS_EM_ORDEM.map((slug) => (
              <button
                key={slug}
                onClick={() => filtrar(slug)}
                className={`tag cursor-pointer transition-all ${
                  editoria === slug ? 'tag-green' : 'opacity-60 hover:opacity-100'}`}
              >
                {rotuloDaEditoria(slug)}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="card p-8 text-center">
            <p className="font-mono text-gray-500 text-sm">Carregando…</p>
          </div>
        )}

        {!isLoading && artigos.length === 0 && (
          <div className="card p-8 text-center space-y-1">
            <p className="font-mono text-gray-400 text-sm">
              {editoria
                ? `Nada em ${rotuloDaEditoria(editoria)} por enquanto.`
                : 'O News ainda não tem nenhuma matéria publicada.'}
            </p>
            <p className="text-xs text-gray-600">
              {editoria ? 'Tente outra editoria.' : 'Assim que a equipe publicar, aparece aqui.'}
            </p>
          </div>
        )}

        {artigos.length > 0 && (
          <motion.div
            variants={listContainer} initial="hidden" animate="show"
            className="grid gap-4 sm:grid-cols-2"
          >
            {artigos.map((a) => (
              <motion.div key={a.id} variants={listItem}>
                <CartaoDeNoticia artigo={a} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* O teto é DITO. Lista que corta em silêncio mente sobre o tamanho do
            que existe — a mesma regra da busca. */}
        {noTeto && (
          <p className="text-center text-xs font-mono text-gray-600 pt-1">
            Mostrando as {TETO_DA_LISTA} mais recentes. Use uma editoria para afinar.
          </p>
        )}
      </div>

      <RightPanel />
    </div>
  );
}
