import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth.jsx';
import toast from 'react-hot-toast';
import { Send, Image, X, Film, Music, Mic } from 'lucide-react';
import AudioRecorder from '../ui/AudioRecorder';

const categories = ['dica', 'curiosidade', 'news'];

const MEDIA_TYPES = {
  image: { icon: Image, label: 'Imagem', accept: 'image/*', maxMB: 5 },
  video: { icon: Film, label: 'Vídeo', accept: 'video/*', maxMB: 100 },
  audio: { icon: Music, label: 'Áudio', accept: 'audio/*', maxMB: 20 },
};

export default function PostForm({ onPost }) {
  const { user, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('dica');
  const [loading, setLoading] = useState(false);
  const [medias, setMedias] = useState([]); // [{file, preview, type}]
  const [showRecorder, setShowRecorder] = useState(false);
  const [activeType, setActiveType] = useState(null);
  const fileRef = useRef(null);

  if (!user) return null;

  function handleMediaSelect(type) {
    if (medias.length >= 10) { toast.error('Máximo 10 mídias por post'); return; }
    setActiveType(type);
    fileRef.current.accept = MEDIA_TYPES[type].accept;
    fileRef.current.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxMB = MEDIA_TYPES[activeType].maxMB;
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`Máximo ${maxMB}MB para ${MEDIA_TYPES[activeType].label}`);
      e.target.value = '';
      return;
    }
    const preview = URL.createObjectURL(file);
    setMedias(m => [...m, { file, preview, type: activeType }]);
    e.target.value = '';
  }

  function removeMedia(i) {
    setMedias(m => {
      URL.revokeObjectURL(m[i].preview);
      return m.filter((_, idx) => idx !== i);
    });
  }

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      toast.error('Preencha título e conteúdo!');
      return;
    }
    setLoading(true);

    try {
      // 1. Cria o post
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: profile?.id,
          title: title.trim(),
          content: content.trim(),
          category,
        })
        .select()
        .single();

      if (postError) throw postError;

      // 2. Faz upload das mídias
      if (medias.length > 0) {
        toast.loading('Enviando mídias...', { id: 'upload' });
        const mediaRows = [];

        for (let i = 0; i < medias.length; i++) {
          const { file, type } = medias[i];
          const ext = file.name.split('.').pop();
          const path = `${user.id}/${post.id}-${i}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('post-media')
            .upload(path, file, { contentType: file.type });
          if (upErr) throw upErr;
          const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
          mediaRows.push({ post_id: post.id, url: publicUrl, type, position: i });
        }

        const { error: mediaErr } = await supabase.from('post_media').insert(mediaRows);
        if (mediaErr) throw mediaErr;
        toast.dismiss('upload');
      }

      toast.success('Post publicado! 🎮');
      setTitle('');
      setContent('');
      setMedias([]);
      onPost?.();
    } catch (err) {
      toast.error('Erro ao publicar: ' + err.message);
      toast.dismiss('upload');
    }

    setLoading(false);
  }

  return (
    <div className="card p-5">
      <h3 className="font-display text-xs text-neon-green tracking-widest uppercase mb-4">
        Novo Post
      </h3>
      <input
        className="input-gamer mb-3"
        placeholder="Título do post..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        maxLength={100}
      />
      <textarea
        className="input-gamer mb-3 resize-none"
        rows={3}
        placeholder="Compartilhe uma dica, curiosidade ou news..."
        value={content}
        onChange={e => setContent(e.target.value)}
        maxLength={1000}
      />

      {/* Gravador */}
      {showRecorder && (
        <AudioRecorder
          onRecorded={(file) => {
            const preview = URL.createObjectURL(file);
            setMedias(m => [...m, { file, preview, type: 'audio' }]);
            setShowRecorder(false);
          }}
          onCancel={() => setShowRecorder(false)}
        />
      )}

      {/* Preview das mídias */}
      {medias.length > 0 && (
        <div className="mb-3 flex gap-2 flex-wrap">
          {medias.map((m, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden border border-dark-400 bg-dark-700"
              style={{ width: 80, height: 80 }}>
              {m.type === 'image' && (
                <img src={m.preview} className="w-full h-full object-cover" />
              )}
              {m.type === 'video' && (
                <div className="w-full h-full flex items-center justify-center">
                  <Film size={24} className="text-neon-green" />
                </div>
              )}
              {m.type === 'audio' && (
                <div className="w-full h-full flex items-center justify-center">
                  <Music size={24} className="text-neon-green" />
                </div>
              )}
              <button
                onClick={() => removeMedia(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-dark-800/90 flex items-center justify-center text-gray-400 hover:text-white"
              >
                <X size={10} />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-dark-800/80 text-center">
                <span className="text-xs font-mono text-gray-400">{i + 1}</span>
              </div>
            </div>
          ))}
          {medias.length < 10 && (
            <div className="text-xs text-gray-600 font-mono self-end pb-1">
              {medias.length}/10
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`tag cursor-pointer transition-all ${
              category === c ? 'tag-green' : 'tag-purple opacity-50 hover:opacity-100'
            }`}
          >
            {c}
          </button>
        ))}

        {medias.length < 10 && !showRecorder && (
          <div className="flex gap-1 ml-1">
            {Object.entries(MEDIA_TYPES).map(([type, { icon: Icon, label }]) => (
              <button
                key={type}
                onClick={() => handleMediaSelect(type)}
                title={`${label} (máx. ${MEDIA_TYPES[type].maxMB}MB)`}
                className="text-gray-500 hover:text-neon-green transition-colors p-1"
              >
                <Icon size={16} />
              </button>
            ))}
            <button
              onClick={() => setShowRecorder(true)}
              title="Gravar áudio"
              className="text-gray-500 hover:text-neon-green transition-colors p-1"
            >
              <Mic size={16} />
            </button>
          </div>
        )}

        <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-solid flex items-center gap-2 py-2 px-4 ml-auto"
        >
          <Send size={13} />
          {loading ? 'Publicando...' : 'Publicar'}
        </button>
      </div>
    </div>
  );
}
