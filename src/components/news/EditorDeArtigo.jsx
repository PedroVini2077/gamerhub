import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Save, Send, Globe, Undo2, Trash2 } from 'lucide-react';
import {
  fetchArtigoParaEditar, salvarArtigo, mudarEstado, apagarArtigo,
} from '../../services/newsEditorialService';
import { apenasData } from '../../services/result';
import { EDITORIAS_EM_ORDEM, rotuloDaEditoria } from '../../lib/news/editorias';
import { rotuloDoEstado, corDoEstado, estadoNoAr, podeEditar } from '../../lib/news/estadosDoArtigo';
import { RECURSOS_COMPLETOS } from '../../lib/formatacao/vocabulario';
import EditorDeTexto from '../ui/EditorDeTexto';
import ConfirmModal from '../ui/ConfirmModal';
import SugestoesDaMateria from './SugestoesDaMateria';

/**
 * `[25/09]` Escrever uma matéria.
 *
 * ── O corpo usa o MESMO editor do post ────────────────────────────────────
 *
 * Nada de um editor próprio para a equipe: seria uma segunda implementação da
 * mesma coisa, e é onde as duas divergem. O texto que sai daqui atravessa o
 * mesmo analisador e é desenhado pelo mesmo `TextoFormatado` — então o que o
 * editor vê na prévia é exatamente o que o leitor vai ver.
 *
 * ── Os botões somem, não ficam cinzas ─────────────────────────────────────
 *
 * "Publicar" não aparece para quem não é super admin. Botão desabilitado
 * anuncia um poder que a pessoa não tem e convida a tentar; o corte editorial
 * fica mais claro quando a ação simplesmente não está ali.
 */
