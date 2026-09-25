import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PenLine } from 'lucide-react';
import PostForm from '../components/feed/PostForm';

/**
 * `[26/09]` `/publicar` — publicar deixou de ser uma caixinha no topo do feed.
 *
 * ── A decisão é dele, e o motivo também ───────────────────────────────────
 *
 * *"O Instagram, quando vc clica pra criar um post ou reels, ele te leva a um
 * lugar pra escolher alguma mídia... se fosse só um modal, ia continuar pequeno
 * na minha opinião"*.
 *
 * Ele está certo, e a razão é mecânica: **um modal herda a largura do que está
 * atrás dele**. O compositor ficaria espremido na coluna do feed para sempre,
 * e tudo que crescesse nele — mídia, áudio, embed, formatação — disputaria os
 * mesmos 3 centímetros. Uma rota manda na tela inteira.
 *
 * ── O que ficou no feed ───────────────────────────────────────────────────
 *
 * Uma linha (`LinhaDePublicar`) e o botão **+**. Os dois levam para cá — ele
 * pediu os dois: *"eu colocaria essa linha e acrescentaria o botão + visível
 * em algum lugar também"*.
 *
 * ── Por que a página volta para o feed ao publicar ────────────────────────
 *
 * Porque o post recém-publicado só existe para quem o escreveu depois de
 * aparecer na lista. Deixar a pessoa na página vazia depois de publicar seria
 * a versão de tela do "0 linhas afetadas": ela clicou, nada visível aconteceu,
 * e não dá para saber se deu certo (§1.5).
 */
export default function Publicar() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-white"
        >
          <ArrowLeft size={14} /> Voltar ao feed
        </button>
      </div>

      <div className="flex items-center gap-2">
        <PenLine size={16} className="text-neon-green shrink-0" />
        <h1 className="font-display text-xl text-white">Publicar</h1>
      </div>

      {/* `onPost` leva de volta ao feed: é lá que o post aparece. O `reload`
          do feed acontece sozinho na montagem — não precisa de sinal extra. */}
      <PostForm amplo onPost={() => navigate('/')} />

      <p className="text-[11px] text-gray-600">
        Texto, imagem, vídeo, áudio e link de transmissão. O que você escrever
        passa pela mesma formatação do resto do site.
      </p>
    </div>
  );
}
