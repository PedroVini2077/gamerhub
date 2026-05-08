import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { Send } from 'lucide-react';

export default function MuralForm({ onPost }) {
  const { user, profile } = useAuth();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user) return (
    <div className="card p-4 text-center">
      <p className="text-sm text-gray-500 font-mono">Faça login para participar do mural</p>
    </div>
  );

  async function handleSubmit() {
    if (!message.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('community_posts').insert({
      user_id: profile?.id,
      message: message.trim(),
    });
    if (error) toast.error('Erro ao enviar mensagem');
    else {
      toast.success('Mensagem enviada! 🎮');
      setMessage('');
      onPost?.();
    }
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
      <div className="flex gap-3 items-end">
        <textarea
          className="input-gamer resize-none flex-1"
          rows={2}
          placeholder="Escreva no mural da comunidade... (Enter para enviar)"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={handleKey}
          maxLength={500}
        />
        <button onClick={handleSubmit} disabled={loading} className="btn-purple flex items-center gap-2 shrink-0">
          <Send size={14} />
          Enviar
        </button>
      </div>
    </div>
  );
}
