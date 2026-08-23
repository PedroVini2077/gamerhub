import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CONTENT_LABEL, FONTE_DO_CONTEUDO } from './queueLabels';


function Aviso({ children }) {
  return <p className="text-xs font-mono text-gray-600 italic">{children}</p>;
}

/** Mostra o conteúdo que está sendo julgado na fila de moderação. */
export default function QueueContentPreview({ contentType, contentId }) {
  // Um estado só, com fase explícita: com `content === null` servindo de
  // "carregando" E de "não achei", não havia como distinguir os dois — e o
  // caso "não achei" ficava girando indefinidamente.
  const [estado, setEstado] = useState({ fase: 'carregando' });

  // Tipo desconhecido é decidido no RENDER, não com `setState` dentro do
  // efeito: é função pura do `contentType`, não precisa de estado nenhum.
  const fonte = FONTE_DO_CONTEUDO[contentType];

  useEffect(() => {
    if (!fonte) return;

    let cancelado = false;
    async function carregar() {
      // `maybeSingle` e não `single`: conteúdo apagado é situação NORMAL aqui
      // (mensagem de chat que o mod já removeu na live), não erro.
      const { data, error } = await supabase
        .from(fonte.tabela).select(fonte.cols).eq('id', contentId).maybeSingle();
      if (cancelado) return;
      if (error)     setEstado({ fase: 'erro', msg: error.message });
      else if (!data) setEstado({ fase: 'sumiu' });
      else            setEstado({ fase: 'ok', data });
    }
    carregar();

    return () => { cancelado = true; };
  }, [fonte, contentId]);

  if (!fonte)                       return <Aviso>Tipo de conteúdo desconhecido: {contentType}</Aviso>;
  if (estado.fase === 'carregando') return <Aviso>Carregando...</Aviso>;
  if (estado.fase === 'erro')         return <Aviso>Não foi possível carregar: {estado.msg}</Aviso>;
  if (estado.fase === 'sumiu')        return <Aviso>Conteúdo não existe mais (já foi apagado).</Aviso>;

  const { data } = estado;
  const corpo = data.content || data.message || '';
  return (
    <div className="bg-dark-700 rounded-lg p-3 space-y-1">
      <p className="text-xs font-mono text-gray-500">
        @{data.profiles?.username || '?'} · {CONTENT_LABEL[contentType]}
      </p>
      {data.title && <p className="text-sm font-semibold text-white">{data.title}</p>}
      {corpo && <p className="text-sm text-gray-300 line-clamp-4 leading-relaxed">{corpo}</p>}
      {!data.title && !corpo && <p className="text-sm text-gray-600 italic">(sem texto)</p>}
    </div>
  );
}
