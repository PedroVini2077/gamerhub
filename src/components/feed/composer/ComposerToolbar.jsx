import { Send, Image, Film, Music, Mic, Link } from 'lucide-react';

const CATEGORIES = ['dica', 'curiosidade', 'news'];

function IconAction({ icon: Icon, label, title, onClick }) {
  return (
    <button type="button" onClick={onClick} title={title || label} aria-label={label}
      className="text-gray-500 hover:text-neon-green transition-colors p-1">
      <Icon size={16} />
    </button>
  );
}

/** Categorias, anexos e o botão de publicar. */
export default function ComposerToolbar({
  category, setCategory,
  canAddMedia, hasAudio, showRecorder, showEmbed,
  onPickImage, onPickVideo, onPickAudio, onRecord, onAddEmbed,
  loading, onSubmit,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CATEGORIES.map(c => (
        <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c}
          className={`tag cursor-pointer transition-all ${category === c ? 'tag-green' : 'tag-purple opacity-50 hover:opacity-100'}`}>
          {c}
        </button>
      ))}

      <div className="flex gap-1 ml-1">
        {canAddMedia && (
          <>
            <IconAction icon={Image} label="Adicionar imagem (máx 5MB)"
              title="Imagem (máx 5MB)" onClick={onPickImage} />
            <IconAction icon={Film} label="Adicionar vídeo (máx 10MB)"
              title="Vídeo (máx 10MB) — prefira colar um link do YouTube/Twitch/TikTok pra clipes longos"
              onClick={onPickVideo} />
          </>
        )}
        {!hasAudio && (
          <>
            <IconAction icon={Music} label="Adicionar música (máx 20MB)"
              title="Música (máx 20MB)" onClick={onPickAudio} />
            {!showRecorder && <IconAction icon={Mic} label="Gravar áudio" onClick={onRecord} />}
          </>
        )}
        {!showEmbed && <IconAction icon={Link} label="Adicionar link externo" onClick={onAddEmbed} />}
      </div>

      <button type="button" onClick={onSubmit} disabled={loading}
        className="btn-solid flex items-center gap-2 py-2 px-4 ml-auto">
        <Send size={13} />
        {loading ? 'Aguarde...' : 'Publicar'}
      </button>
    </div>
  );
}
