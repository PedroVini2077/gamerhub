import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth.jsx';
import toast from 'react-hot-toast';
import { Send, Image, X, Film, Music, Mic, Link } from 'lucide-react';
import AudioRecorder from '../ui/AudioRecorder';
import EmbedPlayer, { getEmbedInfo } from '../ui/EmbedPlayer';
import MediaPlayer from '../ui/MediaPlayer';

const categories = ['dica', 'curiosidade', 'news'];

export default function PostForm({ onPost }) {
  const { user, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audioName, setAudioName] = useState('');
  const [category, setCategory] = useState('dica');
  const [loading, setLoading] = useState(false);
  const [medias, setMedias] = useState([]);
  const [audio, setAudio] = useState(null);
  const [embedUrl, setEmbedUrl] = useState('');
  const [showEmbed, setShowEmbed] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [showRecorder, setShowRecorder] = useState(false);
  const [activeType, setActiveType] = useState(null);
  const fileRef = useRef(null);
  const audioFileRef = useRef(null);

  if (!user) return null;

  function handleMediaSelect(type) {
    if (medias.length >= 10) { toast.error('Máximo 10 mídias por post'); return; }
    setActiveType(type);
    fileRef.current.accept = type === 'image' ? 'image/*' : 'video/*';
    fileRef.current.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxMB = activeType === 'image' ? 5 : 100;
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`Máximo ${maxMB}MB`);
      e.target.value = '';
      return;
    }
    setMedias(m => [...m, { file, preview: URL.createObjectURL(file), type: activeType }]);
    e.target.value = '';
  }

  function handleAudioFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('Máximo 20MB para áudio'); return; }
    const name = file.name.replace(/\.[^/.]+$/, '');
    setAudio({ file, preview: URL.createObjectURL(file), type: 'file' });
    setAudioName(name);
    e.target.value = '';
  }

  function removeMedia(i) {
    setMedias(m => { URL.revokeObjectURL(m[i].preview); return m.filter((_, idx) => idx !== i); });
  }

  function removeAudio() {
    if (audio?.preview) URL.revokeObjectURL(audio.preview);
    setAudio(null);
    setAudioName('');
  }

  async function handleSubmit() {
    if (!title.trim()) { toast.error('Preencha o título!'); return; }

    setLoading(true);
    const toastId = toast.loading('Processando post...');

    try {
      let audio_url = null;
      let audio_type = null;

      if (audio?.file) {
        const ext = audio.file.name.split('.').pop();
        const path = `${user.id}/audio-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('post-media')
          .upload(path, audio.file, { contentType: audio.file.type });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
        audio_url = publicUrl;
        audio_type = audio.type === 'recorded' ? 'recorded' : 'music';
      }

      const embedInfo = embedUrl ? getEmbedInfo(embedUrl) : null;

      const { data: post, error: postError } = await supabase.from('posts').insert({
        user_id: profile?.id,
        title: title.trim(),
        content: content.trim() || null,
        category,
        audio_url,
        audio_type,
        audio_name: audioName.trim() || null,
        embed_url: embedUrl.trim() || null,
        embed_type: embedInfo?.type || null,
        is_live: isLive,
        was_live: isLive,
        expires_at: null,
      }).select().single();

      if (postError) throw postError;

      if (medias.length > 0) {
        const rows = [];
        for (let i = 0; i < medias.length; i++) {
          const { file, type } = medias[i];
          const ext = file.name.split('.').pop();
          const path = `${user.id}/${post.id}-${i}.${ext}`;
          await supabase.storage.from('post-media').upload(path, file, { contentType: file.type });
          const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
          rows.push({ post_id: post.id, url: publicUrl, type, position: i });
        }
        await supabase.from('post_media').insert(rows);
      }

      toast.success('Post publicado! 🎮', { id: toastId });
      setTitle(''); setContent(''); setMedias([]);
      setAudioName(''); setEmbedUrl(''); setShowEmbed(false);
      setIsLive(false); setExpiresAt('');
      removeAudio();
      onPost?.();
    } catch (err) {
      toast.error('Erro: ' + err.message, { id: toastId });
    }
    setLoading(false);
  }

  return (
    <div className="card p-5">
      <h3 className="font-display text-xs text-neon-green tracking-widest uppercase mb-4">Novo Post</h3>

      <input className="input-gamer mb-3" placeholder="Título do post..."
        value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />

      {!audio ? (
        <textarea className="input-gamer mb-3 resize-none" rows={3}
          placeholder="Escreva algo... (opcional se tiver áudio ou link)"
          value={content} onChange={e => setContent(e.target.value)} maxLength={1000} />
      ) : (
        <div className="mb-3 border border-neon-green/20 rounded-lg p-3 bg-dark-700 relative">
          <p className="text-xs font-mono text-neon-green mb-2 uppercase tracking-wider">
            {audio.type === 'recorded' ? '🎙 Áudio gravado' : '🎵 Música'}
          </p>
          <input className="input-gamer mb-2 text-sm" placeholder="Nome do áudio / música..."
            value={audioName} onChange={e => setAudioName(e.target.value)} maxLength={80} />
          <MediaPlayer src={audio.preview} title={audioName || 'Áudio'} />
          <button onClick={removeAudio}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-dark-600 flex items-center justify-center text-gray-400 hover:text-white">
            <X size={12} />
          </button>
        </div>
      )}

      {audio && (
        <textarea className="input-gamer mb-3 resize-none" rows={2}
          placeholder="Legenda opcional..."
          value={content} onChange={e => setContent(e.target.value)} maxLength={300} />
      )}

     {showEmbed && (
  <div className="mb-3 border border-dark-400 rounded-lg p-3 bg-dark-700">
    <div className="flex gap-2 mb-2">
      <input className="input-gamer flex-1 text-sm"
        placeholder="Cole o link do YouTube, Twitch, TikTok..."
        value={embedUrl} onChange={e => setEmbedUrl(e.target.value)} />
      <button onClick={() => { setShowEmbed(false); setEmbedUrl(''); setIsLive(false); setExpiresAt(''); }}
        className="text-gray-500 hover:text-red-400 transition-colors p-2">
        <X size={16} />
      </button>
    </div>

    {/* Opção de live */}
    {embedUrl && getEmbedInfo(embedUrl)?.type === 'twitch' && (
      <div className="mt-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isLive} onChange={e => setIsLive(e.target.checked)}
            className="w-4 h-4 accent-neon-green" />
          <span className="text-xs font-mono text-gray-400">🔴 Marcar como Live</span>
        </label>
      </div>
    )}

    {embedUrl && <EmbedPlayer url={embedUrl} isLive={isLive} />}
  </div>
)}

      {showRecorder && (
        <AudioRecorder
          onRecorded={(file) => {
            setAudio({ file, preview: URL.createObjectURL(file), type: 'recorded' });
            setAudioName('Áudio gravado');
            setShowRecorder(false);
          }}
          onCancel={() => setShowRecorder(false)}
        />
      )}

      {medias.length > 0 && (
        <div className="mb-3 flex gap-2 flex-wrap">
          {medias.map((m, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden border border-dark-400 bg-dark-700"
              style={{ width: 72, height: 72 }}>
              {m.type === 'image'
                ? <img src={m.preview} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                    <Film size={20} className="text-neon-green" />
                    <span className="text-xs text-gray-500 font-mono">vídeo</span>
                  </div>
              }
              <button onClick={() => removeMedia(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-dark-800/90 flex items-center justify-center text-gray-400 hover:text-white">
                <X size={10} />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-dark-800/80 text-center py-0.5">
                <span className="text-xs font-mono text-gray-400">{i + 1}</span>
              </div>
            </div>
          ))}
          <span className="text-xs text-gray-600 font-mono self-end pb-1">{medias.length}/10</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {categories.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`tag cursor-pointer transition-all ${category === c ? 'tag-green' : 'tag-purple opacity-50 hover:opacity-100'}`}>
            {c}
          </button>
        ))}

        <div className="flex gap-1 ml-1">
          {medias.length < 10 && (
            <>
              <button onClick={() => handleMediaSelect('image')} title="Imagem (máx 5MB)"
                className="text-gray-500 hover:text-neon-green transition-colors p-1">
                <Image size={16} />
              </button>
              <button onClick={() => handleMediaSelect('video')} title="Vídeo (máx 100MB)"
                className="text-gray-500 hover:text-neon-green transition-colors p-1">
                <Film size={16} />
              </button>
            </>
          )}
          {!audio && (
            <>
              <button onClick={() => audioFileRef.current.click()} title="Música (máx 20MB)"
                className="text-gray-500 hover:text-neon-green transition-colors p-1">
                <Music size={16} />
              </button>
              {!showRecorder && (
                <button onClick={() => setShowRecorder(true)} title="Gravar áudio"
                  className="text-gray-500 hover:text-neon-green transition-colors p-1">
                  <Mic size={16} />
                </button>
              )}
            </>
          )}
          {!showEmbed && (
            <button onClick={() => setShowEmbed(true)} title="Link externo"
              className="text-gray-500 hover:text-neon-green transition-colors p-1">
              <Link size={16} />
            </button>
          )}
        </div>

        <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
        <input ref={audioFileRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioFile} />

        <button onClick={handleSubmit} disabled={loading}
          className="btn-solid flex items-center gap-2 py-2 px-4 ml-auto">
          <Send size={13} />
          {loading ? 'Aguarde...' : 'Publicar'}
        </button>
      </div>
    </div>
  );
}
