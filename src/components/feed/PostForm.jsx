import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { Send } from 'lucide-react';

const categories = ['dica', 'curiosidade', 'news'];

export default function PostForm({ onPost }) {
  const { user, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('dica');
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      toast.error('Preencha título e conteúdo!');
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('posts').insert({
      user_id: profile?.id,
      title: title.trim(),
      content: content.trim(),
      category,
    });
    if (error) {
      toast.error('Erro ao publicar post');
    } else {
      toast.success('Post publicado! 🎮');
      setTitle('');
      setContent('');
      onPost?.();
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
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
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
        </div>
        <div className="ml-auto">
          <button onClick={handleSubmit} disabled={loading} className="btn-solid flex items-center gap-2 py-2 px-4">
            <Send size={13} />
            {loading ? 'Enviando...' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  );
}
