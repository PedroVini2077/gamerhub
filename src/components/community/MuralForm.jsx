import { useState, useRef, memo } from 'react';
import { addMuralPost, uploadMuralMediaFiles } from '../../services/communityService';
import { useAuth } from '../../hooks/useAuth';
import { logAudit } from '../../lib/auditLog';
import toast from 'react-hot-toast';
import { Send, Image as ImageIcon, X } from 'lucide-react';

const MAX_IMAGES = 4;
const MAX_MB = 5;

const MuralForm = memo(function MuralForm({ onPost }) {
  const { user, profile } = useAuth();
  const [message, setMessage] = useState('');
  const [medias, setMedias] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  if (!user) return (
    <div className="card p-4 text-center">
      <p className="text-sm text-gray-500 font-mono">Faça login para participar do mural</p>
    </div>
  );

  function handleFiles(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (medias.length >= MAX_IMAGES) { toast.error(`Máximo ${MAX_IMAGES} imagens`); return; }
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Máximo ${MAX_MB}MB por imagem`); return; }
    setMedias(m => [...m, { file, preview: URL.createObjectURL(file), type: 'image' }]);
  }

  function removeMedia(i) {
    setMedias(m => { URL.revokeObjectURL(m[i].preview); return m.filter((_, idx) => idx !== i); });
  }

  async function handleSubmit() {
    if (!message.trim() && medias.length === 0) return;
    setLoading(true);
    const { data: post, error } = await addMuralPost({ userId: profile?.id, message: message.trim() });
    if (error || !post) {
      toast.error('Erro ao enviar mensagem');
      setLoading(false);
      return;
    }
    if (medias.length > 0) {
      const { error: mediaErr } = await uploadMuralMediaFiles(user.id, post.id, medias);
      if (mediaErr) toast.error('Mensagem enviada, mas falhou o upload de imagem');
    }
    toast.success('Mensagem enviada!');
    logAudit('mural_post', `@${profile?.username} escreveu no mural da comunidade`, { category: 'content' });
    medias.forEach(m => URL.revokeObjectURL(m.preview));
    setMessage('');
    setMedias([]);
    onPost?.();
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="card p-4">
      <textarea
        id="mural-message"
        aria-label="Mensagem para o mural da comunidade"
        className="input-gamer resize-none w-full"
        rows={2}
        placeholder="Escreva no mural da comunidade... (Enter para enviar)"
        value={message}
        onChange={e => setMessage(e.target.value)}
        onKeyDown={handleKey}
        maxLength={500}
      />

      {medias.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-3">
          {medias.map((m, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden border border-dark-400" style={{ width: 64, height: 64 }}>
              <img src={m.preview} alt={`Prévia ${i + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => removeMedia(i)}
                aria-label={`Remover imagem ${i + 1}`}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-dark-800/90 flex items-center justify-center text-gray-300 hover:text-white"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={medias.length >= MAX_IMAGES}
          title={`Adicionar imagem (máx ${MAX_IMAGES})`}
          aria-label="Adicionar imagem"
          className="text-gray-500 hover:text-neon-purple transition-colors p-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ImageIcon size={18} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFiles} />

        <span className={`text-xs font-mono ${message.length >= 500 ? 'text-red-400' : 'text-gray-600'}`}>
          {message.length}/500
        </span>

        <button
          onClick={handleSubmit}
          disabled={loading || (!message.trim() && medias.length === 0)}
          className="btn-purple flex items-center gap-2 shrink-0 ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={14} />
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  );
});

export default MuralForm;
