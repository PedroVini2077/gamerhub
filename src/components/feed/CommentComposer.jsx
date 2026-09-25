import { useState } from 'react';
import { Send } from 'lucide-react';
import EditorDeTexto from '../ui/EditorDeTexto';
import { RECURSOS_DE_COMENTARIO } from '../../lib/formatacao/vocabulario';

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
    <div>
      {/* `[25/09]` O mesmo editor do post, com MENOS poder. Pedido do dono:
          "nem tudo que tem na hora de postar precisa ter nos comentários".
          Comentário é conversa — cor e tamanho aqui virariam disputa de quem
          grita mais alto, e a resposta deixaria de se distinguir do post. */}
      <EditorDeTexto
        value={text} onChange={setText} placeholder={placeholder}
        maxLength={500} rows={2} recursos={RECURSOS_DE_COMENTARIO}
        onKeyDown={handleKey} autoFocus={autoFocus}
      />
      <div className="flex justify-end -mt-1">
        <button aria-label="Enviar comentário"
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          className="btn-neon py-2 px-3 shrink-0 flex items-center gap-1"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}
