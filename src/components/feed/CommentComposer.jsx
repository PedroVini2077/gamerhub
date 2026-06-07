import { useState } from 'react';
import { Send } from 'lucide-react';

export default function CommentComposer({ onSubmit, placeholder = 'Escreva um comentário... (Enter para enviar)', autoFocus = false }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!text.trim() || loading) return;
    setLoading(true);
    const ok = await onSubmit(text.trim());
    if (ok) setText('');
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex gap-2 items-end">
      <textarea
        aria-label={placeholder}
        className="input-gamer resize-none flex-1 text-sm"
        rows={2}
        placeholder={placeholder}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKey}
        maxLength={500}
        autoFocus={autoFocus}
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !text.trim()}
        className="btn-neon py-2 px-3 shrink-0 flex items-center gap-1"
      >
        <Send size={13} />
      </button>
    </div>
  );
}
