import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Radio, Gamepad2, Clapperboard, Sparkles } from 'lucide-react';
import { createPost } from '../../services/postService';
import { getEmbedInfo } from '../../lib/embed';
import { logAudit } from '../../lib/auditLog';
import toast from 'react-hot-toast';

const KINDS = [
  { id: 'gameplay', label: 'Gameplay', Icon: Gamepad2 },
  { id: 'react',    label: 'React',    Icon: Clapperboard },
  { id: 'outro',    label: 'Outro',    Icon: Sparkles },
];

// Modal pra um jogador ficar ao vivo trazendo o link do Twitch/YouTube.
// Reaproveita createPost (a live é um post com is_live + live_kind), então
// chat/moderação/presença/player já funcionam de graça.
export default function LiveGoModal({ profile, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState('gameplay');
  const [kindLabel, setKindLabel] = useState('');
  const [loading, setLoading] = useState(false);

  const info = url.trim() ? getEmbedInfo(url.trim()) : null;
  const validPlatform = info && ['twitch', 'youtube'].includes(info.type);

  async function handleSubmit() {
    if (!title.trim()) { toast.error('Dê um título pra sua live'); return; }
    if (!url.trim() || !url.match(/^https?:\/\//)) { toast.error('Cole o link da sua live (https://...)'); return; }
    if (!validPlatform) { toast.error('Use um link do Twitch ou do YouTube'); return; }
    if (kind === 'outro' && !kindLabel.trim()) { toast.error('Descreva o tipo da sua live'); return; }

    setLoading(true);
    const toastId = toast.loading('Iniciando sua live...');
    try {
      const { error } = await createPost({
        userId: profile?.id,
        title: title.trim(),
        content: null,
        category: 'dica',
        embedUrl: url.trim(),
        isLive: true,
        liveKind: kind,
        liveKindLabel: kind === 'outro' ? kindLabel.trim() : null,
      });
      if (error) throw error;
      toast.success('Você está ao vivo!', { id: toastId });
      logAudit('live_created', `@${profile?.username} ficou ao vivo: "${title.trim()}"`, { category: 'live' });
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error('Erro: ' + err.message, { id: toastId });
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={onClose}>
      <div className="w-full max-w-md bg-dark-800 rounded-2xl border border-neon-green/30 p-5 space-y-4 animate-fade-up"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 0 40px #22c55e15' }}>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-neon-green" />
            <h3 className="font-display text-sm text-neon-green uppercase tracking-wider">Ficar ao vivo</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Título</label>
            <input className="input-gamer" placeholder="Ex: Ranqueada até o topo — bora?"
              value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
          </div>

          <div>
            <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Link da live (Twitch / YouTube)</label>
            <input className="input-gamer" placeholder="https://twitch.tv/seucanal"
              value={url} onChange={e => setUrl(e.target.value)} />
            {url.trim() && !validPlatform && (
              <p className="text-xs font-mono text-red-400/80 mt-1.5">Use um link do Twitch ou do YouTube.</p>
            )}
            {validPlatform && (
              <p className="text-xs font-mono text-neon-green/80 mt-1.5">{info.label} detectado ✓</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Tipo</label>
            <div className="flex gap-2">
              {KINDS.map(({ id, label, Icon }) => (
                <button key={id} type="button" onClick={() => setKind(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-mono transition-all ${
                    kind === id
                      ? 'border-neon-green text-neon-green bg-neon-green/10'
                      : 'border-dark-400 text-gray-500 hover:text-gray-300'
                  }`}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>
          </div>

          {kind === 'outro' && (
            <div>
              <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Descreva o tipo</label>
              <input className="input-gamer" placeholder="Ex: Speedrun, Ranqueada, Just Chatting..."
                value={kindLabel} onChange={e => setKindLabel(e.target.value)} maxLength={40} />
            </div>
          )}
        </div>

        <button onClick={handleSubmit} disabled={loading}
          className="btn-solid w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          <Radio size={13} />{loading ? 'Aguarde...' : 'Iniciar live'}
        </button>
      </div>
    </div>,
    document.body
  );
}
