import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Newspaper } from 'lucide-react';
import { fetchArtigosDaEquipe, criarRascunho } from '../../services/newsEditorialService';
import { apenasData } from '../../services/result';
import { EDITORIAS_EM_ORDEM, rotuloDaEditoria } from '../../lib/news/editorias';
import { rotuloDoEstado, corDoEstado } from '../../lib/news/estadosDoArtigo';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useRole } from '../../hooks/useRole';
import EditorDeArtigo from './EditorDeArtigo';
import MarcaDeIa from './MarcaDeIa';
import AvisoDeErro from '../ui/AvisoDeErro';
import RadarDePautas from './RadarDePautas';

/**
 * `[25/09]` O PAINEL EDITORIAL — a aba "News" do admin.
 *
 * ── Por que ele busca os próprios dados ───────────────────────────────────
 *
 * O `Admin.jsx` passa dados por prop para os outros painéis, e essa corrente já
 * é longa. Enfiar o News nela somaria mais uma dúzia de props a um arquivo que
 * o §4 já vigia por tamanho. Aqui o painel é uma ilha: ele pergunta o que
 * precisa e não pede nada a ninguém.
 *
 * ── O que a tela NÃO faz, e é de propósito ────────────────────────────────
 *
 * Ela não decide quem pode publicar. Ela **não oferece** o botão que o banco
 * vai recusar — a decisão já foi tomada pelo trigger, e repeti-la aqui criaria
 * um segundo lugar para a regra divergir. Se alguém chamar a REST API direto, é
 * o banco que responde não.
 */
export default function PainelEditorial() {
  const { user } = useAuth();
  const { isSuperAdmin, isOwner } = useRole();
  const ehSuper = isSuperAdmin || isOwner;
  const qc = useQueryClient();

  // `{ id, notasIniciais }` — as notas viajam junto porque o rascunho criado a
  // partir de uma pauta do radar já nasce com as manchetes que a sustentam, e
  // é delas que a `redigir-materia` precisa para escrever.
  const [editando, setEditando] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [editoria, setEditoria] = useState(EDITORIAS_EM_ORDEM[0]);
  const [erro, setErro] = useState(null);
  const [criando, setCriando] = useState(false);

  const { data: artigos = [], isLoading } = useQuery({
    queryKey: ['news-equipe'],
    queryFn: () => apenasData(fetchArtigosDaEquipe()),
  });

  async function criar() {
    if (!titulo.trim() || criando) return;
    setCriando(true);
    setErro(null);
    const { data, error } = await criarRascunho({ titulo, editoria, autorId: user?.id });
    setCriando(false);

    // O erro vai para a TELA. `console.error` não é tratamento (§1.5).
    if (error) {
      setErro({ mensagem: error.message ?? 'Não deu para criar o rascunho.', detalhe: error.tecnico });
      return;
    }
    setTitulo('');
    qc.invalidateQueries({ queryKey: ['news-equipe'] });
    if (data?.id) setEditando({ id: data.id });
  }

  /** Uma pauta do radar vira rascunho, já com título, editoria, fonte e notas. */
  async function criarDaPauta({ titulo, editoria, fonteUrl, notas }) {
    setErro(null);
    const { data, error } = await criarRascunho({
      titulo, editoria: editoria ?? EDITORIAS_EM_ORDEM[0], autorId: user?.id, fonteUrl,
    });
    if (error) {
      setErro({ mensagem: error.message ?? 'Não deu para criar o rascunho.', detalhe: error.tecnico });
      return;
    }
    qc.invalidateQueries({ queryKey: ['news-equipe'] });
    if (data?.id) setEditando({ id: data.id, notasIniciais: notas });
  }

  if (editando) {
    return (
      <EditorDeArtigo
        id={editando.id}
        notasIniciais={editando.notasIniciais}
        ehSuper={ehSuper}
        onFechar={() => {
          setEditando(null);
          qc.invalidateQueries({ queryKey: ['news-equipe'] });
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <RadarDePautas onCriar={criarDaPauta} />

      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Newspaper size={15} className="text-neon-green shrink-0" />
          <h2 className="font-display text-sm text-white uppercase tracking-wider">Nova matéria</h2>
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título da matéria" maxLength={200}
            aria-label="Título da matéria"
            className="input-gamer flex-1 min-w-[220px]"
          />
          <select
            value={editoria} onChange={(e) => setEditoria(e.target.value)}
            aria-label="Editoria"
            className="input-gamer w-auto"
          >
            {EDITORIAS_EM_ORDEM.map((slug) => (
              <option key={slug} value={slug}>{rotuloDaEditoria(slug)}</option>
            ))}
          </select>
          <button
            onClick={criar} disabled={!titulo.trim() || criando}
            className="btn-neon flex items-center gap-2 shrink-0"
          >
            <Plus size={14} /> {criando ? 'Criando…' : 'Criar rascunho'}
          </button>
        </div>

        {erro && <AvisoDeErro mensagem={erro.mensagem} detalhe={erro.detalhe} />}

        <p className="text-[11px] text-gray-600">
          O endereço da matéria sai do título. Publicar é de super admin — você
          escreve, manda para revisão, e quem tem o cargo põe no ar.
        </p>
      </div>

      {isLoading && (
        <p className="card p-6 text-center font-mono text-gray-500 text-sm">Carregando…</p>
      )}

      {!isLoading && artigos.length === 0 && (
        <p className="card p-6 text-center font-mono text-gray-500 text-sm">
          Nenhuma matéria ainda. A primeira começa aí em cima.
        </p>
      )}

      {artigos.length > 0 && (
        <div className="card divide-y divide-dark-500">
          {artigos.map((a) => (
            <button
              key={a.id} onClick={() => setEditando({ id: a.id })}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-dark-700/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{a.titulo}</p>
                <p className="text-[11px] font-mono text-gray-600">
                  {rotuloDaEditoria(a.editoria)} · {a.slug}
                </p>
              </div>
              <MarcaDeIa ativo={a.redigido_com_ia} />
              <span className={`text-[10px] font-mono uppercase tracking-wider shrink-0 ${corDoEstado(a.status)}`}>
                {rotuloDoEstado(a.status)}
              </span>
              <Pencil size={13} className="text-gray-600 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
