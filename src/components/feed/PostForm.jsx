import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth.jsx';
import toast from 'react-hot-toast';
import { Send, Image, X, Film, Music } from 'lucide-react';

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
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeMediaType, setActiveMediaType] = useState(null);
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  if (!user) return null;

  function handleMediaSelect(type) {
    setActiveMediaType(type);
    fileRef.current.accept = MEDIA_TYPES[type].accept;
    fileRef.current.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = activeMediaType;
    const maxMB = MEDIA_TYPES[type].maxMB;

    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`Arquivo muito grande. Máximo ${maxMB}MB.`);
      e.target.value = '';
      return;
    }

    // Revoga URL anterior se existir
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);

    const url = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaType(type);
    setMediaPreview(url);
    e.target.value = '';
  }

  function removeMedia() {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    setActiveMediaType(null);
  }

  async function uploadMedia() {
    if (!mediaFile) return null;
    const ext = mediaFile.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('post-media')
      .upload(path, mediaFile, { contentType: mediaFile.type });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
    return publicUrl;
  }

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      toast.error('Preencha título e conteúdo!');
      return;
    }
    setLoading(true);

    try {
      let media_url = null;
      if (mediaFile) {
        setUploading(true);
        toast.loading('Enviando mídia...', { id: 'upload' });
        media_url = await uploadMedia();
        toast.dismiss('upload');
        setUploading(false);
      }

      const { error } = await supabase.from('posts').insert({
        user_id: profile?.id,
        title: title.trim(),
        content: content.trim(),
        category,
        media_url,
        media_type: mediaType,
      });

      if (error) {
        toast.error('Erro ao publicar post');
      } else {
        toast.success('Post publicado! 🎮');
        setTitle('');
        setContent('');
        removeMedia();
        onPost?.();
      }
    } catch {
      toast.error('Erro ao fazer upload. Tente um arquivo menor.');
      setUploading(false);
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

      {/* Preview da mídia */}
      {mediaPreview && (
        <div className="relative mb-3 rounded-lg overflow-hidden border border-dark-400 bg-dark-700">
          {mediaType === 'image' && (
            <img src={mediaPreview} alt="preview" className="w-full max-h-64 object-cover" />
          )}
          {mediaType === 'video' && (
            <video
              ref={videoRef}
              className="w-full max-h-64"
              controls
              playsInline
              preload="metadata"
            >
              <source src={mediaPreview} type={mediaFile?.type} />
            </video>
          )}
          {mediaType === 'audio' && (
            <div className="p-4 flex items-center gap-3">
              <Music size={20} className="text-neon-green shrink-0" />
              <audio
                ref={audioRef}
                controls
                preload="metadata"
                className="flex-1"
              >
                <source src={mediaPreview} type={mediaFile?.type} />
              </audio>
            </div>
          )}
          <button
            onClick={removeMedia}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-dark-800/90 border border-dark-400 flex items-center justify-center text-gray-400 hover:text-white"
          >
            <X size={13} />
          </button>
          <div className="px-3 pb-2">
            <p className="text-xs text-gray-500 font-mono truncate">{mediaFile?.name}</p>
            <p className="text-xs text-gray-600 font-mono">
              {(mediaFile?.size / 1024 / 1024).toFixed(1)}MB
            </p>
          </div>
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

        {!mediaFile && (
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
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          onClick={handleSubmit}
          disabled={loading || uploading}
          className="btn-solid flex items-center gap-2 py-2 px-4 ml-auto"
        >
          <Send size={13} />
          {uploading ? 'Enviando...' : loading ? 'Publicando...' : 'Publicar'}
        </button>
      </div>
    </div>
  );
}