export default function EditorDeArtigo({ id, ehSuper, onFechar }) {
  const { data: artigo, isLoading, refetch } = useQuery({
    queryKey: ['news-editar', id],
    queryFn: () => apenasData(fetchArtigoParaEditar(id)),
  });

  // `rascunho` é o que a pessoa DIGITOU; `null` significa "ainda não mexeu".
  //
  // Antes isto era um `useEffect` copiando o artigo para o estado — e o lint
  // reclamou com razão: espelhar dado de servidor em estado via efeito cria
  // render em cascata e uma segunda cópia da verdade, que precisa ser
  // ressincronizada na mão a cada refetch. Derivar resolve os dois: enquanto
  // ninguém editou, o que aparece é o servidor; depois de salvar, `null`
  // devolve o controle a ele.
  const [rascunho, setRascunho] = useState(null);
  const [estado, setEstado] = useState('');
  const [confirmarApagar, setConfirmarApagar] = useState(false);

  const doServidor = artigo && {
    titulo: artigo.titulo ?? '', subtitulo: artigo.subtitulo ?? '',
    resumo: artigo.resumo ?? '', conteudo: artigo.conteudo ?? '',
    capa_url: artigo.capa_url ?? '', fonte_url: artigo.fonte_url ?? '',
    editoria: artigo.editoria ?? EDITORIAS_EM_ORDEM[0],
  };
  const campos = rascunho ?? doServidor;

  if (isLoading || !campos) {
    return <p className="card p-6 text-center font-mono text-gray-500 text-sm">Carregando…</p>;
  }
  if (!artigo) {
    return <p className="card p-6 text-center font-mono text-gray-500 text-sm">Matéria não encontrada.</p>;
  }

  const editavel = podeEditar(artigo.status, ehSuper);
  const set = (k) => (v) => setRascunho({ ...campos, [k]: v });

  async function comAviso(promessa, sucesso) {
    setEstado('');
    const { error } = await promessa;
    // O erro do servidor chega INTEIRO na tela. Trocar por "algo deu errado"
    // apagaria a única informação útil (§1.5).
    setEstado(error ? (error.message ?? 'Não deu.') : sucesso);
    // Deu certo: solta o rascunho para o servidor voltar a ser a verdade.
    if (!error) { setRascunho(null); refetch(); }
  }

  const salvar = () => comAviso(salvarArtigo(id, campos), 'Salvo.');
  const paraEstado = (destino, msg) => comAviso(mudarEstado(id, destino), msg);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onFechar} className="flex items-center gap-1 text-sm text-gray-500 hover:text-white">
          <ArrowLeft size={14} /> Voltar
        </button>
        <span className={`text-[10px] font-mono uppercase tracking-wider ${corDoEstado(artigo.status)}`}>
          {rotuloDoEstado(artigo.status)}
        </span>
        <span className="text-[11px] font-mono text-gray-600">/news/{artigo.slug}</span>
      </div>

      {!editavel && (
        <p className="card p-3 text-xs text-yellow-400 font-mono border-yellow-400/40">
          Esta matéria está no ar. Só super admin edita o que já foi publicado.
        </p>
      )}

      <div className="card p-4 space-y-3">
        <input
          value={campos.titulo} onChange={(e) => set('titulo')(e.target.value)}
          disabled={!editavel} maxLength={200} aria-label="Título"
          className="input-gamer font-display text-lg"
        />
        <input
          value={campos.subtitulo} onChange={(e) => set('subtitulo')(e.target.value)}
          disabled={!editavel} maxLength={300} placeholder="Subtítulo (opcional)"
          aria-label="Subtítulo" className="input-gamer"
        />
        <textarea
          value={campos.resumo} onChange={(e) => set('resumo')(e.target.value)}
          disabled={!editavel} maxLength={400} rows={2}
          placeholder="Resumo — é o que aparece no cartão da lista"
          aria-label="Resumo" className="input-gamer resize-none"
        />
        <div className="flex gap-2 flex-wrap">
          <select
            value={campos.editoria} onChange={(e) => set('editoria')(e.target.value)}
            disabled={!editavel} aria-label="Editoria" className="input-gamer w-auto"
          >
            {EDITORIAS_EM_ORDEM.map((s) => <option key={s} value={s}>{rotuloDaEditoria(s)}</option>)}
          </select>
          <input
            value={campos.capa_url} onChange={(e) => set('capa_url')(e.target.value)}
            disabled={!editavel} placeholder="URL da capa (https://)"
            aria-label="URL da capa" className="input-gamer flex-1 min-w-[200px]"
          />
        </div>
        <input
          value={campos.fonte_url} onChange={(e) => set('fonte_url')(e.target.value)}
          disabled={!editavel} placeholder="Fonte (https://)"
          aria-label="URL da fonte" className="input-gamer"
        />
      </div>

      <div className="card p-4">
        <EditorDeTexto
          value={campos.conteudo} onChange={set('conteudo')}
          placeholder="O corpo da matéria" maxLength={20000} rows={14}
          recursos={RECURSOS_COMPLETOS} id={`corpo-${id}`}
        />
      </div>

      {editavel && (
        <SugestoesDaMateria campos={campos} onAplicar={(k, v) => set(k)(v)} />
      )}

      {estado && <p className="text-xs font-mono text-gray-400">{estado}</p>}

      <div className="flex gap-2 flex-wrap">
        {editavel && (
          <button onClick={salvar} className="btn-neon flex items-center gap-2">
            <Save size={14} /> Salvar
          </button>
        )}

        {artigo.status === 'draft' && (
          <button onClick={() => paraEstado('in_review', 'Mandado para revisão.')}
            className="btn-ghost flex items-center gap-2">
            <Send size={14} /> Mandar para revisão
          </button>
        )}

        {artigo.status === 'in_review' && (
          <button onClick={() => paraEstado('draft', 'De volta a rascunho.')}
            className="btn-ghost flex items-center gap-2">
            <Undo2 size={14} /> Voltar para rascunho
          </button>
        )}

        {/* Some para quem não é super: botão desabilitado anuncia um poder que
            a pessoa não tem e convida a tentar. */}
        {ehSuper && !estadoNoAr(artigo.status) && (
          <button onClick={() => paraEstado('published', 'No ar.')}
            className="btn-neon flex items-center gap-2">
            <Globe size={14} /> Publicar
          </button>
        )}
        {ehSuper && estadoNoAr(artigo.status) && (
          <button onClick={() => paraEstado('draft', 'Tirado do ar.')}
            className="btn-ghost flex items-center gap-2">
            <Undo2 size={14} /> Tirar do ar
          </button>
        )}
        {ehSuper && (
          <button onClick={() => setConfirmarApagar(true)}
            className="btn-ghost flex items-center gap-2 text-red-400" aria-label="Apagar matéria">
            <Trash2 size={14} /> Apagar
          </button>
        )}
      </div>

      {confirmarApagar && (
        <ConfirmModal
          title="Apagar esta matéria?"
          message="Isto não tem volta. O texto e o endereço somem."
          confirmLabel="Apagar"
          onConfirm={async () => {
            setConfirmarApagar(false);
            const { error } = await apagarArtigo(id);
            if (error) setEstado(error.message ?? 'Não deu para apagar.');
            else onFechar();
          }}
          onClose={() => setConfirmarApagar(false)}
        />
      )}
    </div>
  );
}
