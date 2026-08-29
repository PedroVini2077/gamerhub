import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CONTENT_LABEL, FONTE_DO_CONTEUDO, linkDoConteudo } from './queueLabels';
import QueueMidia from './QueueMidia';

function Aviso({ children }) {
  return <p className="text-xs font-mono text-gray-600 italic">{children}</p>;
}

// Acima disto o texto entra recolhido, com botão para abrir. O problema que
// isto resolve foi levantado pelo dono: "se for textos muito longos isso vai
// quebrar uma hora". O `line-clamp-4` anterior escondia o resto **sem dizer
// que havia resto** — o moderador julgava um trecho achando que era o todo.
const LIMITE_DE_TEXTO = 400;

/** Mostra o conteúdo que está sendo julgado na fila de moderação. */
export default function QueueContentPreview({ contentType, contentId }) {
  // Um estado só, com fase explícita: com `content === null` servindo de
  // "carregando" E de "não achei", não havia como distinguir os dois — e o
  // caso "não achei" ficava girando indefinidamente.
  const [estado, setEstado] = useState({ fase: 'carregando' });
  const [aberto, setAberto] = useState(false);

  // Tipo desconhecido é decidido no RENDER, não com `setState` dentro do
  // efeito: é função pura do `contentType`, não precisa de estado nenhum.
  const fonte = FONTE_DO_CONTEUDO[contentType];

  useEffect(() => {
    if (!fonte) return undefined;

    let cancelado = false;
    async function carregar() {
      // `maybeSingle` e não `single`: conteúdo apagado é situação NORMAL aqui
      // (mensagem de chat que o mod já removeu na live), não erro.
      const { data, error } = await supabase
        .from(fonte.tabela).select(fonte.cols).eq('id', contentId).maybeSingle();
      if (cancelado) return;
      if (error)      { setEstado({ fase: 'erro', msg: error.message }); return; }
      if (!data)      { setEstado({ fase: 'sumiu' }); return; }

      // A mídia é uma segunda consulta, e só para os tipos que têm mídia. Ela
      // não pode derrubar a prévia: se falhar, o texto ainda aparece, e o aviso
      // diz que a mídia não pôde ser carregada — mostrar o texto e OMITIR em
      // silêncio que havia imagem seria o bug original de volta.
      let midias = [];
      let midiaFalhou = false;
      if (fonte.midia) {
        const { data: m, error: erroMidia } = await supabase
          .from(fonte.midia.tabela)
          .select('id, url, type, position')
          .eq(fonte.midia.fk, contentId)
          .order('position');
        if (cancelado) return;
        if (erroMidia) midiaFalhou = true;
        else midias = m || [];
      }
      setEstado({ fase: 'ok', data, midias, midiaFalhou });
    }
    carregar();

    return () => { cancelado = true; };
  }, [fonte, contentId]);

  if (!fonte)                       return <Aviso>Tipo de conteúdo desconhecido: {contentType}</Aviso>;
  if (estado.fase === 'carregando') return <Aviso>Carregando...</Aviso>;
  if (estado.fase === 'erro')       return <Aviso>Não foi possível carregar: {estado.msg}</Aviso>;
  if (estado.fase === 'sumiu')      return <Aviso>Conteúdo não existe mais (já foi apagado).</Aviso>;

  const { data, midias, midiaFalhou } = estado;
  const corpo = data.content || data.message || '';
  const comprido = corpo.length > LIMITE_DE_TEXTO;
  const visivel = comprido && !aberto ? `${corpo.slice(0, LIMITE_DE_TEXTO)}…` : corpo;
  const destino = linkDoConteudo(contentType, data);

  return (
    <div className="bg-dark-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-mono text-gray-500">
          @{data.profiles?.username || '?'} · {CONTENT_LABEL[contentType]}
        </p>
        {/* Sem destino, sem botão. Link que leva ao lugar errado é pior que
            link nenhum: o moderador julgaria outro conteúdo. */}
        {destino && (
          <Link
            to={destino}
            className="inline-flex items-center gap-1 text-xs font-mono text-neon-green hover:underline shrink-0"
            title="Abrir o conteúdo no site"
          >
            <ExternalLink size={11} /> ver no site
          </Link>
        )}
      </div>

      {data.title && <p className="text-sm font-semibold text-white">{data.title}</p>}

      {corpo && (
        <div className="space-y-1">
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
            {visivel}
          </p>
          {comprido && (
            <button
              onClick={() => setAberto(a => !a)}
              className="text-xs font-mono text-neon-green hover:underline"
            >
              {aberto
                ? 'mostrar menos'
                : `mostrar tudo (${corpo.length} caracteres)`}
            </button>
          )}
        </div>
      )}

      <QueueMidia midias={midias} />

      {midiaFalhou && (
        <Aviso>Este conteúdo tem mídia, mas ela não pôde ser carregada.</Aviso>
      )}
      {!data.title && !corpo && !midias?.length && (
        <p className="text-sm text-gray-600 italic">(sem texto)</p>
      )}
    </div>
  );
}
