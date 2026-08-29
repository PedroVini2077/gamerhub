import { safeExternalUrl } from '../../lib/url';

/**
 * A mídia do conteúdo que está na fila de moderação.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 *
 * Achado do dono em 29/08: na fila "só aparece o conteúdo de texto, agora
 * imagens, e até mesmo vídeos não aparecem". Ou seja, um post denunciado
 * **por causa da imagem** era julgado às cegas — o moderador via a legenda e
 * decidia sobre o que não conseguia ver.
 *
 * É a falha mais silenciosa possível: a tela não dava erro nenhum, ela só
 * mostrava menos do que existia, e nada indicava que faltava algo.
 *
 * ── Duas decisões deliberadas ───────────────────────────────────────────────
 *
 * **Vídeo não toca sozinho** (`preload="metadata"`, sem `autoPlay`): a fila
 * pode ter vários itens, e vídeo carregando sozinho em todos custa egress — a
 * cota mais apertada do Supabase (§6.1). O moderador clica no que quer ver.
 *
 * **Toda URL passa por `safeExternalUrl`**: elas vêm de uma tabela alimentada
 * por upload de usuário. Já houve XSS armazenado neste projeto por confiar em
 * URL vinda do banco, e o painel de moderação é justamente onde a equipe abre
 * conteúdo hostil de propósito (§4).
 */
export default function QueueMidia({ midias }) {
  if (!midias?.length) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {midias.map((m) => {
        const url = safeExternalUrl(m.url);
        if (!url) return null;
        return m.type === 'video' ? (
          <video
            key={m.id ?? m.url}
            src={url}
            controls
            preload="metadata"
            playsInline
            className="w-full rounded-lg bg-black max-h-56"
          />
        ) : (
          <a
            key={m.id ?? m.url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir em tamanho real"
          >
            <img
              src={url}
              alt="Mídia do conteúdo denunciado"
              loading="lazy"
              className="w-full rounded-lg object-cover max-h-56 bg-dark-800"
            />
          </a>
        );
      })}
    </div>
  );
}
